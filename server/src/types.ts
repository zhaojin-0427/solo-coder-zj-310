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

export type OrderStatus = 'pending' | 'confirmed' | 'pattern_making' | 'fabric_prep' | 'sewing' | 'fitting' | 'customer_approved' | 'shipping' | 'completed' | 'cancelled';

export type FittingStatus = 'pending' | 'photo_taken' | 'customer_review' | 'rework_needed' | 'approved';

export interface OrderItem {
  styleReference?: string;
  fabricPreference: string;
  accessories?: string;
  notes?: string;
  quantity: number;
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
}

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  operator: string;
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
}

export interface StatsData {
  reworkRate: { dollId: string; dollName: string; rate: number; totalOrders: number; reworkOrders: number }[];
  fabricConsumption: { fabricName: string; color: string; totalUsed: number; unit: string }[];
  avgCycleTime: number;
  styleDistribution: { style: string; count: number; percentage: number }[];
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

export interface StageInfo {
  stage: BusinessStage;
  stageLabel: string;
  nextAction?: string;
  blockReason?: string;
  patternStatus?: string;
  fittingStatus?: string;
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

export interface KeyMilestone {
  label: string;
  timestamp?: string;
  status: string;
}

export interface DeliveryRiskData {
  overdueOrders: DeliveryRiskItem[];
  pendingFittingsOver48h: DeliveryRiskItem[];
  highReworkOrders: DeliveryRiskItem[];
  stageDurations: StageDuration[];
}

export type CommunicationChannel = 'wechat' | 'phone' | 'face' | 'email' | 'other';

export interface CommunicationRecord {
  id: string;
  orderId: string;
  channel: CommunicationChannel;
  content: string;
  imagePlaceholders: string[];
  conclusion: string;
  follower: string;
  createdAt: string;
  updatedAt: string;
}

export type ChangeType = 'fabric' | 'accessory' | 'style' | 'delivery_date' | 'quantity';

export type ChangeOrderStatus = 'pending' | 'confirmed' | 'rejected';

export interface ChangeOrder {
  id: string;
  orderId: string;
  changeType: ChangeType;
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
  consumed: '#22c55e',
  released: '#94a3b8',
  pending_purchase: '#ef4444',
};

export interface FabricInventory {
  id: string;
  fabricName: string;
  color: string;
  width: number;
  stockLength: number;
  safetyStock: number;
  supplier: string;
  purchaseCycle: number;
  unitPrice: number;
  unit: 'meter' | 'yard';
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FabricPreoccupyRecord {
  id: string;
  fabricInventoryId: string;
  fabricName: string;
  color: string;
  orderId: string;
  orderNumber?: string;
  patternTaskId: string;
  preoccupyLength: number;
  unit: 'meter' | 'yard';
  status: FabricPreoccupyStatus;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export type FabricAdjustType = 'stock_in' | 'manual_adjust' | 'release_preoccupy' | 'consume';

export const FABRIC_ADJUST_TYPE_LABELS: Record<FabricAdjustType, string> = {
  stock_in: '入库',
  manual_adjust: '手动调整',
  release_preoccupy: '释放预占',
  consume: '消耗',
};

export interface FabricAdjustRecord {
  id: string;
  fabricInventoryId: string;
  fabricName: string;
  color: string;
  adjustType: FabricAdjustType;
  changeLength: number;
  beforeStock: number;
  afterStock: number;
  unit: 'meter' | 'yard';
  operator: string;
  remark?: string;
  relatedOrderId?: string;
  relatedPatternTaskId?: string;
  createdAt: string;
}

export interface PurchaseSuggestion {
  id: string;
  fabricInventoryId: string;
  fabricName: string;
  color: string;
  width: number;
  currentStock: number;
  safetyStock: number;
  preoccupiedLength: number;
  gapLength: number;
  suggestedPurchaseLength: number;
  unit: 'meter' | 'yard';
  estimatedCost: number;
  unitPrice: number;
  supplier: string;
  purchaseCycle: number;
  latestOrderDate: string;
  affectedOrders: { orderId: string; orderNumber: string; deliveryDate: string; customerName: string; requiredLength: number }[];
  status: 'pending' | 'ordered' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export const PURCHASE_SUGGESTION_STATUS_LABELS: Record<string, string> = {
  pending: '待采购',
  ordered: '已下单',
  completed: '已到货',
};

export const PURCHASE_SUGGESTION_STATUS_COLORS: Record<string, string> = {
  pending: '#ef4444',
  ordered: '#f59e0b',
  completed: '#22c55e',
};

export interface FabricInventoryStats {
  totalFabricTypes: number;
  lowStockCount: number;
  totalPreoccupiedLength: number;
  totalEstimatedPurchaseCost: number;
  delayedOrdersDueToShortage: number;
  topConsumedFabrics: { fabricName: string; color: string; totalUsed: number; unit: string }[];
  inventoryValue: number;
  turnoverRate: number;
}
