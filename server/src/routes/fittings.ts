import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { FittingRecord, FittingStatus, OrderStatus, OrderStatusHistory } from '../types';
import {
  validateFittingTransition,
  syncOrderStatusFromFitting,
  addOrderHistory,
  FITTING_STATUS_LABELS_CN,
  ORDER_STATUS_LABELS_CN,
  getStageInfo,
} from '../stateFlow';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, orderId } = req.query;
  let filtered = [...store.fittingRecords];
  if (status) {
    filtered = filtered.filter(f => f.status === status);
  }
  if (orderId) {
    filtered = filtered.filter(f => f.orderId === orderId);
  }
  const enriched = filtered.map(f => ({
    ...f,
    orderInfo: store.getOrderInfo(f.orderId),
  }));
  res.json({ success: true, data: enriched });
});

router.get('/:id', (req: Request, res: Response) => {
  const record = store.fittingRecords.find(f => f.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  res.json({
    success: true,
    data: {
      ...record,
      orderInfo: store.getOrderInfo(record.orderId),
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const { orderId, patternTaskId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, message: '请选择关联订单' });
  }

  const order = store.getOrderById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  if (!['sewing', 'fitting'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: `订单当前状态为「${ORDER_STATUS_LABELS_CN[order.status as OrderStatus]}」，需在缝制阶段或试穿阶段才能创建试穿记录。`,
    });
  }

  const now = new Date().toISOString();
  const existCount = store.fittingRecords.filter(f => f.orderId === orderId).length;
  const newRecord: FittingRecord = {
    id: `fitting-${uuidv4().slice(0, 8)}`,
    photos: [],
    fittingRound: existCount + 1,
    patternTaskId: patternTaskId || '',
    ...req.body,
    status: req.body.status || 'pending' as FittingStatus,
    createdAt: now,
    updatedAt: now,
  };
  store.fittingRecords.unshift(newRecord);

  const syncResult = syncOrderStatusFromFitting(orderId, newRecord.status);
  if (syncResult.shouldUpdate && syncResult.newStatus) {
    const orderIdx = store.orders.findIndex(o => o.id === orderId);
    if (orderIdx !== -1) {
      const historyItem: OrderStatusHistory = addOrderHistory(
        store.orders[orderIdx],
        syncResult.newStatus,
        syncResult.note,
        '系统自动同步'
      );
      store.orders[orderIdx].status = syncResult.newStatus;
      store.orders[orderIdx].history.push(historyItem);
      store.orders[orderIdx].updatedAt = now;
    }
  }

  const stageInfo = getStageInfo(orderId);
  res.status(201).json({
    success: true,
    data: {
      record: newRecord,
      stageInfo,
    },
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.fittingRecords.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  const { status, ...restBody } = req.body;
  if (status && status !== store.fittingRecords[idx].status) {
    return res.status(400).json({
      success: false,
      message: '请使用 PATCH /fittings/:id/status 接口变更试穿记录状态',
    });
  }
  store.fittingRecords[idx] = {
    ...store.fittingRecords[idx],
    ...restBody,
    id: store.fittingRecords[idx].id,
    createdAt: store.fittingRecords[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: store.fittingRecords[idx] });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const idx = store.fittingRecords.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  const { status, customerFeedback, reworkSuggestions } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: '请指定目标状态' });
  }

  const currentStatus = store.fittingRecords[idx].status;
  const validation = validateFittingTransition(currentStatus, status as FittingStatus);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const now = new Date().toISOString();
  store.fittingRecords[idx].status = status as FittingStatus;
  if (customerFeedback) {
    store.fittingRecords[idx].customerFeedback = customerFeedback;
  }
  if (reworkSuggestions) {
    store.fittingRecords[idx].reworkSuggestions = reworkSuggestions;
  }
  store.fittingRecords[idx].updatedAt = now;

  const orderId = store.fittingRecords[idx].orderId;
  const syncResult = syncOrderStatusFromFitting(orderId, status as FittingStatus);
  if (syncResult.shouldUpdate && syncResult.newStatus) {
    const orderIdx = store.orders.findIndex(o => o.id === orderId);
    if (orderIdx !== -1) {
      const historyItem: OrderStatusHistory = addOrderHistory(
        store.orders[orderIdx],
        syncResult.newStatus,
        syncResult.note,
        '系统自动同步'
      );
      store.orders[orderIdx].status = syncResult.newStatus;
      store.orders[orderIdx].history.push(historyItem);
      store.orders[orderIdx].updatedAt = now;
    }
  }

  if (status === 'rework_needed') {
    const patternTaskId = store.fittingRecords[idx].patternTaskId;
    if (patternTaskId) {
      const patternIdx = store.patternTasks.findIndex(p => p.id === patternTaskId);
      if (patternIdx !== -1) {
        store.patternTasks[patternIdx].reworkCount += 1;
        store.patternTasks[patternIdx].status = 'in_progress';
        store.patternTasks[patternIdx].updatedAt = now;
      }
    }
  }

  const stageInfo = getStageInfo(orderId);
  res.json({
    success: true,
    data: {
      record: store.fittingRecords[idx],
      stageInfo,
    },
  });
});

export default router;
