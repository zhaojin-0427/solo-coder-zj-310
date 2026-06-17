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
  stageInfo?: StageInfo;
  communications?: CommunicationRecord[];
  changeOrders?: ChangeOrder[];
  pendingChangeCount?: number;
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
  canDirectAdvance: boolean;
  advanceBlockReason?: string;
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

export type CommunicationChannel = 'wechat' | 'phone' | 'face' | 'email' | 'other';

export const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  wechat: '微信',
  phone: '电话',
  face: '面谈',
  email: '邮件',
  other: '其他',
};

export const COMMUNICATION_CHANNEL_ICONS: Record<CommunicationChannel, string> = {
  wechat: '💬',
  phone: '📞',
  face: '👥',
  email: '📧',
  other: '📝',
};

export interface CommunicationRecord {
  id: string;
  orderId: string;
  channel: CommunicationChannel;
  channelLabel: string;
  content: string;
  imagePlaceholders: string[];
  conclusion: string;
  follower: string;
  createdAt: string;
  updatedAt: string;
}

export type ChangeType = 'fabric' | 'accessory' | 'style' | 'delivery_date' | 'quantity';

export type ChangeOrderStatus = 'pending' | 'confirmed' | 'rejected';

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  fabric: '更换布料',
  accessory: '增减配件',
  style: '调整风格',
  delivery_date: '修改交付日期',
  quantity: '追加套装件数',
};

export const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  fabric: '#ef4444',
  accessory: '#f97316',
  style: '#8b5cf6',
  delivery_date: '#3b82f6',
  quantity: '#06b6d4',
};

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
};

export const CHANGE_ORDER_STATUS_COLORS: Record<ChangeOrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#22c55e',
  rejected: '#ef4444',
};

export interface ChangeOrder {
  id: string;
  orderId: string;
  changeType: ChangeType;
  changeTypeLabel: string;
  description: string;
  beforeValue: string;
  afterValue: string;
  priceBefore: number;
  priceAfter: number;
  priceDiff: number;
  supplementAmount: number;
  estimatedDelayDays: number;
  stageImpact: string;
  status: ChangeOrderStatus;
  statusLabel: string;
  refundNote?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeAnalysisData {
  changeTypeDistribution: { type: ChangeType; label: string; count: number; percentage: number }[];
  avgSupplementAmount: number;
  avgDelayDays: number;
  topDollModel: { dollId: string; dollName: string; changeCount: number }[];
  pendingConfirmCount: number;
  totalChanges: number;
}

export type FabricPreoccupyStatus = 'preoccupied' | 'consumed' | 'released' | 'pending_purchase';

export const FABRIC_PREOCCUPY_STATUS_LABELS: Record<FabricPreoccupyStatus, string> = {
  preoccupied: '已预占',
  consumed: '已消耗',
  released: '已释放',
  pending_purchase: '待采购',
};

export const FABRIC_PREOCCUPY_STATUS_COLORS: Record<FabricPreoccupyStatus, string> = {
  preoccupied: '#f59e0b',
  consumed: '#10b981',
  released: '#6b7280',
  pending_purchase: '#ef4444',
};

export type FabricAdjustType = 'stock_in' | 'manual_adjust' | 'consume' | 'release_preoccupy' | 'rework_return';

export const FABRIC_ADJUST_TYPE_LABELS: Record<FabricAdjustType, string> = {
  stock_in: '入库',
  manual_adjust: '手动调整',
  consume: '消耗',
  release_preoccupy: '释放预占',
  rework_return: '返工退回',
};

export type PurchaseSuggestionStatus = 'pending' | 'ordered' | 'completed' | 'cancelled';

export const PURCHASE_SUGGESTION_STATUS_LABELS: Record<PurchaseSuggestionStatus, string> = {
  pending: '待处理',
  ordered: '已下单',
  completed: '已入库',
  cancelled: '已取消',
};

export const PURCHASE_SUGGESTION_STATUS_COLORS: Record<PurchaseSuggestionStatus, string> = {
  pending: '#f59e0b',
  ordered: '#3b82f6',
  completed: '#10b981',
  cancelled: '#6b7280',
};

export interface FabricInventory {
  id: string;
  fabricName: string;
  color: string;
  width: number;
  widthUnit?: string;
  stockLength: number;
  unit: string;
  safetyStock: number;
  supplier: string;
  purchaseCycle: number;
  purchaseCycleUnit?: string;
  unitPrice: number;
  currency?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  availableStock?: number;
  preoccupiedLength?: number;
  isLowStock?: boolean;
  belowSafetyStock?: boolean;
  inventoryValue?: number;
}

export interface FabricPreoccupyRecord {
  id: string;
  fabricInventoryId: string;
  fabricName: string;
  color: string;
  orderId: string;
  orderNumber?: string;
  patternTaskId?: string;
  preoccupyLength: number;
  unit: string;
  status: FabricPreoccupyStatus;
  statusLabel: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FabricAdjustRecord {
  id: string;
  fabricInventoryId: string;
  adjustType: FabricAdjustType;
  adjustTypeLabel: string;
  adjustLength: number;
  beforeStock: number;
  afterStock: number;
  operator: string;
  remark?: string;
  orderId?: string;
  patternTaskId?: string;
  createdAt: string;
}

export interface PurchaseSuggestion {
  id: string;
  fabricInventoryId: string;
  fabricName: string;
  color: string;
  currentStock: number;
  preoccupiedLength: number;
  safetyStock: number;
  gapLength: number;
  suggestedPurchaseLength: number;
  estimatedCost: number;
  unit: string;
  currency: string;
  latestOrderDate: string;
  affectedOrders: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    deliveryDate: string;
    requiredLength: number;
  }[];
  supplier: string;
  purchaseCycle: number;
  status: PurchaseSuggestionStatus;
  statusLabel: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FabricInventoryStats {
  highConsumptionFabrics: {
    fabricName: string;
    color: string;
    totalConsumed: number;
    unit: string;
    rank: number;
  }[];
  lowStockWarningCount: number;
  totalPreoccupiedLength: number;
  totalPreoccupiedUnit: string;
  estimatedPurchaseCost: number;
  currency: string;
  delayedOrdersDueToFabric: number;
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
  stageInfo?: StageInfo;
  communications?: CommunicationRecord[];
  changeOrders?: ChangeOrder[];
  pendingChangeCount?: number;
  fabricPreoccupyRecords?: FabricPreoccupyRecord[];
}
