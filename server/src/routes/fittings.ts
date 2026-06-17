import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mockFittingRecords, mockOrders, mockDollTemplates, mockPatternTasks } from '../data';
import { FittingRecord, FittingStatus } from '../types';

const router = Router();
let fittingRecords: FittingRecord[] = [...mockFittingRecords];

const getInfo = (orderId: string) => {
  const order = mockOrders.find(o => o.id === orderId);
  if (!order) return null;
  const doll = mockDollTemplates.find(d => d.id === order.dollTemplateId);
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    dollName: doll ? `${doll.brand} ${doll.model}` : order.dollTemplateId,
    styleTags: order.styleTags,
    deliveryDate: order.deliveryDate,
  };
};

router.get('/', (req: Request, res: Response) => {
  const { status, orderId } = req.query;
  let filtered = [...fittingRecords];
  if (status) {
    filtered = filtered.filter(f => f.status === status);
  }
  if (orderId) {
    filtered = filtered.filter(f => f.orderId === orderId);
  }
  const enriched = filtered.map(f => ({
    ...f,
    orderInfo: getInfo(f.orderId),
  }));
  res.json({ success: true, data: enriched });
});

router.get('/:id', (req: Request, res: Response) => {
  const record = fittingRecords.find(f => f.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  res.json({
    success: true,
    data: {
      ...record,
      orderInfo: getInfo(record.orderId),
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const existCount = fittingRecords.filter(f => f.orderId === req.body.orderId).length;
  const newRecord: FittingRecord = {
    id: `fitting-${uuidv4().slice(0, 8)}`,
    photos: [],
    fittingRound: existCount + 1,
    ...req.body,
    status: 'pending' as FittingStatus,
    createdAt: now,
    updatedAt: now,
  };
  fittingRecords.unshift(newRecord);
  res.status(201).json({ success: true, data: newRecord });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = fittingRecords.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  fittingRecords[idx] = {
    ...fittingRecords[idx],
    ...req.body,
    id: fittingRecords[idx].id,
    createdAt: fittingRecords[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: fittingRecords[idx] });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const idx = fittingRecords.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '试穿记录不存在' });
  }
  fittingRecords[idx].status = req.body.status as FittingStatus;
  if (req.body.customerFeedback) {
    fittingRecords[idx].customerFeedback = req.body.customerFeedback;
  }
  if (req.body.reworkSuggestions) {
    fittingRecords[idx].reworkSuggestions = req.body.reworkSuggestions;
  }
  fittingRecords[idx].updatedAt = new Date().toISOString();
  res.json({ success: true, data: fittingRecords[idx] });
});

export default router;
