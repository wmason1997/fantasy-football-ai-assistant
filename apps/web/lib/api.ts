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

  // Trade endpoints
  trades: {
    generateRecommendations: async (leagueId: string, params?: { week?: number; season?: number; maxRecommendations?: number }) => {
      const response = await api.post('/trades/recommendations/generate', { leagueId, ...params });
      return response.data;
    },

    getRecommendations: async (leagueId: string, params?: { week?: number; season?: number; status?: string }) => {
      const response = await api.get('/trades/recommendations', { params: { leagueId, ...params } });
      return response.data;
    },

    getRecommendation: async (id: string) => {
      const response = await api.get(`/trades/recommendations/${id}`);
      return response.data;
    },

    evaluateTrade: async (data: {
      leagueId: string;
      myPlayerIds: string[];
      targetPlayerIds: string[];
      targetTeamId: string;
    }) => {
      const response = await api.post('/trades/evaluate', data);
      return response.data;
    },

    trackResponse: async (recommendationId: string, action: 'viewed' | 'sent' | 'accepted' | 'rejected' | 'dismissed') => {
      const response = await api.post('/trades/track-response', { recommendationId, action });
      return response.data;
    },

    syncTransactions: async (leagueId: string, params?: { week?: number; season?: number }) => {
      const response = await api.post('/trades/sync-transactions', { leagueId, ...params });
      return response.data;
    },

    getOpponentProfiles: async (leagueId: string) => {
      const response = await api.get('/trades/opponent-profiles', { params: { leagueId } });
      return response.data;
    },

    getOpponentProfile: async (leagueId: string, teamId: string) => {
      const response = await api.get(`/trades/opponent-profiles/${teamId}`, { params: { leagueId } });
      return response.data;
    },
  },

  // Waiver endpoints
  waivers: {
    generateRecommendations: async (leagueId: string, params?: { week?: number; season?: number; maxRecommendations?: number }) => {
      const response = await api.post('/waivers/recommendations/generate', { leagueId, ...params });
      return response.data;
    },

    getRecommendations: async (leagueId: string, params?: { week?: number; season?: number; status?: string }) => {
      const response = await api.get('/waivers/recommendations', { params: { leagueId, ...params } });
      return response.data;
    },

    getRecommendation: async (id: string) => {
      const response = await api.get(`/waivers/recommendations/${id}`);
      return response.data;
    },

    calculateBid: async (data: { leagueId: string; playerId: string; week?: number; season?: number }) => {
      const response = await api.post('/waivers/calculate-bid', data);
      return response.data;
    },

    getTargets: async (leagueId: string, params?: { week?: number; season?: number; position?: string; minOpportunity?: number }) => {
      const response = await api.get('/waivers/targets', { params: { leagueId, ...params } });
      return response.data;
    },

    getPositionalNeeds: async (leagueId: string, params?: { week?: number; season?: number }) => {
      const response = await api.get('/waivers/positional-needs', { params: { leagueId, ...params } });
      return response.data;
    },

    trackClaim: async (recommendationId: string, action: 'viewed' | 'claimed' | 'missed' | 'dismissed') => {
      const response = await api.post('/waivers/track-claim', { recommendationId, action });
      return response.data;
    },

    getHistory: async (leagueId: string, season?: number) => {
      const response = await api.get('/waivers/history', { params: { leagueId, season } });
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
