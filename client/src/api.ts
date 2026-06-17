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
};
