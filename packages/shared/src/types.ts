// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  notificationPreferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  injuryAlerts: boolean;
  tradeSuggestions: boolean;
  waiverReminders: boolean;
  autoSubstitute: boolean;
}

// Auth types
export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

// League types
export interface League {
  id: string;
  userId: string;
  platform: 'sleeper' | 'espn' | 'yahoo';
  platformLeagueId: string;
  leagueName?: string;
  teamName?: string;
  platformTeamId?: string;
  scoringSettings?: Record<string, any>;
  rosterSettings?: Record<string, any>;
  faabBudget?: number;
  currentFaab?: number;
  waiverPriority?: number;
  isActive: boolean;
  lastSynced?: Date;
  createdAt: Date;
  rosters?: Roster[];
}

export interface ConnectLeagueRequest {
  platformLeagueId: string;
  platformUserId?: string;
}

// Player types
export interface Player {
  id: string;
  fullName: string;
  position: string;
  team?: string;
  status?: string;
  injuryDesignation?: string;
  byeWeek?: number;
  lastUpdated: Date;
  metadata?: Record<string, any>;
}

// Roster types
export interface Roster {
  id: string;
  leagueId: string;
  playerId: string;
  rosterSlot: string;
  isStarting: boolean;
  acquiredDate?: Date;
  acquisitionCost?: number;
  player?: Player;
}

// API Error types
export interface ApiError {
  error: string;
  details?: any;
}
