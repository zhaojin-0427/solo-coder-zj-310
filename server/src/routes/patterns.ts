import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { PatternTask } from '../types';

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
  res.status(201).json({ success: true, data: newTask });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  store.patternTasks[idx] = {
    ...store.patternTasks[idx],
    ...req.body,
    id: store.patternTasks[idx].id,
    createdAt: store.patternTasks[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: store.patternTasks[idx] });
});

router.patch('/:id/rework', (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  store.patternTasks[idx].reworkCount += 1;
  store.patternTasks[idx].status = 'in_progress';
  store.patternTasks[idx].updatedAt = new Date().toISOString();
  res.json({ success: true, data: store.patternTasks[idx] });
});

export default router;
