import { logger } from '../logger';
import { databaseFactory } from './factory';
import { SqliteAdapter } from './adapters/sqlite';
import { PostgresqlAdapter } from './adapters/postgresql';
import { metaManager } from '../storage/meta-manager';
import { pathManager } from '../storage/path-manager';
import path from 'path';
import fs from 'fs/promises';

/**
 * Database migration utilities for migrating from SQLite to PostgreSQL
 */
export class DatabaseMigration {
  private sourceAdapter: SqliteAdapter | null = null;
  private targetAdapter: PostgresqlAdapter | null = null;

  /**
   * Migrate data from SQLite to PostgreSQL
   */
  async migrateSQLiteToPostgreSQL(sqliteDbPath: string): Promise<void> {
    logger.info('Starting SQLite to PostgreSQL migration');

    try {
      // Initialize source SQLite adapter
      this.sourceAdapter = new SqliteAdapter(sqliteDbPath);
      await this.sourceAdapter.connect();

      // Initialize target PostgreSQL adapter
      const pgConfig = this.getPostgreSQLConfig();
      this.targetAdapter = new PostgresqlAdapter(pgConfig);
      await this.targetAdapter.connect();

      // Get all tables from SQLite
      const tables = await this.sourceAdapter.getAllTables();
      logger.info(`Found ${tables.length} tables to migrate: ${tables.join(', ')}`);

      // Migrate each table
      for (const tableName of tables) {
        await this.migrateTable(tableName);
      }

      logger.info('SQLite to PostgreSQL migration completed successfully');

    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    } finally {
      if (this.sourceAdapter) {
        await this.sourceAdapter.disconnect();
      }
      if (this.targetAdapter) {
        await this.targetAdapter.disconnect();
      }
    }
  }

  /**
   * Migrate a single table from SQLite to PostgreSQL
   */
  private async migrateTable(tableName: string): Promise<void> {
    if (!this.sourceAdapter || !this.targetAdapter) {
      throw new Error('Database adapters not initialized');
    }

    logger.info(`Migrating table: ${tableName}`);

    try {
      // Load table schema from metadata if available
      const schema = metaManager.loadSchema(tableName);
      
      if (schema) {
        // Create table in PostgreSQL using schema
        const columns = this.convertSQLiteColumnsToPostgreSQL(schema);
        const foreignKeys = this.extractForeignKeys(schema);
        
        const tableExists = await this.targetAdapter.tableExists(tableName);
        if (!tableExists) {
          await this.targetAdapter.createTable(tableName, columns, foreignKeys);
          logger.info(`Created table structure: ${tableName}`);
        }
      } else {
        // Fallback: analyze SQLite table structure
        const sqliteColumns = await this.sourceAdapter.getTableColumns(tableName);
        const pgColumns = this.mapSQLiteColumnsToPG(sqliteColumns);
        
        const tableExists = await this.targetAdapter.tableExists(tableName);
        if (!tableExists) {
          await this.targetAdapter.createTable(tableName, pgColumns);
          logger.info(`Created table structure from SQLite analysis: ${tableName}`);
        }
      }

      // Migrate data
      await this.migrateTableData(tableName);

      logger.info(`Successfully migrated table: ${tableName}`);

    } catch (error) {
      logger.error(`Failed to migrate table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Migrate data from SQLite table to PostgreSQL
   */
  private async migrateTableData(tableName: string): Promise<void> {
    if (!this.sourceAdapter || !this.targetAdapter) {
      throw new Error('Database adapters not initialized');
    }

    const batchSize = 1000;
    let offset = 0;
    let totalRecords = 0;

    while (true) {
      // Fetch batch from SQLite
      const records = await this.sourceAdapter.query(
        `SELECT * FROM ${tableName} LIMIT ${batchSize} OFFSET ${offset}`
      );

      if (records.length === 0) break;

      // Insert batch into PostgreSQL
      for (const record of records) {
        const columns = Object.keys(record).join(', ');
        const placeholders = Object.keys(record).map(() => '?').join(', ');
        const values = Object.values(record);

        await this.targetAdapter.execute(
          `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
          values
        );
      }

      totalRecords += records.length;
      offset += batchSize;
      
      logger.info(`Migrated ${totalRecords} records for table ${tableName}`);
    }

