/**
 * Database adapter interface for abstracting database operations
 * Enables switching between SQLite and PostgreSQL seamlessly
 */

export interface DatabaseAdapter {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Execute a raw SQL query with parameters
   */
  query(sql: string, params?: any[]): Promise<any[]>;

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE, DDL)
   */
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: any }>;

  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit a transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback a transaction
   */
  rollback(): Promise<void>;

  /**
   * Check if a table exists
   */
  tableExists(tableName: string): Promise<boolean>;

  /**
   * Get table column information
   */
  getTableColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>>;

  /**
   * Create a table with the given schema
   */
  createTable(tableName: string, columns: Record<string, string>, foreignKeys?: string[]): Promise<void>;

  /**
   * Add a column to an existing table
   */
  addColumn(tableName: string, columnName: string, columnType: string): Promise<void>;

  /**
   * Get the database type identifier
   */
  getType(): 'sqlite' | 'postgresql';

  /**
   * Get SQL syntax for column type mapping
   */
  mapColumnType(type: string): string;

  /**
   * Enable foreign key constraints (if applicable)
   */
  enableForeignKeys(): Promise<void>;

  /**
   * Get all table names in the database
   */
  getAllTables(): Promise<string[]>;
}

export type DatabaseConfig = {
  type: 'sqlite' | 'postgresql';
  sqlite?: {
    path: string;
  };
  postgresql?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
  };
};