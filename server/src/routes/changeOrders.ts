import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { ChangeOrder, ChangeType, ChangeOrderStatus, Order, OrderStatusHistory } from '../types';
import { addOrderHistory, ORDER_STATUS_LABELS_CN, getStageInfo } from '../stateFlow';

const router = Router();

const CHANGE_TYPE_LABELS_CN: Record<ChangeType, string> = {
  fabric: '更换布料',
  accessory: '增减配件',
  style: '调整风格',
  delivery_date: '修改交付日期',
  quantity: '追加套装件数',
};

const CHANGE_ORDER_STATUS_LABELS_CN: Record<ChangeOrderStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
};

const STAGE_IMPACT_RULES: Record<string, { fabric: string; accessory: string; style: string; delivery_date: string; quantity: string }> = {
  pending: {
    fabric: '订单尚未确认，布料变更无实质影响，可直接修改',
    accessory: '订单尚未确认，配件变更无实质影响，可直接修改',
    style: '订单尚未确认，风格调整无实质影响，可直接修改',
    delivery_date: '订单尚未确认，交付日期调整无实质影响',
    quantity: '订单尚未确认，数量变更无实质影响，可直接修改',
  },
  confirmed: {
    fabric: '已确认接单尚未打版，布料变更需要重新评估面料采购周期',
    accessory: '已确认接单尚未打版，配件变更需要重新评估采购成本',
    style: '已确认接单尚未打版，风格调整需要重新评估设计工时',
    delivery_date: '已确认接单，调整交付日期需重新评估排单计划',
    quantity: '已确认接单尚未打版，数量变更需要重新评估物料需求',
  },
  pattern_making: {
    fabric: '打版进行中，布料变更可能需要调整版型参数，影响打版进度',
    accessory: '打版进行中，配件变更需要预留安装位置，需调整版型',
    style: '打版进行中，风格调整需要重新设计版型，影响较大',
    delivery_date: '打版进行中，调整交付日期需评估剩余工期可行性',
    quantity: '打版进行中，数量变更需评估面料和工时是否充足',
  },
  fabric_prep: {
    fabric: '裁料阶段，布料已裁剪，变更布料将产生额外物料损耗和返工成本',
    accessory: '裁料阶段，配件变更需评估是否已采购，可能产生退换货成本',
    style: '裁料阶段，风格调整可能需要重新裁剪，物料损失较大',
    delivery_date: '裁料阶段，调整交付日期需与生产部门协调排期',
    quantity: '裁料阶段，数量变更需评估是否已裁料，可能产生额外成本',
  },
  sewing: {
    fabric: '缝制阶段，布料已缝制完成，变更布料需全部返工，影响极大',
    accessory: '缝制阶段，配件变更可能需要局部拆改，增加手工工时',
    style: '缝制阶段，风格调整需要局部或全部返工，严重影响进度',
    delivery_date: '缝制阶段，调整交付日期需与缝制师傅协调进度',
    quantity: '缝制阶段，数量变更需重新安排生产，可能影响其他订单排期',
  },
  fitting: {
    fabric: '试穿阶段，样衣已完成，变更布料需全部重做，严重影响交付',
    accessory: '试穿阶段，配件变更可在最终调整时安装，影响较小',
    style: '试穿阶段，风格调整需要局部修改或重做，视修改范围而定',
    delivery_date: '试穿阶段，调整交付日期需评估修改量和剩余工期',
    quantity: '试穿阶段，数量变更需重新生产，严重影响排期',
  },
  customer_approved: {
    fabric: '客户已确认，布料变更需要客户重新确认并全部返工',
    accessory: '客户已确认，配件变更需要客户重新确认',
    style: '客户已确认，风格调整需要客户重新确认并返工',
    delivery_date: '客户已确认，调整交付日期需与客户协商一致',
    quantity: '客户已确认，数量变更需要客户重新确认价格和交期',
  },
  shipping: {
    fabric: '订单已发货，无法变更布料',
    accessory: '订单已发货，无法变更配件',
    style: '订单已发货，无法调整风格',
    delivery_date: '订单已发货，无法修改交付日期',
    quantity: '订单已发货，无法变更数量',
  },
  completed: {
    fabric: '订单已完成，无法变更布料',
    accessory: '订单已完成，无法变更配件',
    style: '订单已完成，无法调整风格',
    delivery_date: '订单已完成，无法修改交付日期',
    quantity: '订单已完成，无法变更数量',
  },
  cancelled: {
    fabric: '订单已取消，无法变更',
    accessory: '订单已取消，无法变更',
    style: '订单已取消，无法变更',
    delivery_date: '订单已取消，无法变更',
    quantity: '订单已取消，无法变更',
  },
};

