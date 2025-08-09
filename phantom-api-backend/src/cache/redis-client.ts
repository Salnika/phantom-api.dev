import { createClient, RedisClientType } from 'redis';
import { logger } from '../logger';

/**
 * Redis client manager with connection handling and graceful degradation
 */
export class RedisManager {
  private static instance: RedisManager | null = null;
  private client: RedisClientType | null = null;
  private isEnabled: boolean;
  private isConnected: boolean = false;
  private connectionRetryCount: number = 0;
  private maxRetryCount: number = 5;
  private retryDelay: number = 5000; // 5 seconds

  private constructor() {
    this.isEnabled = process.env.REDIS_ENABLED === 'true';
    if (this.isEnabled) {
      this.initializeClient();
    }
  }

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private initializeClient(): void {
    const redisConfig = {
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0', 10),
    };

    this.client = createClient(redisConfig);

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
      this.connectionRetryCount = 0;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
      this.handleConnectionError();
    });

    this.client.on('end', () => {
      logger.info('Redis client connection ended');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isEnabled || !this.client) {
      logger.info('Redis caching disabled');
      return;
    }

    try {
      await this.client.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.handleConnectionError();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis:', error);
      }
    }
  }

  private handleConnectionError(): void {
    if (this.connectionRetryCount < this.maxRetryCount) {
      this.connectionRetryCount++;
      logger.info(`Attempting to reconnect to Redis (${this.connectionRetryCount}/${this.maxRetryCount}) in ${this.retryDelay}ms`);
      
      setTimeout(async () => {
        try {
          if (this.client) {
            await this.client.connect();
          }
        } catch (error) {
          logger.error('Redis reconnection failed:', error);
        }
      }, this.retryDelay);
    } else {
      logger.warn('Max Redis reconnection attempts reached. Operating without cache.');
    }
  }

  isAvailable(): boolean {
    return this.isEnabled && this.isConnected && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.get(this.prefixKey(key));
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const prefixedKey = this.prefixKey(key);
      const defaultTTL = parseInt(process.env.CACHE_TTL || '300', 10);
      const ttl = ttlSeconds || defaultTTL;

      await this.client!.setEx(prefixedKey, ttl, value);
      return true;
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client!.del(this.prefixKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error:', { key, error });
      return false;
    }
  }

  async delPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const keys = await this.client!.keys(this.prefixKey(pattern));
      if (keys.length === 0) return 0;

      const result = await this.client!.del(keys);
      logger.info(`Deleted ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      logger.error('Redis DEL pattern error:', { pattern, error });
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client!.exists(this.prefixKey(key));
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error });
      return false;
    }
  }

  async setJSON(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error) {
      logger.error('Redis setJSON error:', { key, error });
      return false;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const jsonString = await this.get(key);
      if (!jsonString) return null;
      return JSON.parse(jsonString) as T;
    } catch (error) {
      logger.error('Redis getJSON error:', { key, error });
      return null;
    }
  }

  private prefixKey(key: string): string {
    return `phantom:${key}`;
  }

  /**
   * Generate cache key hash for complex queries
   */
  generateQueryHash(tableName: string, query: any): string {
    const queryString = JSON.stringify(query);
    const hash = require('crypto').createHash('sha256').update(queryString).digest('hex').substring(0, 16);
    return `api:resource:${tableName}:query:${hash}`;
  }

  /**
   * Get health status of Redis connection
   */
  getHealthStatus(): { enabled: boolean; connected: boolean; retryCount: number } {
    return {
      enabled: this.isEnabled,
      connected: this.isConnected,
      retryCount: this.connectionRetryCount
    };
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();