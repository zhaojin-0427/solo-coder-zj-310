import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { Order, OrderStatus, OrderStatusHistory, StageInfo, FABRIC_PREOCCUPY_STATUS_LABELS } from '../types';
import {
  validateOrderTransitionWithBusinessCheck,
  addOrderHistory,
  getStageInfo,
  getStageTimeline,
  getKeyMilestones,
  ORDER_STATUS_LABELS_CN,
} from '../stateFlow';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, customerName, dollId } = req.query;
  let filtered = [...store.orders];
  if (status) {
    filtered = filtered.filter(o => o.status === status);
  }
  if (customerName) {
    filtered = filtered.filter(o => o.customerName.includes(customerName as string));
  }
  if (dollId) {
    filtered = filtered.filter(o => o.dollTemplateId === dollId);
  }
  const enriched = filtered.map(o => ({
    ...o,
    dollName: store.getDollName(o.dollTemplateId),
    stageInfo: getStageInfo(o.id),
  }));
  res.json({ success: true, data: enriched });
});

const CHANNEL_LABELS_CN: Record<string, string> = {
  wechat: '微信',
  phone: '电话',
  face: '面谈',
  email: '邮件',
  other: '其他',
};

const CHANGE_TYPE_LABELS_CN: Record<string, string> = {
  fabric: '更换布料',
  accessory: '增减配件',
  style: '调整风格',
  delivery_date: '修改交付日期',
  quantity: '追加套装件数',
};

const CHANGE_ORDER_STATUS_LABELS_CN: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
};

router.get('/:id', (req: Request, res: Response) => {
  const order = store.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const stageInfo = getStageInfo(order.id);
  const stageTimeline = getStageTimeline(order.id);
  const keyMilestones = getKeyMilestones(order.id);
  const patternTasks = store.patternTasks.filter(p => p.orderId === order.id);
  const fittingRecords = store.fittingRecords.filter(f => f.orderId === order.id);
  const communications = store.communications
    .filter(c => c.orderId === order.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(c => ({ ...c, channelLabel: CHANNEL_LABELS_CN[c.channel] || c.channel }));
  const changeOrders = store.changeOrders
    .filter(c => c.orderId === order.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(c => ({
      ...c,
      changeTypeLabel: CHANGE_TYPE_LABELS_CN[c.changeType] || c.changeType,
      statusLabel: CHANGE_ORDER_STATUS_LABELS_CN[c.status] || c.status,
    }));
  const pendingChangeCount = changeOrders.filter(c => c.status === 'pending').length;
  const fabricPreoccupyRecords = store.fabricPreoccupyRecords
    .filter(r => r.orderId === order.id)
    .map(r => ({
      ...r,
      statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS[r.status] || r.status,
    }));
  res.json({
    success: true,
    data: {
      ...order,
      dollName: store.getDollName(order.dollTemplateId),
      stageInfo,
      stageTimeline,
      keyMilestones,
      patternTasks,
      fittingRecords,
      communications,
      changeOrders,
      pendingChangeCount,
      fabricPreoccupyRecords,
    },
  });
});

router.get('/:id/stage-info', (req: Request, res: Response) => {
  const order = store.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const stageInfo = getStageInfo(order.id);
  res.json({ success: true, data: stageInfo });
});

router.post('/', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const orderCount = store.orders.length + 1;
  const dateStr = now.slice(0, 10).replace(/-/g, '');
  const history: OrderStatusHistory[] = [
    { status: 'pending', timestamp: now, note: '客户提交订单', operator: '客户' },
  ];
  const newOrder: Order = {
    id: `order-${uuidv4().slice(0, 8)}`,
    orderNumber: `BJD${dateStr}${String(orderCount).padStart(3, '0')}`,
    ...req.body,
    status: 'pending' as OrderStatus,
    history,
    createdAt: now,
    updatedAt: now,
  };
  store.orders.unshift(newOrder);
  res.status(201).json({ success: true, data: newOrder });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const { status, ...restBody } = req.body;
  if (status && status !== store.orders[idx].status) {
    return res.status(400).json({
      success: false,
      message: '请使用 PATCH /orders/:id/status 接口变更订单状态',
    });
  }
  store.orders[idx] = {
    ...store.orders[idx],
    ...restBody,
    id: store.orders[idx].id,
    createdAt: store.orders[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: store.orders[idx] });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const idx = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const currentStatus = store.orders[idx].status;
  const { status, note, operator } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: '请指定目标状态' });
  }

  const validation = validateOrderTransitionWithBusinessCheck(
    store.orders[idx].id,
    status as OrderStatus
  );
  if (!validation.success) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const orderId = store.orders[idx].id;
  let fabricActionResult: any = null;
  
  if (status === 'cancelled') {
    fabricActionResult = releaseFabricByOrder(orderId, operator || '系统操作', '订单取消，释放所有布料预占');
  }
  
  if (status === 'completed') {
    fabricActionResult = consumeRemainingFabricByOrder(orderId, operator || '系统操作', '订单完成，确认剩余布料消耗');
  }

  const historyItem: OrderStatusHistory = addOrderHistory(
    store.orders[idx],
    status as OrderStatus,
    note || `状态变更：${ORDER_STATUS_LABELS_CN[currentStatus]} → ${ORDER_STATUS_LABELS_CN[status as OrderStatus]}`,
    operator || '系统操作'
  );
  store.orders[idx].status = status as OrderStatus;
  store.orders[idx].history.push(historyItem);
  store.orders[idx].updatedAt = new Date().toISOString();

  const stageInfo = getStageInfo(store.orders[idx].id);
  const stageTimeline = getStageTimeline(store.orders[idx].id);
  const keyMilestones = getKeyMilestones(store.orders[idx].id);
  
  let message = '状态更新成功';
  if (fabricActionResult && fabricActionResult.message) {
    message = fabricActionResult.message;
  }
  
  res.json({
    success: true,
    message,
    data: {
      ...store.orders[idx],
      stageInfo,
      stageTimeline,
      keyMilestones,
      fabricAction: fabricActionResult,
    },
  });
});

