import { statSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { pathManager } from './path-manager';
import { logger } from '../logger';

interface StorageStats {
  totalSize: number;
  files: Array<{
    path: string;
    size: number;
    type: 'database' | 'schema' | 'log' | 'other';
  }>;
}

interface VolumeInfo {
  isUsingVolume: boolean;
  volumeName?: string;
  dataDirectory: string;
  totalSizeBytes: number;
  totalSizeMB: number;
  maxSizeGB: number;
  usagePercentage: number;
  breakdown: {
    database: { size: number; files: number };
    schemas: { size: number; files: number };
    logs: { size: number; files: number };
    other: { size: number; files: number };
  };
  files: Array<{
    path: string;
    size: number;
    sizeMB: number;
    type: string;
  }>;
}

/**
 * Monitors volume usage and provides storage statistics
 */
export class VolumeMonitor {
  private readonly maxSizeBytes = 3 * 1024 * 1024 * 1024; // 3GB in bytes

  /**
   * Calculates the size of a file or directory recursively
   */
  private calculateSize(filePath: string): number {
    try {
      const stats = statSync(filePath);
      
      if (stats.isFile()) {
        return stats.size;
      } else if (stats.isDirectory()) {
        let totalSize = 0;
        const files = readdirSync(filePath);
        
        for (const file of files) {
          const fullPath = path.join(filePath, file);
          totalSize += this.calculateSize(fullPath);
        }
        
        return totalSize;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`Failed to calculate size for ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Gets detailed storage statistics for all files in the data directory
   */
  private getStorageStats(): StorageStats {
    const dataDir = pathManager.getDataDirectory();
    const files: StorageStats['files'] = [];
    let totalSize = 0;

    if (!existsSync(dataDir)) {
      return { totalSize: 0, files: [] };
    }

    // Database file
    const dbPath = pathManager.getDatabasePath();
    if (existsSync(dbPath)) {
      const size = this.calculateSize(dbPath);
      files.push({ path: dbPath, size, type: 'database' });
      totalSize += size;
    }

    // Schema files
    const metaDir = pathManager.getMetaDirectory();
    if (existsSync(metaDir)) {
      const schemaFiles = readdirSync(metaDir);
      for (const file of schemaFiles) {
        const filePath = path.join(metaDir, file);
        const size = this.calculateSize(filePath);
        files.push({ path: filePath, size, type: 'schema' });
        totalSize += size;
      }
    }

    // Log files
    const logsDir = pathManager.getLogsDirectory();
    if (existsSync(logsDir)) {
      const logFiles = readdirSync(logsDir);
      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        const size = this.calculateSize(filePath);
        files.push({ path: filePath, size, type: 'log' });
        totalSize += size;
      }
    }

    // Other files in data directory
    try {
      const allFiles = readdirSync(dataDir);
      for (const file of allFiles) {
        const filePath = path.join(dataDir, file);
        const relativePath = path.relative(dataDir, filePath);
        
        // Skip if it's one of the directories we already processed
        if (relativePath === 'meta' || relativePath === 'logs' || relativePath === 'phantom.db') {
          continue;
        }
        
        const size = this.calculateSize(filePath);
        files.push({ path: filePath, size, type: 'other' });
        totalSize += size;
      }
    } catch (error) {
      logger.warn('Failed to list files in data directory:', error);
    }

    return { totalSize, files };
  }

  /**
   * Gets comprehensive volume information
   */
  getVolumeInfo(): VolumeInfo {
    const pathInfo = pathManager.getStorageInfo();
    const stats = this.getStorageStats();

    // Calculate breakdown by type
    const breakdown = {
      database: { size: 0, files: 0 },
      schemas: { size: 0, files: 0 },
      logs: { size: 0, files: 0 },
      other: { size: 0, files: 0 }
    };

    for (const file of stats.files) {
      switch (file.type) {
        case 'database':
          breakdown.database.size += file.size;
          breakdown.database.files++;
          break;
        case 'schema':
          breakdown.schemas.size += file.size;
          breakdown.schemas.files++;
          break;
        case 'log':
          breakdown.logs.size += file.size;
          breakdown.logs.files++;
          break;
        default:
          breakdown.other.size += file.size;
          breakdown.other.files++;
          break;
      }
    }

    const totalSizeMB = stats.totalSize / (1024 * 1024);
    const usagePercentage = (stats.totalSize / this.maxSizeBytes) * 100;

    return {
      isUsingVolume: pathInfo.isUsingVolume,
      volumeName: pathInfo.volumeName,
      dataDirectory: pathInfo.dataDirectory,
      totalSizeBytes: stats.totalSize,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      maxSizeGB: 3,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      breakdown,
      files: stats.files.map(file => ({
        path: file.path,
        size: file.size,
        sizeMB: Math.round((file.size / (1024 * 1024)) * 100) / 100,
        type: file.type
      }))
    };
  }

  /**
   * Checks if the volume is approaching capacity
   */
  isApproachingCapacity(threshold = 80): boolean {
    const info = this.getVolumeInfo();
    return info.usagePercentage >= threshold;
  }

  /**
   * Gets a summary of volume usage
   */
  getUsageSummary(): string {
    const info = this.getVolumeInfo();
    
    let summary = `Storage: ${info.totalSizeMB}MB / ${info.maxSizeGB}GB (${info.usagePercentage}%)`;
    
    if (info.isUsingVolume) {
      summary += ` on Fly.io volume: ${info.volumeName}`;
    } else {
      summary += ' on local filesystem';
    }

    return summary;
  }
}

/**
 * Singleton instance of VolumeMonitor
 */
export const volumeMonitor = new VolumeMonitor();