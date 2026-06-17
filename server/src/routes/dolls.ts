import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { DollTemplate } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { brand, model } = req.query;
  let filtered = [...store.dolls];
  if (brand) {
    filtered = filtered.filter(d => d.brand.toLowerCase().includes((brand as string).toLowerCase()));
  }
  if (model) {
    filtered = filtered.filter(d => d.model.toLowerCase().includes((model as string).toLowerCase()));
  }
  res.json({ success: true, data: filtered });
});

router.get('/:id', (req: Request, res: Response) => {
  const doll = store.dolls.find(d => d.id === req.params.id);
  if (!doll) {
    return res.status(404).json({ success: false, message: '娃体模板不存在' });
  }
  res.json({ success: true, data: doll });
});

router.post('/', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const newDoll: DollTemplate = {
    id: `doll-${uuidv4().slice(0, 8)}`,
    ...req.body,
    createdAt: now,
    updatedAt: now,
  };
  store.dolls.push(newDoll);
  res.status(201).json({ success: true, data: newDoll });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.dolls.findIndex(d => d.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '娃体模板不存在' });
  }
  store.dolls[idx] = {
    ...store.dolls[idx],
    ...req.body,
    id: store.dolls[idx].id,
    createdAt: store.dolls[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: store.dolls[idx] });
});

router.delete('/:id', (req: Request, res: Response) => {
  const idx = store.dolls.findIndex(d => d.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '娃体模板不存在' });
  }
  store.dolls.splice(idx, 1);
  res.json({ success: true, message: '已删除' });
});

export default router;
