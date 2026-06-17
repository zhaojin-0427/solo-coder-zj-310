export interface DollTemplate {
  id: string;
  brand: string;
  model: string;
  height: number;
  bust: number;
  waist: number;
  hip: number;
  shoulder: number;
  neck: number;
  armLength: number;
  legLength: number;
  footLength: number;
  headCircumference: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'pattern_making'
  | 'fabric_prep'
  | 'sewing'
  | 'fitting'
  | 'customer_approved'
  | 'shipping'
  | 'completed'
  | 'cancelled';

export type FittingStatus =
  | 'pending'
  | 'photo_taken'
  | 'customer_review'
  | 'rework_needed'
  | 'approved';

export interface OrderItem {
  styleReference?: string;
  fabricPreference: string;
  accessories?: string;
  notes?: string;
  quantity: number;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  operator: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  dollTemplateId: string;
  items: OrderItem[];
  deliveryDate: string;
  priority: 'normal' | 'urgent';
  status: OrderStatus;
  styleTags: string[];
  totalPrice: number;
  deposit: number;
  createdAt: string;
  updatedAt: string;
  history: OrderStatusHistory[];
  dollName?: string;
}

export interface PatternPiece {
  name: string;
  quantity: number;
  fabricType: string;
  size: string;
}

export interface FabricUsageItem {
  fabricName: string;
  width: number;
  length: number;
  unit: 'meter' | 'yard';
  color: string;
}

export interface PatternTask {
  id: string;
  orderId: string;
  designer: string;
  status: 'pending' | 'in_progress' | 'completed' | 'approved';
  patternPieces: PatternPiece[];
  fabricUsage: FabricUsageItem[];
  notes?: string;
  estimatedHours: number;
  actualHours?: number;
  reworkCount: number;
  createdAt: string;
  updatedAt: string;
  orderInfo?: {
    orderNumber: string;
    customerName: string;
    dollName: string;
    styleTags: string[];
  };
}

export interface FittingRecord {
  id: string;
  orderId: string;
  patternTaskId: string;
  status: FittingStatus;
  photos: string[];
  customerFeedback?: string;
  designerNotes?: string;
  reworkSuggestions?: string[];
  fittingRound: number;
  createdAt: string;
  updatedAt: string;
  orderInfo?: {
    orderNumber: string;
    customerName: string;
    dollName: string;
    styleTags: string[];
    deliveryDate: string;
  };
}

export interface StatsData {
  reworkRate: {
    dollId: string;
    dollName: string;
    rate: number;
    totalOrders: number;
    reworkOrders: number;
  }[];
  fabricConsumption: {
    fabricName: string;
    color: string;
    totalUsed: number;
    unit: string;
  }[];
  avgCycleTime: number;
  styleDistribution: {
    style: string;
    count: number;
    percentage: number;
  }[];
}

export interface SummaryData {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalRevenue: number;
  activePatterns: number;
  pendingFittings: number;
  totalDollTemplates: number;
  highRiskOrders?: number;
}

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

export const BUSINESS_STAGE_LABELS: Record<BusinessStage, string> = {
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

export interface StageInfo {
  stage: BusinessStage;
  stageLabel: string;
  nextAction?: string;
  blockReason?: string;
  patternStatus?: string;
  fittingStatus?: string;
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

export interface KeyMilestone {
  label: string;
  timestamp?: string;
  status: string;
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

export interface DeliveryRiskData {
  overdueOrders: DeliveryRiskItem[];
  pendingFittingsOver48h: DeliveryRiskItem[];
  highReworkOrders: DeliveryRiskItem[];
  stageDurations: StageDuration[];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
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

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  pattern_making: '#8b5cf6',
  fabric_prep: '#06b6d4',
  sewing: '#14b8a6',
  fitting: '#f97316',
  customer_approved: '#22c55e',
  shipping: '#6366f1',
  completed: '#10b981',
  cancelled: '#ef4444',
};

export const PATTERN_STATUS_LABELS = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  approved: '已审核',
};

export const PATTERN_STATUS_COLORS = {
  pending: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#f59e0b',
  approved: '#22c55e',
};

export const FITTING_STATUS_LABELS: Record<FittingStatus, string> = {
  pending: '待拍照',
  photo_taken: '已上传',
  customer_review: '客户审核中',
  rework_needed: '需返工',
  approved: '已通过',
};

export const FITTING_STATUS_COLORS: Record<FittingStatus, string> = {
  pending: '#94a3b8',
  photo_taken: '#3b82f6',
  customer_review: '#f59e0b',
  rework_needed: '#ef4444',
  approved: '#22c55e',
};
