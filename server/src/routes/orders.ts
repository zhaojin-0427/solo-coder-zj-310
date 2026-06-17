import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mockOrders, mockDollTemplates } from '../data';
import { Order, OrderStatus, OrderStatusHistory } from '../types';

const router = Router();
let orders: Order[] = [...mockOrders];

const getDollName = (id: string) => {
  const d = mockDollTemplates.find(x => x.id === id);
  return d ? `${d.brand} ${d.model}` : id;
};

router.get('/', (req: Request, res: Response) => {
  const { status, customerName, dollId } = req.query;
  let filtered = [...orders];
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
    dollName: getDollName(o.dollTemplateId),
  }));
  res.json({ success: true, data: enriched });
});

router.get('/:id', (req: Request, res: Response) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  res.json({
    success: true,
    data: {
      ...order,
      dollName: getDollName(order.dollTemplateId),
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const orderCount = orders.length + 1;
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
  orders.unshift(newOrder);
  res.status(201).json({ success: true, data: newOrder });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  orders[idx] = {
    ...orders[idx],
    ...req.body,
    id: orders[idx].id,
    createdAt: orders[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: orders[idx] });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const { status, note, operator } = req.body;
  const historyItem: OrderStatusHistory = {
    status,
    timestamp: new Date().toISOString(),
    note,
    operator: operator || '系统',
  };
  orders[idx].status = status as OrderStatus;
  orders[idx].history.push(historyItem);
  orders[idx].updatedAt = new Date().toISOString();
  res.json({ success: true, data: orders[idx] });
});

export default router;
