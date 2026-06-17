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
