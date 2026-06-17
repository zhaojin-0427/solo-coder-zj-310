import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { PatternTask, OrderStatus, OrderStatusHistory, FabricPreoccupyStatus, FABRIC_PREOCCUPY_STATUS_LABELS } from '../types';
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

router.post('/', async (req: Request, res: Response) => {
  const { orderId, fabricUsage, operator } = req.body;
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

  const preoccupyResults: any[] = [];
  const insufficientFabrics: any[] = [];
  
  if (fabricUsage && Array.isArray(fabricUsage) && fabricUsage.length > 0) {
    for (const usage of fabricUsage) {
      const fabric = store.findFabricInventory(usage.fabricName, usage.color);
      if (fabric) {
        const available = store.getAvailableStock(fabric.id);
        let status: FabricPreoccupyStatus = 'preoccupied';
        if (available < usage.length) {
          status = 'pending_purchase';
          insufficientFabrics.push({
            fabricName: usage.fabricName,
            color: usage.color,
            required: usage.length,
            available,
            unit: fabric.unit,
          });
        }

        const order = store.orders.find(o => o.id === orderId);
        const preoccupyRecord = {
          id: `preoccupy-${uuidv4().slice(0, 8)}`,
          fabricInventoryId: fabric.id,
          fabricName: fabric.fabricName,
          color: fabric.color,
          orderId,
          orderNumber: order?.orderNumber,
          patternTaskId: newTask.id,
          preoccupyLength: usage.length,
          unit: fabric.unit,
          status,
          remark: '打版任务创建自动预占',
          createdAt: now,
          updatedAt: now,
        };
        store.fabricPreoccupyRecords.unshift(preoccupyRecord);
        preoccupyResults.push({
          ...preoccupyRecord,
          statusLabel: FABRIC_PREOCCUPY_STATUS_LABELS[status],
          availableStock: available,
          isInsufficient: status === 'pending_purchase',
        });
      }
    }
  }

  store.generatePurchaseSuggestions();

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
  
  let message = '打版任务已创建';
  if (insufficientFabrics.length > 0) {
    message += `，但有 ${insufficientFabrics.length} 种布料库存不足，已生成采购建议`;
  }
  
  res.status(201).json({
    success: true,
    message,
    data: {
      task: newTask,
      stageInfo,
      preoccupyRecords: preoccupyResults,
      insufficientFabrics,
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

router.patch('/:id/status', async (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  const { status, operator } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: '请指定目标状态' });
  }

  const currentStatus = store.patternTasks[idx].status;
  const validation = validatePatternTransition(currentStatus, status);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const now = new Date().toISOString();
  const patternTaskId = store.patternTasks[idx].id;
  const orderId = store.patternTasks[idx].orderId;
  
  let fabricActionResult: any = null;
  
  if (status === 'approved') {
    const result = await consumeFabricByPattern(patternTaskId, operator || '系统操作', '打版审核通过，布料裁剪消耗');
    fabricActionResult = result;
  }
  
  if (status === 'in_progress' && currentStatus === 'approved') {
    const result = await releaseFabricByPattern(patternTaskId, operator || '系统操作', '打版返工，释放已消耗布料');
    fabricActionResult = result;
  }

  store.patternTasks[idx].status = status;
  store.patternTasks[idx].updatedAt = now;

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
  
  let message = '状态更新成功';
  if (fabricActionResult && fabricActionResult.message) {
    message = fabricActionResult.message;
  }
  
  res.json({
    success: true,
    message,
    data: {
      task: store.patternTasks[idx],
      stageInfo,
      fabricAction: fabricActionResult,
    },
  });
});

async function consumeFabricByPattern(patternTaskId: string, operator: string, remark: string) {
  const pattern = store.patternTasks.find(p => p.id === patternTaskId);
  if (!pattern) {
    return { success: false, message: '打版任务不存在' };
  }

  const consumed: any[] = [];
  store.fabricPreoccupyRecords.forEach((record, idx) => {
    if (record.patternTaskId === patternTaskId && (record.status === 'preoccupied' || record.status === 'pending_purchase')) {
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
          operator,
          remark || '裁剪消耗',
          record.orderId,
          record.patternTaskId
        );
      }
    }
  });

  store.generatePurchaseSuggestions();

  return {
    success: true,
    message: `已消耗 ${consumed.length} 种布料，共 ${consumed.reduce((sum, r) => sum + r.preoccupyLength, 0).toFixed(2)} 米`,
    consumedCount: consumed.length,
    records: consumed,
  };
}

async function releaseFabricByPattern(patternTaskId: string, operator: string, remark: string) {
  const pattern = store.patternTasks.find(p => p.id === patternTaskId);
  if (!pattern) {
    return { success: false, message: '打版任务不存在' };
  }

  const released: any[] = [];
  store.fabricPreoccupyRecords.forEach((record, idx) => {
    if (record.patternTaskId === patternTaskId && record.status === 'consumed') {
      store.fabricPreoccupyRecords[idx].status = 'preoccupied';
      store.fabricPreoccupyRecords[idx].updatedAt = new Date().toISOString();
      store.fabricPreoccupyRecords[idx].remark = remark || record.remark;
      released.push(store.fabricPreoccupyRecords[idx]);

      const fabricIdx = store.fabricInventories.findIndex(f => f.id === record.fabricInventoryId);
      if (fabricIdx !== -1) {
        const beforeStock = store.fabricInventories[fabricIdx].stockLength;
        const afterStock = Number((beforeStock + record.preoccupyLength).toFixed(2));
        store.fabricInventories[fabricIdx].stockLength = afterStock;
        store.fabricInventories[fabricIdx].updatedAt = new Date().toISOString();

        store.addFabricAdjustRecord(
          store.fabricInventories[fabricIdx].id,
          'release_preoccupy',
          record.preoccupyLength,
          beforeStock,
          afterStock,
          operator,
          remark || '返工释放预占',
          record.orderId,
          record.patternTaskId
        );
      }
    }
  });

  return {
    success: true,
    message: `已释放 ${released.length} 种布料的预占，共 ${released.reduce((sum, r) => sum + r.preoccupyLength, 0).toFixed(2)} 米退回预占状态`,
    releasedCount: released.length,
    records: released,
  };
}

router.patch('/:id/rework', async (req: Request, res: Response) => {
  const idx = store.patternTasks.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '打版任务不存在' });
  }
  const now = new Date().toISOString();
  const patternTaskId = store.patternTasks[idx].id;
  const { operator } = req.body;
  
  const releaseResult = await releaseFabricByPattern(
    patternTaskId,
    operator || '系统操作',
    `打版返工（第${store.patternTasks[idx].reworkCount + 1}次），释放已消耗布料`
  );
  
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
  
  let message = `打版已标记为返工（第${store.patternTasks[idx].reworkCount}次）`;
  if (releaseResult && releaseResult.releasedCount > 0) {
    message += `，${releaseResult.message}`;
  }
  
  res.json({
    success: true,
    message,
    data: {
      task: store.patternTasks[idx],
      stageInfo,
      fabricAction: releaseResult,
    },
  });
});

export default router;