const DELAY_DAY_RULES: Record<string, Record<ChangeType, number>> = {
  pending: { fabric: 0, accessory: 0, style: 0, delivery_date: 0, quantity: 0 },
  confirmed: { fabric: 2, accessory: 1, style: 3, delivery_date: 0, quantity: 1 },
  pattern_making: { fabric: 3, accessory: 1, style: 4, delivery_date: 0, quantity: 2 },
  fabric_prep: { fabric: 5, accessory: 2, style: 6, delivery_date: 0, quantity: 3 },
  sewing: { fabric: 8, accessory: 2, style: 7, delivery_date: 0, quantity: 5 },
  fitting: { fabric: 12, accessory: 2, style: 8, delivery_date: 0, quantity: 8 },
  customer_approved: { fabric: 10, accessory: 3, style: 10, delivery_date: 0, quantity: 10 },
  shipping: { fabric: 0, accessory: 0, style: 0, delivery_date: 0, quantity: 0 },
  completed: { fabric: 0, accessory: 0, style: 0, delivery_date: 0, quantity: 0 },
  cancelled: { fabric: 0, accessory: 0, style: 0, delivery_date: 0, quantity: 0 },
};

function calculatePriceImpact(order: Order, changeType: ChangeType, priceDiff: number): { priceBefore: number; priceAfter: number; supplementAmount: number } {
  const priceBefore = order.totalPrice;
  const priceAfter = priceBefore + priceDiff;
  const supplementAmount = priceDiff;
  return { priceBefore, priceAfter, supplementAmount };
}

function calculateDelayDays(orderStatus: string, changeType: ChangeType, customDelay?: number): number {
  if (customDelay !== undefined && customDelay >= 0) {
    return customDelay;
  }
  const rules = DELAY_DAY_RULES[orderStatus] || DELAY_DAY_RULES.pending;
  return rules[changeType] || 0;
}

function getStageImpact(orderStatus: string, changeType: ChangeType): string {
  const rules = STAGE_IMPACT_RULES[orderStatus] || STAGE_IMPACT_RULES.pending;
  return rules[changeType] || '变更对当前阶段的影响需评估';
}

function validateChangeRequest(order: Order, changeType: ChangeType, supplementAmount: number, refundNote?: string): { valid: boolean; message?: string } {
  if (order.status === 'shipping' || order.status === 'completed' || order.status === 'cancelled') {
    if (changeType === 'delivery_date') {
      return { valid: false, message: '订单已发货/完成/取消，无法发起交期变更' };
    }
    return { valid: false, message: `订单已${ORDER_STATUS_LABELS_CN[order.status]}，无法发起需求变更` };
  }

  if (supplementAmount < 0 && (!refundNote || refundNote.trim() === '')) {
    return { valid: false, message: '补款金额为负（需退款）时，必须填写退款说明' };
  }

  return { valid: true };
}

function applyChangeToOrder(order: Order, changeOrder: ChangeOrder): Order {
  const updatedOrder = { ...order };

  updatedOrder.totalPrice = changeOrder.priceAfter;

  if (changeOrder.changeType === 'delivery_date') {
    updatedOrder.deliveryDate = changeOrder.afterValue;
  }

  if (changeOrder.changeType === 'fabric') {
    updatedOrder.items = updatedOrder.items.map(item => ({
      ...item,
      fabricPreference: changeOrder.afterValue,
    }));
  }

  if (changeOrder.changeType === 'accessory') {
    updatedOrder.items = updatedOrder.items.map((item, idx) => ({
      ...item,
      accessories: idx === 0 ? changeOrder.afterValue : item.accessories,
    }));
  }

  if (changeOrder.changeType === 'quantity') {
    const newQty = parseInt(changeOrder.afterValue) || 1;
    if (updatedOrder.items.length > 0) {
      updatedOrder.items[0] = { ...updatedOrder.items[0], quantity: newQty };
    }
  }

  return updatedOrder;
}

