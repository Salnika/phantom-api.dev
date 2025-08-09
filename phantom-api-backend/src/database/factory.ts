import { mkdirSync } from 'fs';
import path from 'path';
import { logger } from '../logger';
import { pathManager } from '../storage/path-manager';
import { DatabaseAdapter, DatabaseConfig } from './adapters/base';
import { SqliteAdapter } from './adapters/sqlite';
import { PostgresqlAdapter } from './adapters/postgresql';

/**
 * Database factory for creating appropriate database adapters
 * Supports both SQLite and PostgreSQL based on configuration
 */
export class DatabaseFactory {
  private static instance: DatabaseFactory | null = null;
  private currentAdapter: DatabaseAdapter | null = null;

  private constructor() {}

  static getInstance(): DatabaseFactory {
    if (!DatabaseFactory.instance) {
      DatabaseFactory.instance = new DatabaseFactory();
    }
    return DatabaseFactory.instance;
  }

  /**
   * Create a database adapter based on environment configuration
   */
  async createAdapter(): Promise<DatabaseAdapter> {
    if (this.currentAdapter) {
      return this.currentAdapter;
    }

    const config = this.parseConfig();
    
    if (config.type === 'postgresql') {
      logger.info('Creating PostgreSQL database adapter');
      this.currentAdapter = new PostgresqlAdapter(config.postgresql!);
    } else {
      logger.info('Creating SQLite database adapter');
      // Ensure database directory exists for SQLite
      const dbPath = config.sqlite!.path;
      const dbDir = path.dirname(dbPath);
      try {
        mkdirSync(dbDir, { recursive: true });
      } catch (error) {
        logger.warn(`Failed to create directory for database at ${dbDir}`, { error });
      }
      this.currentAdapter = new SqliteAdapter(dbPath);
    }

    await this.currentAdapter.connect();
    return this.currentAdapter;
  }

  /**
   * Get the current adapter (must be created first)
   */
  getCurrentAdapter(): DatabaseAdapter {
    if (!this.currentAdapter) {
      throw new Error('Database adapter not initialized. Call createAdapter() first.');
    }
    return this.currentAdapter;
  }

  /**
   * Reset the adapter (useful for testing)
   */
  async resetAdapter(): Promise<void> {
    if (this.currentAdapter) {
      await this.currentAdapter.disconnect();
      this.currentAdapter = null;
    }
  }

  /**
   * Parse database configuration from environment variables
   */
  private parseConfig(): DatabaseConfig {
    const databaseType = (process.env.DATABASE_TYPE || 'sqlite') as 'sqlite' | 'postgresql';
    
    if (databaseType === 'postgresql') {
      return {
        type: 'postgresql',
        postgresql: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
          database: process.env.POSTGRES_DB || 'phantom_api',
          user: process.env.POSTGRES_USER || 'phantom_user',
          password: process.env.POSTGRES_PASSWORD || 'phantom_password',
          ssl: process.env.POSTGRES_SSL === 'true',
          poolSize: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10)
        }
      };
    }

    return {
      type: 'sqlite',
      sqlite: {
        path: process.env.DB_PATH || pathManager.getDatabasePath()
      }
    };
  }

  /**
   * Check if PostgreSQL is configured and available
   */
  isPostgreSQLConfigured(): boolean {
    return process.env.DATABASE_TYPE === 'postgresql';
  }

  /**
   * Get database type from environment
   */
  getDatabaseType(): 'sqlite' | 'postgresql' {
    return (process.env.DATABASE_TYPE || 'sqlite') as 'sqlite' | 'postgresql';
  }
}

// Export singleton instance
export const databaseFactory = DatabaseFactory.getInstance();