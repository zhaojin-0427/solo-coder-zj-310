import { OrderStatus, FittingStatus, Order, PatternTask, FittingRecord, OrderStatusHistory } from './types';
import { store } from './store';

export type BusinessStage =
  | 'pending_confirm'
  | 'pattern_making'
  | 'fabric_prep'
  | 'sewing'
  | 'fitting'
  | 'customer_review'
  | 'shipping'
  | 'completed'
  | 'cancelled';

export const STAGE_LABELS: Record<BusinessStage, string> = {
  pending_confirm: '待确认接单',
  pattern_making: '打版阶段',
  fabric_prep: '裁料阶段',
  sewing: '缝制阶段',
  fitting: '试穿确认阶段',
  customer_review: '客户最终确认',
  shipping: '发货配送',
  completed: '已完成',
  cancelled: '已取消',
};

export const ORDER_STATUS_TO_STAGE: Record<OrderStatus, BusinessStage> = {
  pending: 'pending_confirm',
  confirmed: 'pattern_making',
  pattern_making: 'pattern_making',
  fabric_prep: 'fabric_prep',
  sewing: 'sewing',
  fitting: 'fitting',
  customer_approved: 'customer_review',
  shipping: 'shipping',
  completed: 'completed',
  cancelled: 'cancelled',
};

export const ORDER_VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['pattern_making', 'cancelled'],
  pattern_making: ['fabric_prep', 'cancelled'],
  fabric_prep: ['sewing', 'cancelled'],
  sewing: ['fitting', 'cancelled'],
  fitting: ['customer_approved', 'pattern_making', 'cancelled'],
  customer_approved: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const PATTERN_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['completed'],
  completed: ['approved', 'in_progress'],
  approved: ['in_progress'],
};

export const FITTING_VALID_TRANSITIONS: Record<FittingStatus, FittingStatus[]> = {
  pending: ['photo_taken'],
  photo_taken: ['customer_review'],
  customer_review: ['approved', 'rework_needed'],
  rework_needed: ['pending'],
  approved: [],
};

export interface TransitionResult {
  success: boolean;
  message?: string;
}

export interface StageInfo {
  stage: BusinessStage;
  stageLabel: string;
  nextAction?: string;
  blockReason?: string;
  patternStatus?: string;
  fittingStatus?: string;
  canDirectAdvance: boolean;
  advanceBlockReason?: string;
}

export function validateOrderTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): TransitionResult {
  const allowed = ORDER_VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      success: false,
      message: `订单状态流转非法：无法从「${ORDER_STATUS_LABELS_CN[currentStatus]}」直接变更为「${ORDER_STATUS_LABELS_CN[targetStatus]}」。请按业务流程逐步推进。`,
    };
  }
  return { success: true };
}

const DIRECT_ALLOWED_TRANSITIONS: Array<[OrderStatus, OrderStatus]> = [
  ['pending', 'confirmed'],
  ['fabric_prep', 'sewing'],
  ['customer_approved', 'shipping'],
  ['shipping', 'completed'],
];

export function isDirectAllowedTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  return DIRECT_ALLOWED_TRANSITIONS.some(
    ([from, to]) => from === currentStatus && to === targetStatus
  );
}

