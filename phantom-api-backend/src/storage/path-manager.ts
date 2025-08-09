import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Manages file paths for persistent storage, supporting both local and Fly.io volume storage
 */
export class PathManager {
  private readonly volumeName: string | undefined;
  private readonly volumePath: string;
  private readonly localDataPath: string;

  constructor() {
    this.volumeName = process.env.VOLUME_NAME;
    this.volumePath = '/data';
    this.localDataPath = path.join(__dirname, '../../data');
    
    this.ensureDirectoriesExist();
  }

  /**
   * Gets the base directory for persistent storage
   */
  getDataDirectory(): string {
    return this.volumeName ? this.volumePath : this.localDataPath;
  }

  /**
   * Gets the full path for the database file
   */
  getDatabasePath(): string {
    return path.join(this.getDataDirectory(), 'phantom.db');
  }

  /**
   * Gets the directory for storing metadata schemas
   */
  getMetaDirectory(): string {
    return path.join(this.getDataDirectory(), 'meta');
  }

  /**
   * Gets the directory for storing logs
   */
  getLogsDirectory(): string {
    return path.join(this.getDataDirectory(), 'logs');
  }

  /**
   * Gets a specific meta file path
   */
  getMetaFilePath(fileName: string): string {
    return path.join(this.getMetaDirectory(), fileName);
  }

  /**
   * Checks if we're using Fly.io volume storage
   */
  isUsingVolume(): boolean {
    return !!this.volumeName;
  }

  /**
   * Ensures all required directories exist
   */
  private ensureDirectoriesExist(): void {
    const directories = [
      this.getDataDirectory(),
      this.getMetaDirectory(),
      this.getLogsDirectory()
    ];

    for (const dir of directories) {
      try {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
          logger.info(`Created directory: ${dir}`);
        }
      } catch (error) {
        logger.error(`Failed to create directory ${dir}:`, error);
        throw new Error(`Failed to create required directory: ${dir}`);
      }
    }

    if (this.volumeName) {
      logger.info(`Using Fly.io volume: ${this.volumeName} at ${this.volumePath}`);
    } else {
      logger.info(`Using local storage at ${this.localDataPath}`);
    }
  }

  /**
   * Gets storage information for monitoring
   */
  getStorageInfo(): {
    isUsingVolume: boolean;
    volumeName?: string;
    dataDirectory: string;
    databasePath: string;
    metaDirectory: string;
    logsDirectory: string;
  } {
    return {
      isUsingVolume: this.isUsingVolume(),
      volumeName: this.volumeName,
      dataDirectory: this.getDataDirectory(),
      databasePath: this.getDatabasePath(),
      metaDirectory: this.getMetaDirectory(),
      logsDirectory: this.getLogsDirectory()
    };
  }
}

/**
 * Singleton instance of PathManager
 */
export const pathManager = new PathManager();