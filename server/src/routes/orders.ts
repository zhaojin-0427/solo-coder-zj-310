import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { Order, OrderStatus, OrderStatusHistory, StageInfo } from '../types';
import {
  validateOrderTransition,
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
  }));
  res.json({ success: true, data: enriched });
});

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
  const { status, note, operator } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: '请指定目标状态' });
  }

  const currentStatus = store.orders[idx].status;
  const validation = validateOrderTransition(currentStatus, status as OrderStatus);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: validation.message });
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
  res.json({
    success: true,
    data: {
      ...store.orders[idx],
      stageInfo,
      stageTimeline,
      keyMilestones,
    },
  });
});

export default router;
