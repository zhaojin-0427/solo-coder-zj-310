import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { FabricInventory, FabricPreoccupyRecord, FabricPreoccupyStatus, FABRIC_PREOCCUPY_STATUS_LABELS, PURCHASE_SUGGESTION_STATUS_LABELS } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { fabricName, color, supplier, lowStock } = req.query;
  let filtered = [...store.fabricInventories];

  if (fabricName) {
    filtered = filtered.filter(f => f.fabricName.includes(fabricName as string));
  }
  if (color) {
    filtered = filtered.filter(f => f.color.includes(color as string));
  }
  if (supplier) {
    filtered = filtered.filter(f => f.supplier.includes(supplier as string));
  }
  if (lowStock === 'true') {
    filtered = filtered.filter(f => store.getAvailableStock(f.id) < f.safetyStock);
  }

  const enriched = filtered.map(f => ({
    ...f,
    availableStock: store.getAvailableStock(f.id),
    preoccupiedLength: store.getFabricPreoccupiedLength(f.id),
    isLowStock: store.getAvailableStock(f.id) < f.safetyStock,
    inventoryValue: Number((f.stockLength * f.unitPrice).toFixed(2)),
  }));

  res.json({ success: true, data: enriched });
});

router.get('/stats', (req: Request, res: Response) => {
  const stats = store.getFabricInventoryStats();
  res.json({ success: true, data: stats });
});

router.get('/purchase-suggestions', (req: Request, res: Response) => {
  const suggestions = store.generatePurchaseSuggestions();
  const enriched = suggestions.map(s => ({
    ...s,
    statusLabel: PURCHASE_SUGGESTION_STATUS_LABELS[s.status] || s.status,
  }));
  res.json({ success: true, data: enriched });
});

router.patch('/purchase-suggestions/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const idx = store.purchaseSuggestions.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '采购建议不存在' });
  }
  if (!['pending', 'ordered', 'completed'].includes(status)) {
    return res.status(400).json({ success: false, message: '无效的采购建议状态' });
  }
  store.purchaseSuggestions[idx].status = status as any;
  store.purchaseSuggestions[idx].updatedAt = new Date().toISOString();
  res.json({ success: true, data: store.purchaseSuggestions[idx] });
});

router.get('/:id', (req: Request, res: Response) => {
  const fabric = store.fabricInventories.find(f => f.id === req.params.id);
  if (!fabric) {
    return res.status(404).json({ success: false, message: '布料库存不存在' });
  }

  const preoccupyRecords = store.fabricPreoccupyRecords
    .filter(r => r.fabricInventoryId === fabric.id)
    .map(r => ({
      ...r,
      statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS[r.status],
    }));
  const adjustRecords = store.fabricAdjustRecords
    .filter(r => r.fabricInventoryId === fabric.id)
    .slice(0, 50);

  res.json({
    success: true,
    data: {
      ...fabric,
      availableStock: store.getAvailableStock(fabric.id),
      preoccupiedLength: store.getFabricPreoccupiedLength(fabric.id),
      isLowStock: store.getAvailableStock(fabric.id) < fabric.safetyStock,
      preoccupyRecords,
      adjustRecords,
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const { fabricName, color, width, stockLength, safetyStock, supplier, purchaseCycle, unitPrice, unit, remark } = req.body;
  if (!fabricName || !color || stockLength === undefined || !supplier) {
    return res.status(400).json({ success: false, message: '请填写必填项：布料名称、颜色、库存长度、供应商' });
  }

  const now = new Date().toISOString();
  const newFabric: FabricInventory = {
    id: `fabric-${uuidv4().slice(0, 8)}`,
    fabricName,
    color,
    width: Number(width) || 0,
    stockLength: Number(stockLength) || 0,
    safetyStock: Number(safetyStock) || 0,
    supplier,
    purchaseCycle: Number(purchaseCycle) || 7,
    unitPrice: Number(unitPrice) || 0,
    unit: unit || 'meter',
    remark,
    createdAt: now,
    updatedAt: now,
  };
  store.fabricInventories.unshift(newFabric);

  if (newFabric.stockLength > 0) {
    store.addFabricAdjustRecord(
      newFabric.id,
      'stock_in',
      newFabric.stockLength,
      0,
      newFabric.stockLength,
      '系统',
      '初始入库'
    );
  }

  res.status(201).json({ success: true, data: newFabric });
});

router.put('/:id', (req: Request, res: Response) => {
  const idx = store.fabricInventories.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '布料库存不存在' });
  }

  const { id, createdAt, stockLength: _stockLength, ...rest } = req.body;
  store.fabricInventories[idx] = {
    ...store.fabricInventories[idx],
    ...rest,
    id: store.fabricInventories[idx].id,
    createdAt: store.fabricInventories[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };

  res.json({ success: true, data: store.fabricInventories[idx] });
});

router.delete('/:id', (req: Request, res: Response) => {
  const idx = store.fabricInventories.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '布料库存不存在' });
  }
  const preoccupied = store.getFabricPreoccupiedLength(req.params.id);
  if (preoccupied > 0) {
    return res.status(400).json({ success: false, message: `该布料尚有 ${preoccupied} 米预占，无法删除` });
  }
  store.fabricInventories.splice(idx, 1);
  res.json({ success: true, message: '删除成功' });
});

