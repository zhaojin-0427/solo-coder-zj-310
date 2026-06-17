import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { CommunicationRecord, CommunicationChannel } from '../types';

const router = Router();

const CHANNEL_LABELS_CN: Record<CommunicationChannel, string> = {
  wechat: '微信',
  phone: '电话',
  face: '面谈',
  email: '邮件',
  other: '其他',
};

router.get('/', (req: Request, res: Response) => {
  const { orderId } = req.query;
  let filtered = [...store.communications];
  if (orderId) {
    filtered = filtered.filter(c => c.orderId === orderId);
  }
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const enriched = filtered.map(c => ({
    ...c,
    channelLabel: CHANNEL_LABELS_CN[c.channel],
  }));
  res.json({ success: true, data: enriched });
});

router.get('/:id', (req: Request, res: Response) => {
  const comm = store.communications.find(c => c.id === req.params.id);
  if (!comm) {
    return res.status(404).json({ success: false, message: '沟通记录不存在' });
  }
  res.json({
    success: true,
    data: {
      ...comm,
      channelLabel: CHANNEL_LABELS_CN[comm.channel],
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const { orderId, channel, content, imagePlaceholders, conclusion, follower } = req.body;

  if (!orderId || !channel || !content || !follower) {
    return res.status(400).json({
      success: false,
      message: '请填写必填项：关联订单、沟通渠道、沟通内容、跟进人',
    });
  }

  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '关联订单不存在' });
  }

  const validChannels: CommunicationChannel[] = ['wechat', 'phone', 'face', 'email', 'other'];
  if (!validChannels.includes(channel)) {
    return res.status(400).json({ success: false, message: '沟通渠道无效，请选择：微信、电话、面谈、邮件或其他' });
  }

  const now = new Date().toISOString();
  const newComm: CommunicationRecord = {
    id: `comm-${uuidv4().slice(0, 8)}`,
    orderId,
    channel,
    content,
    imagePlaceholders: imagePlaceholders || [],
    conclusion: conclusion || '',
    follower,
    createdAt: now,
    updatedAt: now,
  };

  store.communications.unshift(newComm);
  res.status(201).json({
    success: true,
    data: {
      ...newComm,
      channelLabel: CHANNEL_LABELS_CN[newComm.channel],
    },
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.communications.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '沟通记录不存在' });
  }

  const { channel, content, imagePlaceholders, conclusion, follower } = req.body;

  if (channel) {
    const validChannels: CommunicationChannel[] = ['wechat', 'phone', 'face', 'email', 'other'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ success: false, message: '沟通渠道无效' });
    }
  }

  store.communications[idx] = {
    ...store.communications[idx],
    ...(channel && { channel }),
    ...(content !== undefined && { content }),
    ...(imagePlaceholders !== undefined && { imagePlaceholders }),
    ...(conclusion !== undefined && { conclusion }),
    ...(follower !== undefined && { follower }),
    updatedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: {
      ...store.communications[idx],
      channelLabel: CHANNEL_LABELS_CN[store.communications[idx].channel],
    },
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const idx = store.communications.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '沟通记录不存在' });
  }
  store.communications.splice(idx, 1);
  res.json({ success: true, message: '沟通记录已删除' });
});

export default router;
