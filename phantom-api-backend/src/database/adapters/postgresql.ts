import { Pool, PoolClient } from 'pg';
import { logger } from '../../logger';
import { DatabaseAdapter } from './base';

/**
 * PostgreSQL database adapter implementation
 * Uses connection pooling for production scalability
 */
export class PostgresqlAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
  };

  constructor(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
  }) {
    this.config = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.poolSize || 10,
    };
  }

  async connect(): Promise<void> {
    if (this.pool) return;

    this.pool = new Pool(this.config);
    
    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      await this.enableForeignKeys();
      logger.info(`PostgreSQL database connected: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      logger.error('PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL database disconnected');
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.pool) throw new Error('Database not connected');
    
    try {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.pool.query(pgSql, params);
      return result.rows;
    } catch (error) {
      logger.error('PostgreSQL query error:', { sql, params, error });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: any }> {
    if (!this.pool) throw new Error('Database not connected');
    
    try {
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.pool.query(pgSql, params);
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id || null
      };
    } catch (error) {
      logger.error('PostgreSQL execute error:', { sql, params, error });
      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');
    await this.pool.query('BEGIN');
  }

  async commit(): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');
    await this.pool.query('COMMIT');
  }

  async rollback(): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');
    await this.pool.query('ROLLBACK');
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    return result.length > 0;
  }

  async getTableColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    const result = await this.query(`
      SELECT column_name as name, data_type as type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    return result.map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.is_nullable === 'YES'
    }));
  }

  async createTable(tableName: string, columns: Record<string, string>, foreignKeys: string[] = []): Promise<void> {
    const columnDefs = Object.entries(columns).map(([name, type]) => `${name} ${type}`);
    const allDefs = [...columnDefs, ...foreignKeys];
    const sql = `CREATE TABLE ${tableName} (${allDefs.join(', ')})`;
    
    await this.execute(sql);
    logger.info(`PostgreSQL table created: ${tableName}`);
  }

  async addColumn(tableName: string, columnName: string, columnType: string): Promise<void> {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
    await this.execute(sql);
    logger.info(`PostgreSQL column added: ${tableName}.${columnName}`);
  }

  getType(): 'sqlite' | 'postgresql' {
    return 'postgresql';
  }

  mapColumnType(type: string): string {
    // PostgreSQL type mapping
    switch (type) {
      case 'string':
      case 'email':
        return 'VARCHAR(255)';
      case 'text':
      case 'json':
        return 'TEXT';
      case 'number':
      case 'decimal':
        return 'DECIMAL';
      case 'integer':
        return 'INTEGER';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMP';
      default:
        return 'VARCHAR(255)';
    }
  }

  async enableForeignKeys(): Promise<void> {
    // PostgreSQL has foreign keys enabled by default
    // This method exists for interface compatibility
  }

  async getAllTables(): Promise<string[]> {
    const result = await this.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    return result.map((row: any) => row.table_name);
  }

  /**
   * Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
   */
  private convertPlaceholders(sql: string): string {
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  }

  /**
   * Get the raw PostgreSQL pool for advanced operations
   */
  getRawPool(): Pool {
    if (!this.pool) throw new Error('Database not connected');
    return this.pool;
  }
}