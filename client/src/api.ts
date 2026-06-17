import axios from 'axios';
import {
  DollTemplate,
  Order,
  PatternTask,
  FittingRecord,
  StatsData,
  SummaryData,
  StageInfo,
  DeliveryRiskData,
  CommunicationRecord,
  ChangeOrder,
  ChangeAnalysisData,
  FabricInventory,
  FabricPreoccupyRecord,
  FabricAdjustRecord,
  PurchaseSuggestion,
  FabricInventoryStats,
} from './types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const dollApi = {
  getAll: (params?: { brand?: string; model?: string }) =>
    api.get<ApiResponse<DollTemplate[]>>('/dolls', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<DollTemplate>>(`/dolls/${id}`).then(r => r.data),
  create: (data: Partial<DollTemplate>) =>
    api.post<ApiResponse<DollTemplate>>('/dolls', data).then(r => r.data),
  update: (id: string, data: Partial<DollTemplate>) =>
    api.put<ApiResponse<DollTemplate>>(`/dolls/${id}`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete<ApiResponse<void>>(`/dolls/${id}`).then(r => r.data),
};

export const orderApi = {
  getAll: (params?: { status?: string; customerName?: string; dollId?: string }) =>
    api.get<ApiResponse<Order[]>>('/orders', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`).then(r => r.data),
  create: (data: Partial<Order>) =>
    api.post<ApiResponse<Order>>('/orders', data).then(r => r.data),
  update: (id: string, data: Partial<Order>) =>
    api.put<ApiResponse<Order>>(`/orders/${id}`, data).then(r => r.data),
  updateStatus: (
    id: string,
    data: { status: string; note?: string; operator?: string }
  ) => api.patch<ApiResponse<Order>>(`/orders/${id}/status`, data).then(r => r.data),
};

export const patternApi = {
  getAll: (params?: { status?: string; orderId?: string; designer?: string }) =>
    api.get<ApiResponse<PatternTask[]>>('/patterns', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<PatternTask>>(`/patterns/${id}`).then(r => r.data),
  create: (data: Partial<PatternTask>) =>
    api.post<ApiResponse<{ task: PatternTask; stageInfo?: StageInfo }>>('/patterns', data).then(r => r.data),
  update: (id: string, data: Partial<PatternTask>) =>
    api.put<ApiResponse<PatternTask>>(`/patterns/${id}`, data).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<{ task: PatternTask; stageInfo?: StageInfo }>>(`/patterns/${id}/status`, { status }).then(r => r.data),
  rework: (id: string) =>
    api.patch<ApiResponse<{ task: PatternTask; stageInfo?: StageInfo }>>(`/patterns/${id}/rework`, {}).then(r => r.data),
};

export const fittingApi = {
  getAll: (params?: { status?: string; orderId?: string }) =>
    api.get<ApiResponse<FittingRecord[]>>('/fittings', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<FittingRecord>>(`/fittings/${id}`).then(r => r.data),
  create: (data: Partial<FittingRecord>) =>
    api.post<ApiResponse<{ record: FittingRecord; stageInfo?: StageInfo }>>('/fittings', data).then(r => r.data),
  update: (id: string, data: Partial<FittingRecord>) =>
    api.put<ApiResponse<FittingRecord>>(`/fittings/${id}`, data).then(r => r.data),
  updateStatus: (
    id: string,
    data: { status: string; customerFeedback?: string; reworkSuggestions?: string[] }
  ) =>
    api.patch<ApiResponse<{ record: FittingRecord; stageInfo?: StageInfo }>>(`/fittings/${id}/status`, data).then(r => r.data),
};

export const statsApi = {
  getStats: () =>
    api.get<ApiResponse<StatsData>>('/stats').then(r => r.data),
  getSummary: () =>
    api.get<ApiResponse<SummaryData>>('/stats/summary').then(r => r.data),
  getDeliveryRisk: () =>
    api.get<ApiResponse<DeliveryRiskData>>('/stats/delivery-risk').then(r => r.data),
  getChangeAnalysis: () =>
    api.get<ApiResponse<ChangeAnalysisData>>('/stats/change-analysis').then(r => r.data),
};

export const communicationApi = {
  getAll: (params?: { orderId?: string }) =>
    api.get<ApiResponse<CommunicationRecord[]>>('/communications', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<CommunicationRecord>>(`/communications/${id}`).then(r => r.data),
  create: (data: Partial<CommunicationRecord> & { orderId: string; channel: string; content: string; follower: string }) =>
    api.post<ApiResponse<CommunicationRecord>>('/communications', data).then(r => r.data),
  update: (id: string, data: Partial<CommunicationRecord>) =>
    api.put<ApiResponse<CommunicationRecord>>(`/communications/${id}`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete<ApiResponse<void>>(`/communications/${id}`).then(r => r.data),
};

export const changeOrderApi = {
  getAll: (params?: { orderId?: string; status?: string }) =>
    api.get<ApiResponse<ChangeOrder[]>>('/change-orders', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<ChangeOrder>>(`/change-orders/${id}`).then(r => r.data),
  preview: (data: { orderId: string; changeType: string; beforeValue: string; afterValue: string; description?: string; priceDiff?: number; estimatedDelayDays?: number }) =>
    api.post<ApiResponse<ChangeOrder>>('/change-orders/preview', data).then(r => r.data),
  create: (data: Partial<ChangeOrder> & { orderId: string; changeType: string; beforeValue: string; afterValue: string; operator: string }) =>
    api.post<ApiResponse<ChangeOrder>>('/change-orders', data).then(r => r.data),
  confirm: (id: string, data: { confirmedBy: string }) =>
    api.patch<ApiResponse<{ changeOrder: ChangeOrder; updatedOrder?: Order }>>(`/change-orders/${id}/confirm`, data).then(r => r.data),
  reject: (id: string, data: { rejectedBy: string; rejectedReason: string }) =>
    api.patch<ApiResponse<ChangeOrder>>(`/change-orders/${id}/reject`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete<ApiResponse<void>>(`/change-orders/${id}`).then(r => r.data),
};

export const fabricInventoryApi = {
  getAll: (params?: { fabricName?: string; color?: string; supplier?: string; belowSafetyStock?: boolean }) =>
    api.get<ApiResponse<FabricInventory[]>>('/fabric-inventory', { params }).then(r => r.data),
  getById: (id: string) =>
    api.get<ApiResponse<FabricInventory>>(`/fabric-inventory/${id}`).then(r => r.data),
  getStats: () =>
    api.get<ApiResponse<FabricInventoryStats>>('/fabric-inventory/stats').then(r => r.data),
  getPurchaseSuggestions: (params?: { status?: string }) =>
    api.get<ApiResponse<PurchaseSuggestion[]>>('/fabric-inventory/purchase-suggestions', { params }).then(r => r.data),
  create: (data: Partial<FabricInventory>) =>
    api.post<ApiResponse<FabricInventory>>('/fabric-inventory', data).then(r => r.data),
  update: (id: string, data: Partial<FabricInventory>) =>
    api.put<ApiResponse<FabricInventory>>(`/fabric-inventory/${id}`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete<ApiResponse<void>>(`/fabric-inventory/${id}`).then(r => r.data),
  stockIn: (id: string, data: { stockInLength: number; operator: string; remark?: string }) =>
    api.post<ApiResponse<FabricInventory>>(`/fabric-inventory/${id}/stock-in`, data).then(r => r.data),
  manualAdjust: (id: string, data: { adjustLength: number; operator: string; remark?: string }) =>
    api.post<ApiResponse<FabricInventory>>(`/fabric-inventory/${id}/manual-adjust`, data).then(r => r.data),
  preoccupy: (data: { fabricInventoryId: string; orderId: string; patternTaskId?: string; preoccupyLength: number; operator: string; remark?: string }) =>
    api.post<ApiResponse<FabricPreoccupyRecord>>('/fabric-inventory/preoccupy', data).then(r => r.data),
  releasePreoccupy: (id: string, data: { preoccupyRecordId: string; operator: string; remark?: string }) =>
    api.post<ApiResponse<FabricInventory>>(`/fabric-inventory/${id}/release-preoccupy`, data).then(r => r.data),
  releaseByOrder: (orderId: string, data: { operator: string; remark?: string }) =>
    api.post<ApiResponse<{ releasedCount: number; releasedLength: number }>>(`/fabric-inventory/release-by-order/${orderId}`, data).then(r => r.data),
  consumeByPattern: (patternTaskId: string, data: { operator: string; remark?: string }) =>
    api.post<ApiResponse<{ consumedCount: number; consumedLength: number }>>(`/fabric-inventory/consume-by-pattern/${patternTaskId}`, data).then(r => r.data),
  getByPattern: (patternTaskId: string) =>
    api.get<ApiResponse<FabricPreoccupyRecord[]>>(`/fabric-inventory/by-pattern/${patternTaskId}`).then(r => r.data),
  getByOrder: (orderId: string) =>
    api.get<ApiResponse<FabricPreoccupyRecord[]>>(`/fabric-inventory/by-order/${orderId}`).then(r => r.data),
  getAdjustRecords: (fabricInventoryId: string) =>
    api.get<ApiResponse<FabricAdjustRecord[]>>(`/fabric-inventory/${fabricInventoryId}/adjust-records`).then(r => r.data),
};
