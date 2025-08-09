import Database from 'better-sqlite3';
import { logger } from '../../logger';
import { DatabaseAdapter } from './base';

/**
 * SQLite database adapter implementation
 * Wraps better-sqlite3 with the common DatabaseAdapter interface
 */
export class SqliteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    if (this.db) return;

    this.db = new Database(this.dbPath);
    await this.enableForeignKeys();
    logger.info(`SQLite database connected: ${this.dbPath}`);
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('SQLite database disconnected');
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not connected');
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      logger.error('SQLite query error:', { sql, params, error });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: any }> {
    if (!this.db) throw new Error('Database not connected');
    
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      logger.error('SQLite execute error:', { sql, params, error });
      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('BEGIN TRANSACTION');
  }

  async commit(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('COMMIT');
  }

  async rollback(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('ROLLBACK');
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return result.length > 0;
  }

  async getTableColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    const result = await this.query(`PRAGMA table_info(${tableName})`);
    return result.map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0
    }));
  }

  async createTable(tableName: string, columns: Record<string, string>, foreignKeys: string[] = []): Promise<void> {
    const columnDefs = Object.entries(columns).map(([name, type]) => `${name} ${type}`);
    const allDefs = [...columnDefs, ...foreignKeys];
    const sql = `CREATE TABLE ${tableName} (${allDefs.join(', ')})`;
    
    await this.execute(sql);
    logger.info(`SQLite table created: ${tableName}`);
  }

  async addColumn(tableName: string, columnName: string, columnType: string): Promise<void> {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
    await this.execute(sql);
    logger.info(`SQLite column added: ${tableName}.${columnName}`);
  }

  getType(): 'sqlite' | 'postgresql' {
    return 'sqlite';
  }

  mapColumnType(type: string): string {
    // SQLite type mapping (already compatible)
    switch (type) {
      case 'string':
      case 'text':
      case 'email':
      case 'date':
      case 'datetime':
      case 'json':
        return 'TEXT';
      case 'number':
      case 'decimal':
        return 'REAL';
      case 'integer':
        return 'INTEGER';
      case 'boolean':
        return 'INTEGER';
      default:
        return 'TEXT';
    }
  }

  async enableForeignKeys(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  async getAllTables(): Promise<string[]> {
    const result = await this.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    return result.map((row: any) => row.name);
  }

  /**
   * Get the raw SQLite database instance for backward compatibility
   */
  getRawDb(): Database.Database {
    if (!this.db) throw new Error('Database not connected');
    return this.db;
  }
}