export function validateOrderTransitionWithBusinessCheck(
  orderId: string,
  targetStatus: OrderStatus
): TransitionResult {
  const order = store.getOrderById(orderId);
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  const currentStatus = order.status;

  const basicValidation = validateOrderTransition(currentStatus, targetStatus);
  if (!basicValidation.success) {
    return basicValidation;
  }

  if (isDirectAllowedTransition(currentStatus, targetStatus)) {
    return { success: true };
  }

  const patternTasks = store.patternTasks.filter(p => p.orderId === orderId);
  const fittingRecords = store.fittingRecords.filter(f => f.orderId === orderId);
  const latestPattern = patternTasks.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
  const latestFitting = fittingRecords.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  if (currentStatus === 'confirmed' && targetStatus === 'pattern_making') {
    if (patternTasks.length === 0) {
      return {
        success: false,
        message: '请先在打版进度页面创建打版任务，订单将自动进入打版阶段。',
      };
    }
    return { success: true };
  }

  if (currentStatus === 'pattern_making' && targetStatus === 'fabric_prep') {
    if (!latestPattern) {
      return {
        success: false,
        message: '未找到关联的打版任务，请先创建打版任务。',
      };
    }
    if (latestPattern.status === 'pending') {
      return {
        success: false,
        message: '打版任务尚未开始，请先将打版任务设为进行中。',
      };
    }
    if (latestPattern.status === 'in_progress') {
      return {
        success: false,
        message: '打版任务进行中，请先完成打版并审核通过后，再进入裁料阶段。',
      };
    }
    if (latestPattern.status === 'completed') {
      return {
        success: false,
        message: '打版任务已完成但尚未审核，请在打版进度页审核通过后，订单将自动进入裁料阶段。',
      };
    }
    if (latestPattern.status === 'approved') {
      return { success: true };
    }
    return { success: false, message: '打版任务状态异常，无法进入裁料阶段。' };
  }

  if (currentStatus === 'sewing' && targetStatus === 'fitting') {
    if (fittingRecords.length === 0) {
      return {
        success: false,
        message: '请在试穿确认页面创建试穿记录并上传照片，订单将自动进入试穿阶段。',
      };
    }
    const hasPhotoTaken = fittingRecords.some(f => f.status === 'photo_taken');
    if (!hasPhotoTaken) {
      return {
        success: false,
        message: '请先上传试穿照片，订单将自动进入试穿阶段。',
      };
    }
    return { success: true };
  }

  if (currentStatus === 'fitting' && targetStatus === 'customer_approved') {
    if (!latestFitting) {
      return {
        success: false,
        message: '未找到关联的试穿记录，请先创建试穿记录。',
      };
    }
    if (latestFitting.status === 'pending') {
      return {
        success: false,
        message: '试穿记录尚未上传照片，请先上传试穿照片。',
      };
    }
    if (latestFitting.status === 'photo_taken') {
      return {
        success: false,
        message: '试穿照片已上传，请提交客户审核后等待客户确认通过。',
      };
    }
    if (latestFitting.status === 'customer_review') {
      return {
        success: false,
        message: '客户正在审核中，请等待客户确认通过后，订单将自动进入客户确认阶段。',
      };
    }
    if (latestFitting.status === 'rework_needed') {
      return {
        success: false,
        message: '试穿需返工，请调整版型后重新试穿。',
      };
    }
    if (latestFitting.status === 'approved') {
      return { success: true };
    }
    return { success: false, message: '试穿记录状态异常，无法进入客户确认阶段。' };
  }

  if (targetStatus === 'cancelled') {
    return { success: true };
  }

  return { success: true };
}

export function validatePatternTransition(
  currentStatus: string,
  targetStatus: string
): TransitionResult {
  const allowed = PATTERN_VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    const currentLabel = PATTERN_STATUS_LABELS_CN[currentStatus] || currentStatus;
    const targetLabel = PATTERN_STATUS_LABELS_CN[targetStatus] || targetStatus;
    return {
      success: false,
      message: `打版任务状态流转非法：无法从「${currentLabel}」直接变更为「${targetLabel}」。`,
    };
  }
  return { success: true };
}

export function validateFittingTransition(
  currentStatus: FittingStatus,
  targetStatus: FittingStatus
): TransitionResult {
  const allowed = FITTING_VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      success: false,
      message: `试穿记录状态流转非法：无法从「${FITTING_STATUS_LABELS_CN[currentStatus]}」直接变更为「${FITTING_STATUS_LABELS_CN[targetStatus]}」。`,
    };
  }
  return { success: true };
}

export const ORDER_STATUS_LABELS_CN: Record<OrderStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  pattern_making: '打版中',
  fabric_prep: '裁料中',
  sewing: '缝制中',
  fitting: '试穿中',
  customer_approved: '客户确认',
  shipping: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

export const PATTERN_STATUS_LABELS_CN: Record<string, string> = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  approved: '已审核',
};

export const FITTING_STATUS_LABELS_CN: Record<FittingStatus, string> = {
  pending: '待拍照',
  photo_taken: '已上传',
  customer_review: '客户审核中',
  rework_needed: '需返工',
  approved: '已通过',
};

