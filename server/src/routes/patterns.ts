import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { PatternTask, OrderStatus, OrderStatusHistory } from '../types';
import {
  validatePatternTransition,
  syncOrderStatusFromPattern,
  addOrderHistory,
  PATTERN_STATUS_LABELS_CN,
  ORDER_STATUS_LABELS_CN,
  getStageInfo,
} from '../stateFlow';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, orderId, designer } = req.query;
  let filtered = [...store.patternTasks];
  if (status) {
    filtered = filtered.filter(p => p.status === status);
  }
  if (orderId) {
    filtered = filtered.filter(p => p.orderId === orderId);
  }
  if (designer) {
    filtered = filtered.filter(p => p.designer.includes(designer as string));
  }
  const enriched = filtered.map(p => ({
    ...p,
    orderInfo: store.getOrderInfo(p.orderId),
  }));
  res.json({ success: true, data: enriched });
});

router.get('/:id', (req: Request, res: Response) => {
  const task = store.patternTasks.find(p => p.id === req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  res.json({
    success: true,
    data: {
      ...task,
      orderInfo: store.getOrderInfo(task.orderId),
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, message: '请选择关联订单' });
  }
  const canCreate = store.canCreatePattern(orderId);
  if (!canCreate.allowed) {
    return res.status(400).json({ success: false, message: canCreate.reason });
  }

  const now = new Date().toISOString();
  const newTask: PatternTask = {
    id: `pattern-${uuidv4().slice(0, 8)}`,
    ...req.body,
    status: req.body.status || 'pending',
    reworkCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  store.patternTasks.unshift(newTask);

  const syncResult = syncOrderStatusFromPattern(orderId, newTask.status, true);
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
      task: newTask,
      stageInfo,
    },
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }

  const { status, ...restBody } = req.body;
  if (status && status !== store.patternTasks[idx].status) {
    return res.status(400).json({
      success: false,
      message: '请使用状态专用接口变更打版任务状态',
    });
  }

  store.patternTasks[idx] = {
    ...store.patternTasks[idx],
    ...restBody,
    id: store.patternTasks[idx].id,
    createdAt: store.patternTasks[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: store.patternTasks[idx] });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: '请指定目标状态' });
  }

  const currentStatus = store.patternTasks[idx].status;
  const validation = validatePatternTransition(currentStatus, status);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const now = new Date().toISOString();
  store.patternTasks[idx].status = status;
  store.patternTasks[idx].updatedAt = now;

  const orderId = store.patternTasks[idx].orderId;
  const syncResult = syncOrderStatusFromPattern(orderId, status);
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
  res.json({
    success: true,
    data: {
      task: store.patternTasks[idx],
      stageInfo,
    },
  });
});

router.patch('/:id/rework', (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  const now = new Date().toISOString();
  store.patternTasks[idx].reworkCount += 1;
  store.patternTasks[idx].status = 'in_progress';
  store.patternTasks[idx].updatedAt = now;

  const orderId = store.patternTasks[idx].orderId;
  const orderIdx = store.orders.findIndex(o => o.id === orderId);
  if (orderIdx !== -1 && store.orders[orderIdx].status !== 'pattern_making') {
    if (['fitting', 'sewing', 'fabric_prep'].includes(store.orders[orderIdx].status)) {
      const historyItem: OrderStatusHistory = addOrderHistory(
        store.orders[orderIdx],
        'pattern_making',
        `打版任务返工（第${store.patternTasks[idx].reworkCount}次），订单回退至打版阶段`,
        '系统自动同步'
      );
      store.orders[orderIdx].status = 'pattern_making';
      store.orders[orderIdx].history.push(historyItem);
      store.orders[orderIdx].updatedAt = now;
    }
  }

  const stageInfo = getStageInfo(orderId);
  res.json({
    success: true,
    data: {
      task: store.patternTasks[idx],
      stageInfo,
    },
  });
});

export default router;
