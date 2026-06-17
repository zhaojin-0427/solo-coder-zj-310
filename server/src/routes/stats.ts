import { Router, Request, Response } from 'express';
import { store } from '../store';
import { StatsData, DeliveryRiskData } from '../types';
import { getDeliveryRiskData, ORDER_STATUS_LABELS_CN } from '../stateFlow';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const completedOrders = store.orders.filter(o =>
    ['completed', 'shipping', 'customer_approved', 'fitting'].includes(o.status)
  );

  const dollOrderMap = new Map<string, number>();
  const dollReworkMap = new Map<string, number>();

  store.orders.forEach(order => {
    dollOrderMap.set(order.dollTemplateId, (dollOrderMap.get(order.dollTemplateId) || 0) + 1);
    const tasks = store.patternTasks.filter(p => p.orderId === order.id);
    const hasRework = tasks.some(t => t.reworkCount > 0);
    if (hasRework) {
      dollReworkMap.set(order.dollTemplateId, (dollReworkMap.get(order.dollTemplateId) || 0) + 1);
    }
  });

  const reworkRate = store.dolls.map(doll => {
    const total = dollOrderMap.get(doll.id) || 0;
    const reworks = dollReworkMap.get(doll.id) || 0;
    return {
      dollId: doll.id,
      dollName: `${doll.brand} ${doll.model}`,
      rate: total > 0 ? Number(((reworks / total) * 100).toFixed(1)) : 0,
      totalOrders: total,
      reworkOrders: reworks,
    };
  });

  const fabricMap = new Map<string, { fabricName: string; color: string; totalUsed: number; unit: string }>();
  store.patternTasks.forEach(task => {
    task.fabricUsage.forEach(item => {
      const key = `${item.fabricName}-${item.color}`;
      const existing = fabricMap.get(key);
      if (existing) {
        existing.totalUsed += item.length;
        existing.totalUsed = Number(existing.totalUsed.toFixed(2));
      } else {
        fabricMap.set(key, {
          fabricName: item.fabricName,
          color: item.color,
          totalUsed: Number(item.length.toFixed(2)),
          unit: item.unit === 'meter' ? '米' : '码',
        });
      }
    });
  });
  const fabricConsumption = Array.from(fabricMap.values()).sort((a, b) => b.totalUsed - a.totalUsed);

  let totalCycleDays = 0;
  let cycleCount = 0;
  completedOrders.forEach(order => {
    const start = new Date(order.createdAt).getTime();
    const end = new Date(order.updatedAt).getTime();
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (days > 0) {
      totalCycleDays += days;
      cycleCount++;
    }
  });
  const avgCycleTime = cycleCount > 0 ? Number((totalCycleDays / cycleCount).toFixed(1)) : 0;

  const styleCountMap = new Map<string, number>();
  let totalStyles = 0;
  store.orders.forEach(order => {
    order.styleTags.forEach(tag => {
      styleCountMap.set(tag, (styleCountMap.get(tag) || 0) + 1);
      totalStyles++;
    });
  });
  const styleDistribution = Array.from(styleCountMap.entries())
    .map(([style, count]) => ({
      style,
      count,
      percentage: totalStyles > 0 ? Number(((count / totalStyles) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const data: StatsData = {
    reworkRate,
    fabricConsumption,
    avgCycleTime,
    styleDistribution,
  };

  res.json({ success: true, data });
});

router.get('/summary', (req: Request, res: Response) => {
  const riskData = getDeliveryRiskData();
  const summary = {
    totalOrders: store.orders.length,
    pendingOrders: store.orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length,
    inProgressOrders: store.orders.filter(o =>
      ['pattern_making', 'fabric_prep', 'sewing', 'fitting'].includes(o.status)
    ).length,
    completedOrders: store.orders.filter(o => ['customer_approved', 'shipping', 'completed'].includes(o.status)).length,
    totalRevenue: store.orders.reduce((sum, o) => sum + o.totalPrice, 0),
    activePatterns: store.patternTasks.filter(p => ['pending', 'in_progress'].includes(p.status)).length,
    pendingFittings: store.fittingRecords.filter(f => ['photo_taken', 'customer_review'].includes(f.status)).length,
    totalDollTemplates: store.dolls.length,
    highRiskOrders: riskData.overdueOrders.filter(r => r.riskLevel === 'high').length
      + riskData.pendingFittingsOver48h.filter(r => r.riskLevel === 'high').length
      + riskData.highReworkOrders.filter(r => r.riskLevel === 'high').length,
  };
  res.json({ success: true, data: summary });
});

router.get('/delivery-risk', (req: Request, res: Response) => {
  const data: DeliveryRiskData = getDeliveryRiskData();
  res.json({ success: true, data });
});

const CHANGE_TYPE_LABELS_CN: Record<string, string> = {
  fabric: '更换布料',
  accessory: '增减配件',
  style: '调整风格',
  delivery_date: '修改交付日期',
  quantity: '追加套装件数',
};

router.get('/change-analysis', (req: Request, res: Response) => {
  const confirmedChanges = store.changeOrders.filter(c => c.status === 'confirmed');
  const nonRejectedChanges = store.changeOrders.filter(c => c.status !== 'rejected');
  const allChanges = store.changeOrders;
  const totalChanges = nonRejectedChanges.length;

  const typeCountMap = new Map<string, number>();
  let totalSupplement = 0;
  let totalDelay = 0;
  const dollChangeCountMap = new Map<string, number>();
  const pendingCount = allChanges.filter(c => c.status === 'pending').length;

  nonRejectedChanges.forEach(change => {
    typeCountMap.set(change.changeType, (typeCountMap.get(change.changeType) || 0) + 1);

    const order = store.orders.find(o => o.id === change.orderId);
    if (order) {
      dollChangeCountMap.set(order.dollTemplateId, (dollChangeCountMap.get(order.dollTemplateId) || 0) + 1);
    }
  });

  confirmedChanges.forEach(change => {
    totalSupplement += change.supplementAmount;
    totalDelay += change.estimatedDelayDays;
  });

  const changeTypeDistribution = Array.from(typeCountMap.entries())
    .map(([type, count]) => ({
      type,
      label: CHANGE_TYPE_LABELS_CN[type] || type,
      count,
      percentage: totalChanges > 0 ? Number(((count / totalChanges) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const remainingTypes = ['fabric', 'accessory', 'style', 'delivery_date', 'quantity'];
  remainingTypes.forEach(type => {
    if (!typeCountMap.has(type)) {
      changeTypeDistribution.push({
        type,
        label: CHANGE_TYPE_LABELS_CN[type] || type,
        count: 0,
        percentage: 0,
      });
    }
  });

  const confirmedCount = confirmedChanges.length;
  const avgSupplementAmount = confirmedCount > 0 ? Number((totalSupplement / confirmedCount).toFixed(2)) : 0;
  const avgDelayDays = confirmedCount > 0 ? Number((totalDelay / confirmedCount).toFixed(1)) : 0;

  const topDollModel = Array.from(dollChangeCountMap.entries())
    .map(([dollId, changeCount]) => ({
      dollId,
      dollName: store.getDollName(dollId),
      changeCount,
    }))
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, 5);

  const data = {
    changeTypeDistribution,
    avgSupplementAmount,
    avgDelayDays,
    topDollModel,
    pendingConfirmCount: pendingCount,
    totalChanges,
  };

  res.json({ success: true, data });
});

export default router;