router.get('/', (req: Request, res: Response) => {
  const { orderId, status } = req.query;
  let filtered = [...store.changeOrders];
  if (orderId) {
    filtered = filtered.filter(c => c.orderId === orderId);
  }
  if (status) {
    filtered = filtered.filter(c => c.status === status);
  }
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const enriched = filtered.map(c => ({
    ...c,
    changeTypeLabel: CHANGE_TYPE_LABELS_CN[c.changeType],
    statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[c.status],
  }));
  res.json({ success: true, data: enriched });
});

router.get('/:id', (req: Request, res: Response) => {
  const change = store.changeOrders.find(c => c.id === req.params.id);
  if (!change) {
    return res.status(404).json({ success: false, message: '变更单不存在' });
  }
  res.json({
    success: true,
    data: {
      ...change,
      changeTypeLabel: CHANGE_TYPE_LABELS_CN[change.changeType],
      statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[change.status],
    },
  });
});

router.post('/preview', (req: Request, res: Response) => {
  const { orderId, changeType, description, beforeValue, afterValue, priceDiff, estimatedDelayDays } = req.body;

  if (!orderId || !changeType || !beforeValue || !afterValue) {
    return res.status(400).json({
      success: false,
      message: '请填写必填项：关联订单、变更类型、变更前值、变更后值',
    });
  }

  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '关联订单不存在' });
  }

  const validTypes: ChangeType[] = ['fabric', 'accessory', 'style', 'delivery_date', 'quantity'];
  if (!validTypes.includes(changeType)) {
    return res.status(400).json({ success: false, message: '变更类型无效' });
  }

  const validation = validateChangeRequest(order, changeType, priceDiff || 0);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const priceImpact = calculatePriceImpact(order, changeType, priceDiff || 0);
  const delayDays = calculateDelayDays(order.status, changeType, estimatedDelayDays);
  const stageImpact = getStageImpact(order.status, changeType);

  res.json({
    success: true,
    data: {
      orderId,
      changeType,
      changeTypeLabel: CHANGE_TYPE_LABELS_CN[changeType],
      description: description || `${CHANGE_TYPE_LABELS_CN[changeType]}：${beforeValue} → ${afterValue}`,
      beforeValue,
      afterValue,
      ...priceImpact,
      priceDiff: priceImpact.supplementAmount,
      estimatedDelayDays: delayDays,
      stageImpact,
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const { orderId, changeType, description, beforeValue, afterValue, priceDiff, estimatedDelayDays, refundNote, operator } = req.body;

  if (!orderId || !changeType || !beforeValue || !afterValue || !operator) {
    return res.status(400).json({
      success: false,
      message: '请填写必填项：关联订单、变更类型、变更前值、变更后值、操作人',
    });
  }

  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '关联订单不存在' });
  }

  const validTypes: ChangeType[] = ['fabric', 'accessory', 'style', 'delivery_date', 'quantity'];
  if (!validTypes.includes(changeType)) {
    return res.status(400).json({ success: false, message: '变更类型无效' });
  }

  const finalPriceDiff = priceDiff || 0;
  const validation = validateChangeRequest(order, changeType, finalPriceDiff, refundNote);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const priceImpact = calculatePriceImpact(order, changeType, finalPriceDiff);
  const delayDays = calculateDelayDays(order.status, changeType, estimatedDelayDays);
  const stageImpact = getStageImpact(order.status, changeType);

  const now = new Date().toISOString();
  const newChange: ChangeOrder = {
    id: `change-${uuidv4().slice(0, 8)}`,
    orderId,
    changeType,
    description: description || `${CHANGE_TYPE_LABELS_CN[changeType]}：${beforeValue} → ${afterValue}`,
    beforeValue,
    afterValue,
    ...priceImpact,
    priceDiff: priceImpact.supplementAmount,
    estimatedDelayDays: delayDays,
    stageImpact,
    status: 'pending',
    refundNote: finalPriceDiff < 0 ? refundNote : undefined,
    createdAt: now,
    updatedAt: now,
  };

  store.changeOrders.unshift(newChange);

  res.status(201).json({
    success: true,
    data: {
      ...newChange,
      changeTypeLabel: CHANGE_TYPE_LABELS_CN[newChange.changeType],
      statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[newChange.status],
    },
  });
});

