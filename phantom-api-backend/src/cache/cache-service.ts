import { logger } from '../logger';
import { redisManager } from './redis-client';

/**
 * High-level caching service with intelligent invalidation strategies
 */
export class CacheService {
  private static instance: CacheService | null = null;

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Cache API query results
   */
  async cacheQueryResult(tableName: string, queryParams: any, result: any, ttl?: number): Promise<void> {
    const queryKey = redisManager.generateQueryHash(tableName, queryParams);
    const cacheKey = `${queryKey}`;
    
    const cached = await redisManager.setJSON(cacheKey, {
      data: result,
      timestamp: Date.now(),
      tableName
    }, ttl);

    if (cached) {
      logger.debug(`Cached query result: ${cacheKey}`);
    }
  }

  /**
   * Get cached query result
   */
  async getCachedQueryResult(tableName: string, queryParams: any): Promise<any | null> {
    const queryKey = redisManager.generateQueryHash(tableName, queryParams);
    const cacheKey = `${queryKey}`;
    
    const cached = await redisManager.getJSON<{
      data: any;
      timestamp: number;
      tableName: string;
    }>(cacheKey);

    if (cached) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return cached.data;
    }

    logger.debug(`Cache miss: ${cacheKey}`);
    return null;
  }

  /**
   * Cache metadata (schemas, resource definitions)
   */
  async cacheMetadata(resourceName: string, metadata: any, ttl?: number): Promise<void> {
    const cacheKey = `metadata:${resourceName}`;
    const cached = await redisManager.setJSON(cacheKey, metadata, ttl);
    
    if (cached) {
      logger.debug(`Cached metadata: ${resourceName}`);
    }
  }

  /**
   * Get cached metadata
   */
  async getCachedMetadata(resourceName: string): Promise<any | null> {
    const cacheKey = `metadata:${resourceName}`;
    const cached = await redisManager.getJSON(cacheKey);
    
    if (cached) {
      logger.debug(`Metadata cache hit: ${resourceName}`);
      return cached;
    }

    logger.debug(`Metadata cache miss: ${resourceName}`);
    return null;
  }

  /**
   * Cache table schema information
   */
  async cacheTableSchema(tableName: string, schema: any, ttl?: number): Promise<void> {
    const cacheKey = `schema:${tableName}`;
    const cached = await redisManager.setJSON(cacheKey, schema, ttl);
    
    if (cached) {
      logger.debug(`Cached table schema: ${tableName}`);
    }
  }

  /**
   * Get cached table schema
   */
  async getCachedTableSchema(tableName: string): Promise<any | null> {
    const cacheKey = `schema:${tableName}`;
    const cached = await redisManager.getJSON(cacheKey);
    
    if (cached) {
      logger.debug(`Schema cache hit: ${tableName}`);
      return cached;
    }

    logger.debug(`Schema cache miss: ${tableName}`);
    return null;
  }

  /**
   * Invalidate all caches for a specific table when data changes
   */
  async invalidateTableCache(tableName: string): Promise<void> {
    logger.info(`Invalidating cache for table: ${tableName}`);
    
    // Invalidate all query caches for this table
    await redisManager.delPattern(`api:resource:${tableName}:query:*`);
    
    // Invalidate metadata cache
    await redisManager.del(`metadata:${tableName}`);
    
    // Invalidate schema cache
    await redisManager.del(`schema:${tableName}`);
    
    logger.info(`Cache invalidation completed for table: ${tableName}`);
  }

  /**
   * Invalidate metadata cache (when schemas change)
   */
  async invalidateMetadataCache(): Promise<void> {
    logger.info('Invalidating all metadata cache');
    await redisManager.delPattern('metadata:*');
    await redisManager.delPattern('schema:*');
  }

  /**
   * Cache session/authentication data
   */
  async cacheSession(userId: string, sessionData: any, ttl?: number): Promise<void> {
    const cacheKey = `session:user:${userId}`;
    const cached = await redisManager.setJSON(cacheKey, sessionData, ttl);
    
    if (cached) {
      logger.debug(`Cached session: ${userId}`);
    }
  }

  /**
   * Get cached session data
   */
  async getCachedSession(userId: string): Promise<any | null> {
    const cacheKey = `session:user:${userId}`;
    const cached = await redisManager.getJSON(cacheKey);
    
    if (cached) {
      logger.debug(`Session cache hit: ${userId}`);
      return cached;
    }

    return null;
  }

  /**
   * Invalidate user session cache
   */
  async invalidateSessionCache(userId: string): Promise<void> {
    const cacheKey = `session:user:${userId}`;
    await redisManager.del(cacheKey);
    logger.debug(`Invalidated session cache: ${userId}`);
  }

  /**
   * Health check for cache service
   */
  getHealthStatus(): { redis: any; cache: boolean } {
    return {
      redis: redisManager.getHealthStatus(),
      cache: redisManager.isAvailable()
    };
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAllCache(): Promise<void> {
    logger.warn('Clearing ALL cache data');
    await redisManager.delPattern('*');
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(tableName: string, commonQueries: any[]): Promise<void> {
    logger.info(`Warming up cache for table: ${tableName}`);
    
    for (const query of commonQueries) {
      // This would be implemented based on your specific query patterns
      // For now, we'll just log the intent
      logger.debug(`Cache warm-up query for ${tableName}:`, query);
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();