router.post('/:id/stock-in', (req: Request, res: Response) => {
  const idx = store.fabricInventories.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '布料库存不存在' });
  }
  const { length, operator, remark } = req.body;
  const changeLength = Number(length);
  if (!changeLength || changeLength <= 0) {
    return res.status(400).json({ success: false, message: '请输入有效的入库长度' });
  }

  const beforeStock = store.fabricInventories[idx].stockLength;
  const afterStock = Number((beforeStock + changeLength).toFixed(2));

  store.fabricInventories[idx].stockLength = afterStock;
  store.fabricInventories[idx].updatedAt = new Date().toISOString();

  const adjustRecord = store.addFabricAdjustRecord(
    store.fabricInventories[idx].id,
    'stock_in',
    changeLength,
    beforeStock,
    afterStock,
    operator || '系统',
    remark || '入库',
  );

  res.json({
    success: true,
    data: {
      fabric: store.fabricInventories[idx],
      adjustRecord,
    },
  });
});

router.post('/:id/manual-adjust', (req: Request, res: Response) => {
  const idx = store.fabricInventories.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '布料库存不存在' });
  }
  const { newStock, operator, remark } = req.body;
  const targetStock = Number(newStock);
  if (targetStock < 0 || isNaN(targetStock)) {
    return res.status(400).json({ success: false, message: '请输入有效的库存长度' });
  }

  const beforeStock = store.fabricInventories[idx].stockLength;
  const changeLength = Number((targetStock - beforeStock).toFixed(2));

  store.fabricInventories[idx].stockLength = targetStock;
  store.fabricInventories[idx].updatedAt = new Date().toISOString();

  const adjustRecord = store.addFabricAdjustRecord(
    store.fabricInventories[idx].id,
    'manual_adjust',
    changeLength,
    beforeStock,
    targetStock,
    operator || '系统',
    remark || '手动调整',
  );

  res.json({
    success: true,
    data: {
      fabric: store.fabricInventories[idx],
      adjustRecord,
    },
  });
});

router.post('/preoccupy', (req: Request, res: Response) => {
  const { fabricInventoryId, orderId, patternTaskId, length, operator, remark } = req.body;
  if (!fabricInventoryId || !orderId || !patternTaskId || !length) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const fabric = store.fabricInventories.find(f => f.id === fabricInventoryId);
  if (!fabric) {
    return res.status(404).json({ success: false, message: '布料库存不存在' });
  }
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const preoccupyLength = Number(length);
  if (preoccupyLength <= 0) {
    return res.status(400).json({ success: false, message: '预占长度必须大于0' });
  }

  const available = store.getAvailableStock(fabricInventoryId);
  let status: FabricPreoccupyStatus = 'preoccupied';
  if (available < preoccupyLength) {
    status = 'pending_purchase';
  }

  const now = new Date().toISOString();
  const record: FabricPreoccupyRecord = {
    id: `preoccupy-${uuidv4().slice(0, 8)}`,
    fabricInventoryId,
    fabricName: fabric.fabricName,
    color: fabric.color,
    orderId,
    orderNumber: order.orderNumber,
    patternTaskId,
    preoccupyLength,
    unit: fabric.unit,
    status,
    remark: remark || '打版预占',
    createdAt: now,
    updatedAt: now,
  };
  store.fabricPreoccupyRecords.unshift(record);

  res.status(201).json({
    success: true,
    data: {
      ...record,
      statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS[status],
      availableStock: available,
      isInsufficient: status === 'pending_purchase',
    },
  });
});