router.patch('/:id/confirm', (req: Request, res: Response) => {
  const idx = store.changeOrders.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '变更单不存在' });
  }

  const changeOrder = store.changeOrders[idx];

  if (changeOrder.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `变更单当前状态为「${CHANGE_ORDER_STATUS_LABELS_CN[changeOrder.status]}」，无法重复确认`,
    });
  }

  const { confirmedBy } = req.body;
  if (!confirmedBy) {
    return res.status(400).json({ success: false, message: '请填写确认人' });
  }

  const order = store.orders.find(o => o.id === changeOrder.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '关联订单不存在' });
  }

  if (order.status === 'shipping' || order.status === 'completed' || order.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: `订单已${ORDER_STATUS_LABELS_CN[order.status]}，无法确认变更单`,
    });
  }

  const finalValidation = validateChangeRequest(order, changeOrder.changeType, changeOrder.supplementAmount, changeOrder.refundNote);
  if (!finalValidation.valid) {
    return res.status(400).json({ success: false, message: finalValidation.message });
  }

  const now = new Date().toISOString();
  store.changeOrders[idx] = {
    ...changeOrder,
    status: 'confirmed',
    confirmedBy,
    confirmedAt: now,
    updatedAt: now,
  };

  const orderIdx = store.orders.findIndex(o => o.id === changeOrder.orderId);
  if (orderIdx !== -1) {
    const updatedOrder = applyChangeToOrder(store.orders[orderIdx], store.changeOrders[idx]);

    const historyItem: OrderStatusHistory = addOrderHistory(
      updatedOrder,
      updatedOrder.status,
      `需求变更已确认：${CHANGE_TYPE_LABELS_CN[changeOrder.changeType]}，${changeOrder.description}${changeOrder.supplementAmount !== 0 ? `，${changeOrder.supplementAmount > 0 ? '补款' : '退款'} ¥${Math.abs(changeOrder.supplementAmount)}` : ''}`,
      confirmedBy
    );
    updatedOrder.history.push(historyItem);
    updatedOrder.updatedAt = now;

    store.orders[orderIdx] = updatedOrder;

    const stageInfo = getStageInfo(updatedOrder.id);

    res.json({
      success: true,
      message: '变更单已确认，订单信息已更新',
      data: {
        changeOrder: {
          ...store.changeOrders[idx],
          changeTypeLabel: CHANGE_TYPE_LABELS_CN[store.changeOrders[idx].changeType],
          statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[store.changeOrders[idx].status],
        },
        updatedOrder: {
          ...updatedOrder,
          stageInfo,
        },
      },
    });
  } else {
    res.json({
      success: true,
      message: '变更单已确认',
      data: {
        changeOrder: {
          ...store.changeOrders[idx],
          changeTypeLabel: CHANGE_TYPE_LABELS_CN[store.changeOrders[idx].changeType],
          statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[store.changeOrders[idx].status],
        },
      },
    });
  }
});

router.patch('/:id/reject', (req: Request, res: Response) => {
  const idx = store.changeOrders.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '变更单不存在' });
  }

  const changeOrder = store.changeOrders[idx];

  if (changeOrder.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `变更单当前状态为「${CHANGE_ORDER_STATUS_LABELS_CN[changeOrder.status]}」，无法拒绝`,
    });
  }

  const { rejectedBy, rejectedReason } = req.body;
  if (!rejectedBy || !rejectedReason) {
    return res.status(400).json({ success: false, message: '请填写拒绝人和拒绝原因' });
  }

  const now = new Date().toISOString();
  store.changeOrders[idx] = {
    ...changeOrder,
    status: 'rejected',
    rejectedBy,
    rejectedReason,
    updatedAt: now,
  };

  res.json({
    success: true,
    message: '变更单已拒绝',
    data: {
      ...store.changeOrders[idx],
      changeTypeLabel: CHANGE_TYPE_LABELS_CN[store.changeOrders[idx].changeType],
      statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[store.changeOrders[idx].status],
    },
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const idx = store.changeOrders.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '变更单不存在' });
  }

  const changeOrder = store.changeOrders[idx];
  if (changeOrder.status === 'confirmed') {
    return res.status(400).json({
      success: false,
      message: '已确认的变更单无法删除，如需撤销请创建新的变更单',
    });
  }

  store.changeOrders.splice(idx, 1);
  res.json({ success: true, message: '变更单已删除' });
});

export default router;
