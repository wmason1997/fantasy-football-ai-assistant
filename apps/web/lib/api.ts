import axios, { AxiosError } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  League,
  ConnectLeagueRequest,
} from '@fantasy-football/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API client
export const apiClient = {
  // Auth endpoints
  auth: {
    register: async (data: RegisterRequest): Promise<AuthResponse> => {
      const response = await api.post<AuthResponse>('/auth/register', data);
      return response.data;
    },

    login: async (data: LoginRequest): Promise<AuthResponse> => {
      const response = await api.post<AuthResponse>('/auth/login', data);
      return response.data;
    },

    me: async (): Promise<{ user: User }> => {
      const response = await api.get<{ user: User }>('/auth/me');
      return response.data;
    },
  },

  // League endpoints
  leagues: {
    connect: async (data: ConnectLeagueRequest): Promise<{ league: League }> => {
      const response = await api.post<{ league: League }>('/leagues/connect', data);
      return response.data;
    },

    getAll: async (): Promise<{ leagues: League[] }> => {
      const response = await api.get<{ leagues: League[] }>('/leagues');
      return response.data;
    },

    getById: async (id: string): Promise<{ league: League }> => {
      const response = await api.get<{ league: League }>(`/leagues/${id}`);
      return response.data;
    },

    sync: async (id: string): Promise<{ success: boolean; message: string }> => {
      const response = await api.post<{ success: boolean; message: string }>(
        `/leagues/${id}/sync`
      );
      return response.data;
    },
  },
};

// Error helper
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};
