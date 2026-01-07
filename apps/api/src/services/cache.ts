import Redis from 'ioredis';
import { config } from '../config';

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });
  }

  return redisClient;
}

/**
 * Connect to Redis (call this on server startup)
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status !== 'ready' && client.status !== 'connecting') {
    await client.connect();
  }
}

/**
 * Disconnect from Redis (call this on server shutdown)
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Cache key prefixes
export const CACHE_KEYS = {
  PLAYER_PROJECTION: (playerId: string, week: number, season: number) =>
    `projection:${playerId}:${week}:${season}`,
  PLAYER_PROJECTIONS_WEEK: (week: number, season: number) =>
    `projections:week:${week}:${season}`,
  PLAYER_WEEK_STATS: (playerId: string, week: number, season: number) =>
    `stats:${playerId}:${week}:${season}`,
  PERFORMANCE_RATIO: (playerId: string, season: number, week: number) =>
    `performance:${playerId}:${season}:${week}`,
  ALL_PLAYERS: 'players:all',
  LEAGUE_ROSTERS: (leagueId: string) => `league:${leagueId}:rosters`,
  SLEEPER_PLAYERS: 'sleeper:players',
};

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  PLAYER_PROJECTION: 24 * 60 * 60, // 24 hours
  PLAYER_PROJECTIONS_WEEK: 24 * 60 * 60, // 24 hours
  WEEK_STATS_COMPLETED: 24 * 60 * 60, // 24 hours for past weeks
  WEEK_STATS_CURRENT: 60 * 60, // 1 hour for current week
  PERFORMANCE_RATIO: 4 * 60 * 60, // 4 hours
  ALL_PLAYERS: 6 * 60 * 60, // 6 hours
  LEAGUE_ROSTERS: 15 * 60, // 15 minutes
  SLEEPER_PLAYERS: 24 * 60 * 60, // 24 hours
  INJURY_STATUS_GAME_WINDOW: 2 * 60, // 2 minutes during game windows
  INJURY_STATUS_NORMAL: 60 * 60, // 1 hour otherwise
};

/**
 * Cache service for player projections and related data
 */
export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Get player projection from cache
   */
  async getPlayerProjection(
    playerId: string,
    week: number,
    season: number
  ): Promise<any | null> {
    try {
      const key = CACHE_KEYS.PLAYER_PROJECTION(playerId, week, season);
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting projection from cache:', error);
      return null;
    }
  }

  /**
   * Set player projection in cache
   */
  async setPlayerProjection(
    playerId: string,
    week: number,
    season: number,
    projection: any,
    ttl: number = CACHE_TTL.PLAYER_PROJECTION
  ): Promise<void> {
    try {
      const key = CACHE_KEYS.PLAYER_PROJECTION(playerId, week, season);
      await this.redis.setex(key, ttl, JSON.stringify(projection));
    } catch (error) {
      console.error('Error setting projection in cache:', error);
    }
  }

  /**
   * Get all projections for a specific week
   */
  async getWeekProjections(
    week: number,
    season: number
  ): Promise<any[] | null> {
    try {
      const key = CACHE_KEYS.PLAYER_PROJECTIONS_WEEK(week, season);
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting week projections from cache:', error);
      return null;
    }
  }

  /**
   * Set all projections for a specific week
   */
  async setWeekProjections(
    week: number,
    season: number,
    projections: any[],
    ttl: number = CACHE_TTL.PLAYER_PROJECTIONS_WEEK
  ): Promise<void> {
    try {
      const key = CACHE_KEYS.PLAYER_PROJECTIONS_WEEK(week, season);
      await this.redis.setex(key, ttl, JSON.stringify(projections));
    } catch (error) {
      console.error('Error setting week projections in cache:', error);
    }
  }

  /**
   * Invalidate projection cache for a player
   */
  async invalidatePlayerProjection(
    playerId: string,
    week: number,
    season: number
  ): Promise<void> {
    try {
      const key = CACHE_KEYS.PLAYER_PROJECTION(playerId, week, season);
      await this.redis.del(key);
    } catch (error) {
      console.error('Error invalidating projection cache:', error);
    }
  }

  /**
   * Invalidate all projections for a week
   */
  async invalidateWeekProjections(week: number, season: number): Promise<void> {
    try {
      const key = CACHE_KEYS.PLAYER_PROJECTIONS_WEEK(week, season);
      await this.redis.del(key);
    } catch (error) {
      console.error('Error invalidating week projections:', error);
    }
  }

  /**
   * Get player week stats from cache
   */
  async getPlayerWeekStats(
    playerId: string,
    week: number,
    season: number
  ): Promise<any | null> {
    try {
      const key = CACHE_KEYS.PLAYER_WEEK_STATS(playerId, week, season);
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting player week stats from cache:', error);
      return null;
    }
  }

  /**
   * Set player week stats in cache
   */
  async setPlayerWeekStats(
    playerId: string,
    week: number,
    season: number,
    stats: any,
    ttl: number = CACHE_TTL.WEEK_STATS_COMPLETED
  ): Promise<void> {
    try {
      const key = CACHE_KEYS.PLAYER_WEEK_STATS(playerId, week, season);
      await this.redis.setex(key, ttl, JSON.stringify(stats));
    } catch (error) {
      console.error('Error setting player week stats in cache:', error);
    }
  }

  /**
   * Get performance ratio from cache
   */
  async getPerformanceRatio(
    playerId: string,
    season: number,
    week: number
  ): Promise<any | null> {
    try {
      const key = CACHE_KEYS.PERFORMANCE_RATIO(playerId, season, week);
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting performance ratio from cache:', error);
      return null;
    }
  }

  /**
   * Set performance ratio in cache
   */
  async setPerformanceRatio(
    playerId: string,
    season: number,
    week: number,
    ratio: any,
    ttl: number = CACHE_TTL.PERFORMANCE_RATIO
  ): Promise<void> {
    try {
      const key = CACHE_KEYS.PERFORMANCE_RATIO(playerId, season, week);
      await this.redis.setex(key, ttl, JSON.stringify(ratio));
    } catch (error) {
      console.error('Error setting performance ratio in cache:', error);
    }
  }

  /**
   * Generic cache get with JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`Error getting ${key} from cache:`, error);
      return null;
    }
  }

  /**
   * Generic cache set with JSON stringification
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      console.error(`Error setting ${key} in cache:`, error);
    }
  }

  /**
   * Delete a cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Error deleting ${key} from cache:`, error);
    }
  }

  /**
   * Delete multiple cache keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`Error deleting pattern ${pattern} from cache:`, error);
    }
  }

  /**
   * Check if Redis is connected and healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
