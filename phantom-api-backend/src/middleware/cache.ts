import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { cacheService } from '../cache/cache-service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  skipCache?: boolean; // Skip caching for this request
  varyBy?: string[]; // Additional parameters to vary cache by
}

/**
 * Caching middleware for API responses
 * Automatically caches GET requests and serves from cache when available
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET' || options.skipCache) {
      return next();
    }

    try {
      // Generate cache key based on route and query parameters
      const cacheKey = generateCacheKey(req, options.varyBy);
      
      // Try to get cached response
      const cachedResponse = await cacheService.getCachedQueryResult('api_response', { key: cacheKey });
      
      if (cachedResponse) {
        logger.debug(`Serving cached response for: ${req.path}`);
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }

      // Cache miss - continue with request and cache the response
      res.set('X-Cache', 'MISS');
      
      // Intercept the response to cache it
      const originalJson = res.json;
      res.json = function(body: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.cacheQueryResult('api_response', { key: cacheKey }, body, options.ttl)
            .catch(error => logger.error('Failed to cache response:', error));
        }
        
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Resource-specific caching middleware for dynamic API endpoints
 */
export function resourceCacheMiddleware(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET' || options.skipCache) {
      return next();
    }

    try {
      const resourceName = req.params.resource;
      const action = req.params.action;
      
      // Only cache read operations
      if (!['find', 'findOne', 'count'].includes(action)) {
        return next();
      }

      const queryParams = {
        action,
        query: req.query,
        body: req.body
      };

      // Try to get cached result
      const cachedResult = await cacheService.getCachedQueryResult(resourceName, queryParams);
      
      if (cachedResult) {
        logger.debug(`Serving cached resource data: ${resourceName}/${action}`);
        res.set('X-Cache', 'HIT');
        return res.json({
          success: true,
          data: cachedResult,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      res.set('X-Cache', 'MISS');
      
      // Intercept response to cache it
      const originalJson = res.json;
      res.json = function(body: any) {
        // Cache successful resource responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
          cacheService.cacheQueryResult(resourceName, queryParams, body.data, options.ttl)
            .catch(error => logger.error('Failed to cache resource response:', error));
        }
        
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Resource cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware for write operations
 */
export function cacheInvalidationMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceName = req.params.resource;
    const action = req.params.action;
    
    // Track write operations that should invalidate cache
    const writeActions = ['create', 'update', 'delete', 'upsert'];
    
    if (writeActions.includes(action) && resourceName) {
      // Store original end function
      const originalEnd = res.end;
      
      res.end = function(chunk?: any, encoding?: any) {
        // Only invalidate on successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.invalidateTableCache(resourceName)
            .catch(error => logger.error('Failed to invalidate cache:', error));
        }
        
        return originalEnd.call(this, chunk, encoding);
      };
    }
    
    next();
  };
}

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(req: Request, varyBy?: string[]): string {
  const baseKey = `${req.route?.path || req.path}`;
  const queryString = new URLSearchParams(req.query as any).toString();
  
  let cacheKey = `${baseKey}?${queryString}`;
  
  if (varyBy && varyBy.length > 0) {
    const varyByParams = varyBy.map(param => {
      const value = req.headers[param] || req.get(param) || req.query[param];
      return `${param}=${value}`;
    }).join('&');
    
    cacheKey += `&vary=${varyByParams}`;
  }
  
  return cacheKey;
}

/**
 * Conditional caching based on request headers
 */
export function conditionalCache(condition: (req: Request) => boolean, options: CacheOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      return cacheMiddleware(options)(req, res, next);
    }
    next();
  };
}

/**
 * Cache warming middleware - preloads cache with common queries
 */
export function cacheWarmingMiddleware(warmUpQueries: { [resource: string]: any[] }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // This runs async in background, doesn't affect request timing
    if (req.headers['x-warm-cache'] === 'true') {
      Object.entries(warmUpQueries).forEach(([resource, queries]) => {
        cacheService.warmUpCache(resource, queries)
          .catch(error => logger.error('Cache warming failed:', error));
      });
    }
    next();
  };
}