import { Router, Request, Response } from 'express';
import { mockOrders, mockPatternTasks, mockDollTemplates } from '../data';
import { StatsData } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const completedOrders = mockOrders.filter(o =>
    ['completed', 'shipping', 'customer_approved', 'fitting'].includes(o.status)
  );

  const dollOrderMap = new Map<string, number>();
  const dollReworkMap = new Map<string, number>();

  mockOrders.forEach(order => {
    dollOrderMap.set(order.dollTemplateId, (dollOrderMap.get(order.dollTemplateId) || 0) + 1);
    const tasks = mockPatternTasks.filter(p => p.orderId === order.id);
    const hasRework = tasks.some(t => t.reworkCount > 0);
    if (hasRework) {
      dollReworkMap.set(order.dollTemplateId, (dollReworkMap.get(order.dollTemplateId) || 0) + 1);
    }
  });

  const reworkRate = mockDollTemplates.map(doll => {
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
  mockPatternTasks.forEach(task => {
    task.fabricUsage.forEach(item => {
      const key = `${item.fabricName}-${item.color}`;
      const existing = fabricMap.get(key);
      if (existing) {
        existing.totalUsed += item.length;
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
  mockOrders.forEach(order => {
    order.styleTags.forEach(tag => {
      styleCountMap.set(tag, (styleCountMap.get(tag) || 0) + 1);
      totalStyles++;
    });
  });
  const styleDistribution = Array.from(styleCountMap.entries())
    .map(([style, count]) => ({
      style,
      count,
      percentage: Number(((count / totalStyles) * 100).toFixed(1)),
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
    totalOrders: mockOrders.length,
    pendingOrders: mockOrders.filter(o => ['pending', 'confirmed'].includes(o.status)).length,
    inProgressOrders: mockOrders.filter(o =>
      ['pattern_making', 'fabric_prep', 'sewing', 'fitting'].includes(o.status)
    ).length,
    completedOrders: mockOrders.filter(o => ['customer_approved', 'shipping', 'completed'].includes(o.status)).length,
    totalRevenue: mockOrders.reduce((sum, o) => sum + o.totalPrice, 0),
    activePatterns: mockPatternTasks.filter(p => ['pending', 'in_progress'].includes(p.status)).length,
    pendingFittings: mockPatternTasks.filter(p => p.status === 'completed').length +
      mockOrders.filter(o => o.status === 'fitting').length,
    totalDollTemplates: mockDollTemplates.length,
  };
  res.json({ success: true, data: summary });
});

export default router;
