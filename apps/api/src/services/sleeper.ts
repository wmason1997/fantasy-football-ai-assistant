import { request } from 'undici';
import { config } from '../config';

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  settings: {
    waiver_type: number;
    waiver_budget: number;
  };
  scoring_settings: Record<string, number>;
  roster_positions: string[];
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  settings: {
    waiver_budget_used: number;
    waiver_position: number;
  };
}

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  status: string;
  injury_status: string;
}

interface SleeperUser {
  user_id: string;
  display_name: string;
}

class SleeperService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.sleeperApiBaseUrl;
  }

  private async get<T>(endpoint: string): Promise<T | null> {
    try {
      const { statusCode, body } = await request(`${this.baseUrl}${endpoint}`);

      if (statusCode !== 200) {
        console.error(`Sleeper API error: ${statusCode}`);
        return null;
      }

      const data = await body.json();
      return data as T;
    } catch (error) {
      console.error('Sleeper API request failed:', error);
      return null;
    }
  }

  async getLeague(leagueId: string): Promise<SleeperLeague | null> {
    return this.get<SleeperLeague>(`/league/${leagueId}`);
  }

  async getRosters(leagueId: string): Promise<SleeperRoster[] | null> {
    return this.get<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  }

  async getPlayers(): Promise<Record<string, SleeperPlayer> | null> {
    return this.get<Record<string, SleeperPlayer>>('/players/nfl');
  }

  async getUser(userId: string): Promise<SleeperUser | null> {
    return this.get<SleeperUser>(`/user/${userId}`);
  }

  async getLeagueUsers(leagueId: string): Promise<SleeperUser[] | null> {
    return this.get<SleeperUser[]>(`/league/${leagueId}/users`);
  }

  async getTransactions(leagueId: string, week: number): Promise<any[] | null> {
    return this.get<any[]>(`/league/${leagueId}/transactions/${week}`);
  }
}

export const sleeperService = new SleeperService();