router.post('/:id/release-preoccupy', (req: Request, res: Response) => {
  const { preoccupyId, operator, remark } = req.body;
  if (!preoccupyId) {
    return res.status(400).json({ success: false, message: '请指定要释放的预占记录' });
  }

  const pIdx = store.fabricPreoccupyRecords.findIndex(r => r.id === preoccupyId);
  if (pIdx === -1) {
    return res.status(404).json({ success: false, message: '预占记录不存在' });
  }
  if (store.fabricPreoccupyRecords[pIdx].status === 'released' || store.fabricPreoccupyRecords[pIdx].status === 'consumed') {
    return res.status(400).json({ success: false, message: '该预占记录已释放或已消耗' });
  }

  const record = store.fabricPreoccupyRecords[pIdx];
  const fabric = store.fabricInventories.find(f => f.id === record.fabricInventoryId);

  store.fabricPreoccupyRecords[pIdx].status = 'released';
  store.fabricPreoccupyRecords[pIdx].updatedAt = new Date().toISOString();
  store.fabricPreoccupyRecords[pIdx].remark = remark || store.fabricPreoccupyRecords[pIdx].remark;

  if (fabric) {
    store.addFabricAdjustRecord(
      fabric.id,
      'release_preoccupy',
      record.preoccupyLength,
      fabric.stockLength,
      fabric.stockLength,
      operator || '系统',
      remark || '释放预占',
      record.orderId,
      record.patternTaskId
    );
  }

  res.json({
    success: true,
    data: {
      ...store.fabricPreoccupyRecords[pIdx],
      statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS['released'],
    },
  });
});

router.post('/release-by-order/:orderId', (req: Request, res: Response) => {
  const { operator, remark } = req.body;
  const order = store.orders.find(o => o.id === req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const released: FabricPreoccupyRecord[] = [];
  store.fabricPreoccupyRecords.forEach((record, idx) => {
    if (record.orderId === req.params.orderId && (record.status === 'preoccupied' || record.status === 'pending_purchase')) {
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
          operator || '系统',
          remark || '订单取消释放预占',
          record.orderId,
          record.patternTaskId
        );
      }
    }
  });

  res.json({ success: true, data: { releasedCount: released.length, records: released } });
});

router.post('/consume-by-pattern/:patternTaskId', (req: Request, res: Response) => {
  const { operator, remark } = req.body;
  const pattern = store.patternTasks.find(p => p.id === req.params.patternTaskId);
  if (!pattern) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }

  const consumed: FabricPreoccupyRecord[] = [];
  store.fabricPreoccupyRecords.forEach((record, idx) => {
    if (record.patternTaskId === req.params.patternTaskId && (record.status === 'preoccupied' || record.status === 'pending_purchase')) {
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
          operator || '系统',
          remark || '裁剪消耗',
          record.orderId,
          record.patternTaskId
        );
      }
    }
  });

  res.json({ success: true, data: { consumedCount: consumed.length, records: consumed } });
});

router.get('/by-pattern/:patternTaskId', (req: Request, res: Response) => {
  const records = store.getPreoccupyRecordsByPattern(req.params.patternTaskId).map(r => ({
    ...r,
    statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS[r.status],
  }));
  res.json({ success: true, data: records });
});

router.get('/by-order/:orderId', (req: Request, res: Response) => {
  const records = store.getPreoccupyRecordsByOrder(req.params.orderId).map(r => ({
    ...r,
    statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS[r.status],
  }));
  res.json({ success: true, data: records });
});

export default router;
