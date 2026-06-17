import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { FittingRecord, FittingStatus } from '../types';

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
  const now = new Date().toISOString();
  const existCount = store.fittingRecords.filter(f => f.orderId === req.body.orderId).length;
  const newRecord: FittingRecord = {
    id: `fitting-${uuidv4().slice(0, 8)}`,
    photos: [],
    fittingRound: existCount + 1,
    ...req.body,
    status: 'pending' as FittingStatus,
    createdAt: now,
    updatedAt: now,
  };
  store.fittingRecords.unshift(newRecord);
  res.status(201).json({ success: true, data: newRecord });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.fittingRecords.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  store.fittingRecords[idx] = {
    ...store.fittingRecords[idx],
    ...req.body,
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
  store.fittingRecords[idx].status = req.body.status as FittingStatus;
  if (req.body.customerFeedback) {
    store.fittingRecords[idx].customerFeedback = req.body.customerFeedback;
  }
  if (req.body.reworkSuggestions) {
    store.fittingRecords[idx].reworkSuggestions = req.body.reworkSuggestions;
  }
  store.fittingRecords[idx].updatedAt = new Date().toISOString();
  res.json({ success: true, data: store.fittingRecords[idx] });
});

export default router;
