import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger';
import { pathManager } from '../storage/path-manager';
import { cacheService } from '../cache/cache-service';

// In-memory cache for loaded metadata (fallback when Redis unavailable)
const metaCache = new Map<string, any>();

/**
 * Loads resource metadata from a JSON file, utilizing Redis and in-memory cache for performance.
 * @param resource The name of the resource (e.g., 'User', 'Product').
 * @returns A Promise that resolves to the resource's metadata object, or null if not found or an error occurs.
 */
export async function loadResourceMeta(resource: string): Promise<any> {
  // Check Redis cache first
  const cachedMeta = await cacheService.getCachedMetadata(resource);
  if (cachedMeta) {
    // Also update in-memory cache for faster access
    metaCache.set(resource, cachedMeta);
    return cachedMeta;
  }

  // Check in-memory cache as fallback
  if (metaCache.has(resource)) {
    const meta = metaCache.get(resource);
    // Update Redis cache in background
    cacheService.cacheMetadata(resource, meta).catch(error => 
      logger.warn('Failed to update Redis metadata cache', { resource, error })
    );
    return meta;
  }

  try {
    const metaPath = pathManager.getMetaFilePath(`${resource}.json`);
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);

    // Cache in both Redis and memory
    metaCache.set(resource, meta);
    await cacheService.cacheMetadata(resource, meta);

    logger.debug({ resource }, 'Metadata loaded and cached');
    return meta;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn({ resource, error: errMsg }, 'Failed to load metadata');
    return null;
  }
}

/**
 * Clears the metadata cache from both Redis and memory.
 * @param resource Optional: If provided, only clears the cache for that specific resource. Otherwise, clears all cached metadata.
 */
export async function clearMetaCache(resource?: string) {
  if (resource) {
    metaCache.delete(resource);
    await cacheService.invalidateTableCache(resource);
  } else {
    metaCache.clear();
    await cacheService.invalidateMetadataCache();
  }
  logger.info('Metadata cache cleared', { resource: resource || 'all' });
}

/**
 * Retrieves a list of all available resource names by reading the meta directory.
 * @returns A Promise that resolves to an array of resource names (strings).
 * @throws {Error} If there is an error reading the meta directory.
 */
export async function getAllResourceNames(): Promise<string[]> {
  try {
    const metaDir = pathManager.getMetaDirectory();
    const files = await fs.readdir(metaDir);

    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to get resource names');
    return [];
  }
}

/**
 * Saves resource metadata to a JSON file on disk and updates both Redis and in-memory cache.
 * @param resource The name of the resource.
 * @param meta The metadata object to save.
 * @returns A Promise that resolves when the metadata has been successfully saved.
 * @throws {Error} If saving the metadata fails.
 */
export async function saveResourceMeta(resource: string, meta: any): Promise<void> {
  try {
    const metaDir = pathManager.getMetaDirectory();
    await fs.mkdir(metaDir, { recursive: true });
    const metaPath = pathManager.getMetaFilePath(`${resource}.json`);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    // Update both caches
    metaCache.set(resource, meta);
    await cacheService.cacheMetadata(resource, meta);

    logger.info({ resource }, 'Metadata saved and cached');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ resource, error: errMsg }, 'Failed to save metadata');
    throw new Error(`Failed to save metadata for ${resource}`);
  }
}