import { Router, Request, Response } from 'express';
import { store } from '../store';
import { StatsData } from '../types';

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
  };
  res.json({ success: true, data: summary });
});

export default router;
