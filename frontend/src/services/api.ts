import axios from 'axios';
import type { 
  User, Transaction, Appeal, Alert, GraphData, DashboardStats, MerchantCreateData, MerchantUpdateData
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject auth token if it exists in local storage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const authService = {
  login: async (formData: URLSearchParams) => {
    const response = await api.post<{ access_token: string; token_type: string }>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
  
  register: async (userData: any) => {
    const response = await api.post<User>('/auth/register', userData);
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};

export const transactionService = {
  getAll: async (params?: { status?: string; is_flagged?: boolean; user_email?: string }) => {
    const response = await api.get<Transaction[]>('/transactions/', { params });
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },
  
  create: async (txData: Omit<Transaction, 'id' | 'fraud_score' | 'is_flagged' | 'status' | 'risk_explanation' | 'transaction_time' | 'created_at'>) => {
    const response = await api.post<Transaction>('/transactions/', txData);
    return response.data;
  },
};

export const appealService = {
  getAll: async () => {
    const response = await api.get<Appeal[]>('/appeals/');
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get<Appeal>(`/appeals/${id}`);
    return response.data;
  },
  
  create: async (appealData: { transaction_id: number; reason: string }) => {
    const response = await api.post<Appeal>('/appeals/', appealData);
    return response.data;
  },
  
  update: async (id: number, data: Partial<Appeal>) => {
    const response = await api.put<Appeal>(`/appeals/${id}`, data);
    return response.data;
  },
};

export const graphService = {
  getByTransaction: async (txId: string) => {
    const response = await api.get<GraphData>(`/graph/transaction/${txId}`);
    return response.data;
  },
  
  getGlobal: async (limit = 40) => {
    const response = await api.get<GraphData>('/graph/global', { params: { limit } });
    return response.data;
  },
};

export const adminService = {
  getStats: async () => {
    const response = await api.get<DashboardStats>('/admin/stats');
    return response.data;
  },
  
  getAlerts: async (resolved = false) => {
    const response = await api.get<Alert[]>(`/admin/alerts`, { params: { resolved } });
    return response.data;
  },
  
  resolveAlert: async (id: number) => {
    const response = await api.put<Alert>(`/admin/alerts/${id}/resolve`);
    return response.data;
  },

  getMerchants: async () => {
    const response = await api.get<User[]>('/admin/merchants');
    return response.data;
  },

  createMerchant: async (merchantData: MerchantCreateData) => {
    const response = await api.post<User>('/admin/merchants', merchantData);
    return response.data;
  },

  updateMerchant: async (id: number, merchantData: MerchantUpdateData) => {
    const response = await api.put<User>(`/admin/merchants/${id}`, merchantData);
    return response.data;
  },
};
export default api;