function releaseFabricByOrder(orderId: string, operator: string, remark: string) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  const released: any[] = [];
  store.fabricPreoccupyRecords.forEach((record, idx) => {
    if (record.orderId === orderId && (record.status === 'preoccupied' || record.status === 'pending_purchase')) {
      store.fabricPreoccupyRecords[idx].status = 'released';
      store.fabricPreoccupyRecords[idx].updatedAt = new Date().toISOString();
      store.fabricPreoccupyRecords[idx].remark = remark || record.remark;
      released.push(store.fabricPreoccupyRecords[idx]);

      const fabric = store.fabricInventories.find(f => f.id === record.fabricInventoryId);
      if (fabric) {
        store.addFabricAdjustRecord(
          fabric.id,
          'release_preoccupy',
          record.preoccupyLength,
          fabric.stockLength,
          fabric.stockLength,
          operator,
          remark || '订单取消释放预占',
          record.orderId,
          record.patternTaskId
        );
      }
    }
  });

  store.generatePurchaseSuggestions();

  return {
    success: true,
    message: `订单已取消，已释放 ${released.length} 种布料的预占，共 ${released.reduce((sum, r) => sum + r.preoccupyLength, 0).toFixed(2)} 米`,
    releasedCount: released.length,
    records: released,
  };
}

function consumeRemainingFabricByOrder(orderId: string, operator: string, remark: string) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  const consumed: any[] = [];
  store.fabricPreoccupyRecords.forEach((record, idx) => {
    if (record.orderId === orderId && (record.status === 'preoccupied' || record.status === 'pending_purchase')) {
      store.fabricPreoccupyRecords[idx].status = 'consumed';
      store.fabricPreoccupyRecords[idx].updatedAt = new Date().toISOString();
      store.fabricPreoccupyRecords[idx].remark = remark || record.remark;
      consumed.push(store.fabricPreoccupyRecords[idx]);

      const fabricIdx = store.fabricInventories.findIndex(f => f.id === record.fabricInventoryId);
      if (fabricIdx !== -1) {
        const beforeStock = store.fabricInventories[fabricIdx].stockLength;
        const afterStock = Number((beforeStock - record.preoccupyLength).toFixed(2));
        store.fabricInventories[fabricIdx].stockLength = Math.max(0, afterStock);
        store.fabricInventories[fabricIdx].updatedAt = new Date().toISOString();

        store.addFabricAdjustRecord(
          store.fabricInventories[fabricIdx].id,
          'consume',
          -record.preoccupyLength,
          beforeStock,
          store.fabricInventories[fabricIdx].stockLength,
          operator,
          remark || '订单完成消耗',
          record.orderId,
          record.patternTaskId
        );
      }
    }
  });

  store.generatePurchaseSuggestions();

  return {
    success: true,
    message: `订单已完成，已消耗 ${consumed.length} 种布料，共 ${consumed.reduce((sum, r) => sum + r.preoccupyLength, 0).toFixed(2)} 米`,
    consumedCount: consumed.length,
    records: consumed,
  };
}

export default router;