    logger.info(`Completed data migration for ${tableName}: ${totalRecords} records`);
  }

  /**
   * Convert SQLite columns to PostgreSQL equivalents using schema
   */
  private convertSQLiteColumnsToPostgreSQL(schema: any): Record<string, string> {
    const pgAdapter = new PostgresqlAdapter({
      host: 'temp',
      port: 5432,
      database: 'temp',
      user: 'temp',
      password: 'temp'
    });

    const columns: Record<string, string> = { 
      id: 'VARCHAR(255) PRIMARY KEY'
    };

    for (const [key, field] of Object.entries(schema.fields)) {
      if (key === 'id') continue;
      const typedField = field as { type: string; target?: string; onDelete?: string };
      
      if (typedField.type === 'relation') {
        columns[`${key}Id`] = pgAdapter.mapColumnType('string');
      } else {
        columns[key] = pgAdapter.mapColumnType(typedField.type);
      }
    }

    columns.created_at = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    columns.updated_at = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';

    return columns;
  }

  /**
   * Extract foreign keys from schema
   */
  private extractForeignKeys(schema: any): string[] {
    const foreignKeys: string[] = [];
    
    for (const [key, field] of Object.entries(schema.fields)) {
      const typedField = field as { type: string; target?: string; onDelete?: string };
      if (typedField.type === 'relation') {
        const onDelete = typedField.onDelete?.toUpperCase() || 'SET NULL';
        foreignKeys.push(
          `FOREIGN KEY(${key}Id) REFERENCES ${typedField.target}(id) ON DELETE ${onDelete}`
        );
      }
    }

    return foreignKeys;
  }

  /**
   * Map SQLite column types to PostgreSQL (fallback method)
   */
  private mapSQLiteColumnsToPG(sqliteColumns: Array<{ name: string; type: string; nullable: boolean }>): Record<string, string> {
    const pgColumns: Record<string, string> = {};

    for (const col of sqliteColumns) {
      let pgType = 'TEXT';
      
      switch (col.type.toUpperCase()) {
        case 'TEXT':
          pgType = col.name === 'id' ? 'VARCHAR(255) PRIMARY KEY' : 'TEXT';
          break;
        case 'INTEGER':
          pgType = 'INTEGER';
          break;
        case 'REAL':
          pgType = 'DECIMAL';
          break;
        default:
          pgType = 'TEXT';
      }

      if (!col.nullable && col.name !== 'id') {
        pgType += ' NOT NULL';
      }

      pgColumns[col.name] = pgType;
    }

    return pgColumns;
  }

  /**
   * Get PostgreSQL configuration from environment
   */
  private getPostgreSQLConfig() {
    return {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'phantom_api',
      user: process.env.POSTGRES_USER || 'phantom_user',
      password: process.env.POSTGRES_PASSWORD || 'phantom_password',
      ssl: process.env.POSTGRES_SSL === 'true',
      poolSize: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10)
    };
  }

  /**
   * Create backup of SQLite database before migration
   */
  async createSQLiteBackup(sourcePath: string, backupPath?: string): Promise<string> {
    const backup = backupPath || `${sourcePath}.backup.${Date.now()}`;
    
    try {
      await fs.copyFile(sourcePath, backup);
      logger.info(`SQLite backup created: ${backup}`);
      return backup;
    } catch (error) {
      logger.error('Failed to create SQLite backup:', error);
      throw error;
    }
  }

  /**
   * Validate migration by comparing record counts
   */
  async validateMigration(sqliteDbPath: string): Promise<boolean> {
    try {
      const sqliteAdapter = new SqliteAdapter(sqliteDbPath);
      await sqliteAdapter.connect();

      const pgConfig = this.getPostgreSQLConfig();
      const pgAdapter = new PostgresqlAdapter(pgConfig);
      await pgAdapter.connect();

      const sqliteTables = await sqliteAdapter.getAllTables();
      const pgTables = await pgAdapter.getAllTables();

      let isValid = true;

      for (const table of sqliteTables) {
        if (!pgTables.includes(table)) {
          logger.error(`Table ${table} missing in PostgreSQL`);
          isValid = false;
          continue;
        }

        const sqliteCount = await sqliteAdapter.query(`SELECT COUNT(*) as count FROM ${table}`);
        const pgCount = await pgAdapter.query(`SELECT COUNT(*) as count FROM ${table}`);

        if (sqliteCount[0].count !== pgCount[0].count) {
          logger.error(`Record count mismatch for ${table}: SQLite=${sqliteCount[0].count}, PostgreSQL=${pgCount[0].count}`);
          isValid = false;
        }
      }

      await sqliteAdapter.disconnect();
      await pgAdapter.disconnect();

      if (isValid) {
        logger.info('Migration validation passed');
      } else {
        logger.error('Migration validation failed');
      }

      return isValid;
    } catch (error) {
      logger.error('Migration validation error:', error);
      return false;
    }
  }
}

// Export migration instance
export const databaseMigration = new DatabaseMigration();