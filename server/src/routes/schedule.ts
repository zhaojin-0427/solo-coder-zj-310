import { Router, Request, Response } from 'express';
import { store } from '../store';
import { ScheduleTask, DESIGNERS, SCHEDULE_STAGE_LABELS, SCHEDULE_STAGE_COLORS } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { designer, stage, viewType } = req.query;
  const scheduleData = store.getScheduleData();

  let filteredTasks = [...scheduleData.tasks];

  if (designer) {
    filteredTasks = filteredTasks.filter(t => t.designer === designer);
  }
  if (stage) {
    filteredTasks = filteredTasks.filter(t => t.stage === stage);
  }

  res.json({
    success: true,
    data: {
      ...scheduleData,
      tasks: filteredTasks,
    },
  });
});

router.get('/gantt', (req: Request, res: Response) => {
  const { startDate, endDate, designer } = req.query;
  const scheduleData = store.getScheduleData();

  let tasks = [...scheduleData.tasks];

  if (startDate) {
    tasks = tasks.filter(t => t.endDate >= startDate);
  }
  if (endDate) {
    tasks = tasks.filter(t => t.startDate <= endDate);
  }
  if (designer) {
    tasks = tasks.filter(t => t.designer === designer);
  }

  const groupedByOrder: Record<string, ScheduleTask[]> = {};
  tasks.forEach(task => {
    if (!groupedByOrder[task.orderId]) {
      groupedByOrder[task.orderId] = [];
    }
    groupedByOrder[task.orderId].push(task);
  });

  Object.values(groupedByOrder).forEach(orderTasks => {
    orderTasks.sort((a, b) => {
      const stageOrder = ['pattern_making', 'fabric_cutting', 'fitting', 'shipping'];
      return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
    });
  });

  res.json({
    success: true,
    data: {
      tasks,
      groupedByOrder,
      designers: DESIGNERS,
      stageLabels: SCHEDULE_STAGE_LABELS,
      stageColors: SCHEDULE_STAGE_COLORS,
    },
  });
});

router.get('/capacity', (req: Request, res: Response) => {
  const { days } = req.query;
  const scheduleData = store.getScheduleData();
  const numDays = days ? parseInt(days as string) : 7;

  const tasks = scheduleData.tasks;
  const capacity = store.getCapacityNext7Days(tasks).slice(0, numDays);

  res.json({
    success: true,
    data: {
      capacity,
      designerWorkloads: scheduleData.designerWorkloads,
    },
  });
});

router.get('/workload', (req: Request, res: Response) => {
  const scheduleData = store.getScheduleData();

  res.json({
    success: true,
    data: {
      designerWorkloads: scheduleData.designerWorkloads,
      designers: DESIGNERS,
    },
  });
});

router.get('/conflicts', (req: Request, res: Response) => {
  const scheduleData = store.getScheduleData();

  res.json({
    success: true,
    data: {
      conflicts: scheduleData.conflicts,
      atRiskOrdersCount: scheduleData.atRiskOrdersCount,
    },
  });
});

router.get('/order/:orderId', (req: Request, res: Response) => {
  const { orderId } = req.params;
  const scheduleCard = store.getScheduleCard(orderId);

  if (!scheduleCard) {
    return res.status(404).json({
      success: false,
      message: '未找到该订单的排期信息',
    });
  }

  res.json({
    success: true,
    data: scheduleCard,
  });
});

router.patch('/task/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const updates = req.body;

  const task = store.updateScheduleTask(taskId, updates);
  if (!task) {
    return res.status(404).json({
      success: false,
      message: '排期任务不存在',
    });
  }

  const scheduleData = store.getScheduleData();

  res.json({
    success: true,
    message: '排期已更新',
    data: {
      task,
      scheduleData,
    },
  });
});

router.post('/task/:taskId/lock', (req: Request, res: Response) => {
  const { taskId } = req.params;

  const task = store.toggleTaskLock(taskId);
  if (!task) {
    return res.status(404).json({
      success: false,
      message: '排期任务不存在',
    });
  }

  const scheduleData = store.getScheduleData();

  res.json({
    success: true,
    message: task.isLocked ? '排期已锁定' : '排期已解锁',
    data: {
      task,
      scheduleData,
    },
  });
});

router.post('/recalculate', (req: Request, res: Response) => {
  store.scheduleTasks = [];
  const scheduleData = store.getScheduleData();

  res.json({
    success: true,
    message: '排期已重新计算',
    data: scheduleData,
  });
});

router.get('/summary', (req: Request, res: Response) => {
  const scheduleData = store.getScheduleData();

  const totalTasks = scheduleData.tasks.length;
  const lockedTasks = scheduleData.tasks.filter(t => t.isLocked).length;
  const urgentTasks = scheduleData.tasks.filter(t => t.isUrgent).length;
  const highRiskTasks = scheduleData.tasks.filter(t => t.delayRisk === 'high').length;
  const mediumRiskTasks = scheduleData.tasks.filter(t => t.delayRisk === 'medium').length;

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = scheduleData.tasks.filter(
    t => t.startDate <= today && t.endDate >= today
  );

  res.json({
    success: true,
    data: {
      totalTasks,
      lockedTasks,
      urgentTasks,
      highRiskTasks,
      mediumRiskTasks,
      todayTasks,
      avgCycleDays: scheduleData.avgCycleDays,
      urgentOrdersCount: scheduleData.urgentOrdersCount,
      atRiskOrdersCount: scheduleData.atRiskOrdersCount,
    },
  });
});

export default router;
