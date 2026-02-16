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
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  status: string;
  injury_status: string | null;
  injury_body_part: string | null;
  injury_start_date: string | null;
  active: boolean;
  age: number;
  years_exp: number;
  number: number;
  depth_chart_order: number | null;
  birth_date: string | null;
  height: string;
  weight: string;
  college: string;
  // Additional metadata fields
  fantasy_positions?: string[];
  search_rank?: number;
  sport?: string;
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: {
    team_name?: string;
    [key: string]: any;
  };
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

  async getMatchups(leagueId: string, week: number): Promise<any[] | null> {
    return this.get<any[]>(`/league/${leagueId}/matchups/${week}`);
  }

  async getPlayerWeekStats(playerId: string, season: number, week: number): Promise<any | null> {
    return this.get<any>(`/stats/nfl/player/${playerId}?season_type=regular&season=${season}&week=${week}`);
  }

  async getTrendingPlayers(type: 'add' | 'drop', lookback_hours = 24, limit = 25): Promise<any[] | null> {
    return this.get<any[]>(`/players/nfl/trending/${type}?lookback_hours=${lookback_hours}&limit=${limit}`);
  }

  async getUserByUsername(username: string): Promise<SleeperUser | null> {
    return this.get<SleeperUser>(`/user/${username}`);
  }

  async getUserLeagues(userId: string, season: string): Promise<SleeperLeague[] | null> {
    return this.get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);
  }

  /**
   * Get all player stats for a specific week
   * Returns object with playerId as key and stats as value
   */
  async getWeekStats(season: number, week: number): Promise<Record<string, any> | null> {
    return this.get<Record<string, any>>(`/stats/nfl/regular/${season}/${week}`);
  }

  /**
   * Get current NFL state (week, season, season_type)
   */
  async getNflState(): Promise<{
    week: number;
    season: string;
    season_type: string;
    league_season: string;
  } | null> {
    return this.get('/state/nfl');
  }
}

export const sleeperService = new SleeperService();

// Export types for use in other services
export type { SleeperPlayer, SleeperLeague, SleeperRoster, SleeperUser };