export function getStageInfo(orderId: string): StageInfo {
  const order = store.getOrderById(orderId);
  if (!order) {
    return {
      stage: 'cancelled',
      stageLabel: '订单不存在',
      blockReason: '未找到该订单',
      canDirectAdvance: false,
    };
  }

  const stage = ORDER_STATUS_TO_STAGE[order.status];
  const patternTasks = store.patternTasks.filter(p => p.orderId === orderId);
  const fittingRecords = store.fittingRecords.filter(f => f.orderId === orderId);
  const latestPattern = patternTasks.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
  const latestFitting = fittingRecords.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  let nextAction: string | undefined;
  let blockReason: string | undefined;

  switch (order.status) {
    case 'pending':
      nextAction = '设计师确认接单';
      break;
    case 'confirmed':
      if (patternTasks.length === 0) {
        nextAction = '创建打版任务';
      } else if (latestPattern?.status === 'pending') {
        nextAction = '开始打版（将打版任务设为进行中）';
      } else {
        nextAction = '推进打版任务';
      }
      break;
    case 'pattern_making':
      if (!latestPattern) {
        blockReason = '订单处于打版阶段但未找到关联打版任务';
      } else if (latestPattern.status === 'pending') {
        nextAction = '开始打版（将打版任务设为进行中）';
      } else if (latestPattern.status === 'in_progress') {
        nextAction = '完成打版（将打版任务设为已完成）';
      } else if (latestPattern.status === 'completed') {
        nextAction = '审核打版并进入裁料阶段';
      } else if (latestPattern.status === 'approved') {
        nextAction = '进入裁料阶段';
      }
      break;
    case 'fabric_prep':
      nextAction = '布料裁剪完成后进入缝制阶段';
      break;
    case 'sewing':
      if (fittingRecords.length === 0) {
        nextAction = '缝制完成后上传试穿记录';
      } else {
        nextAction = '进入试穿确认阶段';
      }
      break;
    case 'fitting':
      if (!latestFitting) {
        blockReason = '订单处于试穿阶段但未找到关联试穿记录';
      } else if (latestFitting.status === 'pending') {
        nextAction = '上传试穿照片';
      } else if (latestFitting.status === 'photo_taken') {
        nextAction = '提交客户审核';
      } else if (latestFitting.status === 'customer_review') {
        nextAction = '等待客户确认（通过或返工）';
      } else if (latestFitting.status === 'rework_needed') {
        nextAction = '根据返工意见修改打版并重新试穿';
        blockReason = '试穿需返工，请调整版型后重新上传试穿记录';
      }
      break;
    case 'customer_approved':
      nextAction = '安排发货';
      break;
    case 'shipping':
      nextAction = '确认客户签收后标记完成';
      break;
    case 'completed':
    case 'cancelled':
      break;
  }

  let canDirectAdvance = false;
  let advanceBlockReason: string | undefined;

  const nextStatuses = ORDER_VALID_TRANSITIONS[order.status] || [];
  const nextNormalStatus = nextStatuses.find(s => s !== 'cancelled');
  if (nextNormalStatus) {
    const checkResult = validateOrderTransitionWithBusinessCheck(orderId, nextNormalStatus);
    canDirectAdvance = checkResult.success;
    if (!checkResult.success) {
      advanceBlockReason = checkResult.message;
    }
  }

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    nextAction,
    blockReason,
    patternStatus: latestPattern ? PATTERN_STATUS_LABELS_CN[latestPattern.status] : undefined,
    fittingStatus: latestFitting ? FITTING_STATUS_LABELS_CN[latestFitting.status] : undefined,
    canDirectAdvance,
    advanceBlockReason,
  };
}

export function syncOrderStatusFromPattern(
  orderId: string,
  patternStatus: string,
  isNewTask: boolean = false
): { shouldUpdate: boolean; newStatus?: OrderStatus; note?: string } {
  const order = store.getOrderById(orderId);
  if (!order) return { shouldUpdate: false };

  if (isNewTask && order.status === 'confirmed') {
    return {
      shouldUpdate: true,
      newStatus: 'pattern_making',
      note: '打版任务已创建，订单自动进入打版阶段',
    };
  }

  if (patternStatus === 'in_progress' && order.status === 'confirmed') {
    return {
      shouldUpdate: true,
      newStatus: 'pattern_making',
      note: '打版任务开始，订单自动进入打版阶段',
    };
  }

  if (patternStatus === 'completed' && order.status === 'pattern_making') {
    return {
      shouldUpdate: false,
      note: '打版任务已完成，请审核后进入裁料阶段',
    };
  }

  if (patternStatus === 'approved' && order.status === 'pattern_making') {
    return {
      shouldUpdate: true,
      newStatus: 'fabric_prep',
      note: '打版审核通过，订单自动进入裁料阶段',
    };
  }

  if (patternStatus === 'in_progress' && order.status === 'fitting') {
    return {
      shouldUpdate: true,
      newStatus: 'pattern_making',
      note: '打版任务返工进行中，订单回退至打版阶段',
    };
  }

  return { shouldUpdate: false };
}

export function syncOrderStatusFromFitting(
  orderId: string,
  fittingStatus: FittingStatus
): { shouldUpdate: boolean; newStatus?: OrderStatus; note?: string } {
  const order = store.getOrderById(orderId);
  if (!order) return { shouldUpdate: false };

  if (fittingStatus === 'photo_taken' && (order.status === 'sewing' || order.status === 'fitting')) {
    if (order.status === 'sewing') {
      return {
        shouldUpdate: true,
        newStatus: 'fitting',
        note: '试穿照片已上传，订单自动进入试穿阶段',
      };
    }
  }

  if (fittingStatus === 'customer_review' && order.status !== 'fitting') {
    return {
      shouldUpdate: true,
      newStatus: 'fitting',
      note: '试穿提交客户审核，订单自动进入试穿阶段',
    };
  }

  if (fittingStatus === 'approved' && order.status === 'fitting') {
    return {
      shouldUpdate: true,
      newStatus: 'customer_approved',
      note: '试穿通过，订单自动进入客户确认阶段',
    };
  }

  if (fittingStatus === 'rework_needed' && order.status === 'fitting') {
    return {
      shouldUpdate: true,
      newStatus: 'pattern_making',
      note: '试穿需返工，订单回退至打版阶段进行调整',
    };
  }

  return { shouldUpdate: false };
}

export function addOrderHistory(
  order: Order,
  status: OrderStatus,
  note?: string,
  operator: string = '系统'
): OrderStatusHistory {
  return {
    status,
    timestamp: new Date().toISOString(),
    note,
    operator,
  };
}

export interface DeliveryRiskItem {
  type: 'overdue' | 'fitting_pending' | 'high_rework';
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  riskLevel: 'high' | 'medium' | 'low';
  description: string;
  stage: string;
  days?: number;
}

export interface StageDuration {
  stage: BusinessStage;
  stageLabel: string;
  avgHours: number;
  sampleCount: number;
}

export interface StageTimelineNode {
  stage: BusinessStage;
  stageLabel: string;
  status: OrderStatus;
  statusLabel: string;
  timestamp?: string;
  note?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export function getStageTimeline(orderId: string): StageTimelineNode[] {
  const order = store.getOrderById(orderId);
  if (!order) return [];

  const stages: BusinessStage[] = [
    'pending_confirm',
    'pattern_making',
    'fabric_prep',
    'sewing',
    'fitting',
    'customer_review',
    'shipping',
    'completed',
  ];

  const stageToStatus: Record<BusinessStage, OrderStatus> = {
    pending_confirm: 'pending',
    pattern_making: 'pattern_making',
    fabric_prep: 'fabric_prep',
    sewing: 'sewing',
    fitting: 'fitting',
    customer_review: 'customer_approved',
    shipping: 'shipping',
    completed: 'completed',
    cancelled: 'cancelled',
  };

  const currentStage = ORDER_STATUS_TO_STAGE[order.status];
  const currentIdx = stages.indexOf(currentStage);

  return stages.map((stage, idx) => {
    const status = stageToStatus[stage];
    const historyEntry = order.history.find(h => h.status === status);
    const isCompleted = idx < currentIdx || order.status === 'completed' || order.status === 'cancelled';
    const isCurrent = stage === currentStage;

    return {
      stage,
      stageLabel: STAGE_LABELS[stage],
      status,
      statusLabel: ORDER_STATUS_LABELS_CN[status],
      timestamp: historyEntry?.timestamp,
      note: historyEntry?.note,
      isCompleted: isCompleted || (order.status === 'completed' && idx <= currentIdx),
      isCurrent,
    };
  });
}

export function getKeyMilestones(orderId: string): { label: string; timestamp?: string; status: string }[] {
  const order = store.getOrderById(orderId);
  if (!order) return [];

  const milestones: { label: string; status: OrderStatus; timestamp?: string }[] = [
    { label: '订单创建', status: 'pending' },
    { label: '确认接单', status: 'confirmed' },
    { label: '开始打版', status: 'pattern_making' },
    { label: '开始裁料', status: 'fabric_prep' },
    { label: '开始缝制', status: 'sewing' },
    { label: '进入试穿', status: 'fitting' },
    { label: '客户确认', status: 'customer_approved' },
    { label: '安排发货', status: 'shipping' },
    { label: '订单完成', status: 'completed' },
  ];

  return milestones.map(m => {
    const entry = order.history.find(h => h.status === m.status);
    return {
      label: m.label,
      timestamp: entry?.timestamp,
      status: entry ? '已完成' : '未开始',
    };
  });
}

export function getDeliveryRiskData(): {
  overdueOrders: DeliveryRiskItem[];
  pendingFittingsOver48h: DeliveryRiskItem[];
  highReworkOrders: DeliveryRiskItem[];
  stageDurations: StageDuration[];
} {
  const now = new Date();
  const overdueOrders: DeliveryRiskItem[] = [];
  const pendingFittingsOver48h: DeliveryRiskItem[] = [];
  const highReworkOrders: DeliveryRiskItem[] = [];

  store.orders.forEach(order => {
    if (['completed', 'cancelled', 'shipping'].includes(order.status)) return;

    const deliveryDate = new Date(order.deliveryDate);
    const daysToDelivery = Math.ceil(
      (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysToDelivery < 0) {
      overdueOrders.push({
        type: 'overdue',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        deliveryDate: order.deliveryDate,
        riskLevel: 'high',
        description: `已逾期 ${Math.abs(daysToDelivery)} 天`,
        stage: ORDER_STATUS_LABELS_CN[order.status],
        days: Math.abs(daysToDelivery),
      });
    } else if (daysToDelivery <= 3 && order.priority === 'urgent') {
      overdueOrders.push({
        type: 'overdue',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        deliveryDate: order.deliveryDate,
        riskLevel: 'high',
        description: `加急单剩余 ${daysToDelivery} 天`,
        stage: ORDER_STATUS_LABELS_CN[order.status],
        days: daysToDelivery,
      });
    } else if (daysToDelivery <= 5) {
      overdueOrders.push({
        type: 'overdue',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        deliveryDate: order.deliveryDate,
        riskLevel: 'medium',
        description: `剩余 ${daysToDelivery} 天交付`,
        stage: ORDER_STATUS_LABELS_CN[order.status],
        days: daysToDelivery,
      });
    }
  });

  overdueOrders.sort((a, b) => (b.days || 0) - (a.days || 0));

  store.fittingRecords.forEach(record => {
    if (record.status === 'customer_review') {
      const updatedAt = new Date(record.updatedAt);
      const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate >= 48) {
        const order = store.getOrderById(record.orderId);
        if (order && !['completed', 'cancelled'].includes(order.status)) {
          pendingFittingsOver48h.push({
            type: 'fitting_pending',
            orderId: record.orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            deliveryDate: order.deliveryDate,
            riskLevel: hoursSinceUpdate >= 72 ? 'high' : 'medium',
            description: `客户审核已等待 ${Math.floor(hoursSinceUpdate)} 小时`,
            stage: FITTING_STATUS_LABELS_CN[record.status],
            days: Math.floor(hoursSinceUpdate / 24),
          });
        }
      }
    }
  });

  pendingFittingsOver48h.sort((a, b) => (b.days || 0) - (a.days || 0));

  store.patternTasks.forEach(task => {
    if (task.reworkCount >= 2) {
      const order = store.getOrderById(task.orderId);
      if (order && !['completed', 'cancelled'].includes(order.status)) {
        const alreadyExists = highReworkOrders.some(r => r.orderId === order.id);
        if (!alreadyExists) {
          highReworkOrders.push({
            type: 'high_rework',
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            deliveryDate: order.deliveryDate,
            riskLevel: task.reworkCount >= 3 ? 'high' : 'medium',
            description: `打版已返工 ${task.reworkCount} 次`,
            stage: ORDER_STATUS_LABELS_CN[order.status],
            days: task.reworkCount,
          });
        }
      }
    }
  });

  highReworkOrders.sort((a, b) => (b.days || 0) - (a.days || 0));

  const stageDurationsMap = new Map<BusinessStage, { total: number; count: number }>();

  store.orders.forEach(order => {
    for (let i = 0; i < order.history.length - 1; i++) {
      const current = order.history[i];
      const next = order.history[i + 1];
      const stage = ORDER_STATUS_TO_STAGE[current.status];
      const durationMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      if (durationHours > 0 && durationHours < 24 * 30) {
        const existing = stageDurationsMap.get(stage);
        if (existing) {
          existing.total += durationHours;
          existing.count += 1;
        } else {
          stageDurationsMap.set(stage, { total: durationHours, count: 1 });
        }
      }
    }
  });

  const stageDurations: StageDuration[] = Array.from(stageDurationsMap.entries())
    .map(([stage, data]) => ({
      stage,
      stageLabel: STAGE_LABELS[stage],
      avgHours: Number((data.total / data.count).toFixed(1)),
      sampleCount: data.count,
    }))
    .filter(s => s.sampleCount > 0);

  return {
    overdueOrders,
    pendingFittingsOver48h,
    highReworkOrders,
    stageDurations,
  };
}
