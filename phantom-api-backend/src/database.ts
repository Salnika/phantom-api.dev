import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger';
import { pathManager } from './storage/path-manager';
import { metaManager } from './storage/meta-manager';
import { databaseFactory } from './database/factory';
import { DatabaseAdapter } from './database/adapters/base';
import { SqliteAdapter } from './database/adapters/sqlite';
import { cacheService } from './cache/cache-service';

// Lazy database initialization to support test environment variables and multi-database support
let sqlite: Database.Database | null = null;
let currentAdapter: DatabaseAdapter | null = null;

// Get current database adapter (SQLite or PostgreSQL)
async function getDatabaseAdapter(): Promise<DatabaseAdapter> {
  if (!currentAdapter) {
    currentAdapter = await databaseFactory.createAdapter();
  }
  return currentAdapter;
}

// Legacy SQLite getter for backward compatibility
function getSqlite(): Database.Database {
  if (!sqlite) {
    // Initialize SQLite database - use DB_PATH env var if set for tests, otherwise use path manager
    const dbPath = process.env.DB_PATH || pathManager.getDatabasePath();

    // Ensure directory exists for the db path
    const dbDir = path.dirname(dbPath);
    try {
      mkdirSync(dbDir, { recursive: true });
    } catch (_error) {
      logger.warn(`Failed to create directory for database at ${dbDir}. It might already exist.`, { error: _error });
      // Directory might already exist
    }

    sqlite = new Database(dbPath);
    // Enable foreign key support
    sqlite.exec('PRAGMA foreign_keys = ON;');
    
    logger.info(`Database initialized at: ${dbPath}`);
  }
  return sqlite;
}

// Function to reset the database connection (useful for tests)
export async function resetDatabaseConnection() {
  if (sqlite) {
    try {
      // Wait for any pending operations to finish
      sqlite.exec('PRAGMA busy_timeout = 1000');
      sqlite.close();
    } catch (_error) {
      logger.warn(`Error reseting Database Connection`, { error: _error });
      // Ignore errors when closing
    }
  }
  sqlite = null;
  
  // Reset the database factory adapter
  if (currentAdapter) {
    try {
      await currentAdapter.disconnect();
    } catch (_error) {
      logger.warn(`Error disconnecting database adapter`, { error: _error });
    }
    currentAdapter = null;
  }
  
  await databaseFactory.resetAdapter();
  // Also reset the table manager
  tableManager.reset();
}

/**
 * Raw database instance proxy. Automatically routes to appropriate adapter.
 * For SQLite: returns better-sqlite3 instance
 * For PostgreSQL: returns adapter with SQLite-like interface
 */
export const sqliteRaw: any = new Proxy({}, {
  get(target, prop) {
    // For backward compatibility, check if we're using SQLite
    if (databaseFactory.getDatabaseType() === 'sqlite') {
      const db = getSqlite();
      const value = db[prop as keyof Database.Database];
      if (typeof value === 'function') {
        return value.bind(db);
      }
      return value;
    } else {
      // For PostgreSQL, provide SQLite-compatible interface
      return createSQLiteCompatibleProxy(prop);
    }
  }
});

// Create SQLite-compatible methods for PostgreSQL adapter
function createSQLiteCompatibleProxy(prop: string | symbol) {
  return async function(...args: any[]) {
    const adapter = await getDatabaseAdapter();
    
    switch (prop) {
      case 'prepare':
        return createPreparedStatementProxy(args[0], adapter);
      case 'exec':
        return adapter.execute(args[0], args.slice(1));
      default:
        throw new Error(`Method ${String(prop)} not implemented for PostgreSQL adapter`);
    }
  };
}

// Create prepared statement proxy for PostgreSQL
function createPreparedStatementProxy(sql: string, adapter: DatabaseAdapter) {
  return {
    get: async (...params: any[]) => {
      const result = await adapter.query(sql, params);
      return result[0] || null;
    },
    all: async (...params: any[]) => {
      return adapter.query(sql, params);
    },
    run: async (...params: any[]) => {
      const result = await adapter.execute(sql, params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    }
  };
}

// Dynamic table creation and management
/**
 * Type definition for a hook executed before a create operation.
 * @param data The data payload for the create operation.
 */
export type BeforeCreateHook = (data: Record<string, any>) => Promise<void>;
/**
 * Type definition for a hook executed after a delete operation.
 * @param id The ID of the deleted record.
 */
export type AfterDeleteHook = (id: string) => Promise<void>;

/**
 * Manages dynamic creation, schema inference, and CRUD operations for SQLite tables.
 */
export class DynamicTableManager {
  private tableSchemas = new Map<string, any>();
  private hooks = new Map<string, { beforeCreate: BeforeCreateHook[]; afterDelete: AfterDeleteHook[]; }>();
  private initialized = false;

  /**
   * Initializes the table manager by loading existing schemas from persistent storage
   * and recreating all tables in the database
   */
  private async ensureInitialized() {
    if (!this.initialized) {
      // Get database adapter
      const adapter = await getDatabaseAdapter();
      
      // Load all existing schemas from persistent storage
      const existingSchemas = metaManager.loadAllSchemas();
      
      // Recreate all tables from persisted schemas
      for (const [tableName, schema] of existingSchemas) {
        this.tableSchemas.set(tableName, schema);
        
        // Recreate the table if it doesn't exist in database
        try {
          await this.recreateTableFromSchema(tableName, schema, adapter);
        } catch (error) {
          logger.warn(`Failed to recreate table ${tableName} from persisted schema`, { error });
        }
      }
      
      this.initialized = true;
      logger.info(`DynamicTableManager initialized with ${existingSchemas.size} existing schemas and recreated tables`);
    }
  }

  /**
   * Recreates a table from a persisted schema (used during initialization)
   * @param tableName The name of the table to recreate.
   * @param schema The schema definition for the table.
   * @param adapter The database adapter to use.
   */
  private async recreateTableFromSchema(tableName: string, schema: Record<string, any>, adapter: DatabaseAdapter) {
    const tableExists = await adapter.tableExists(tableName);

    if (!tableExists) {
      const columnDefs = this.inferColumnTypesFromSchema(schema, adapter);
      const foreignKeys = this.generateForeignKeys(schema);
      await adapter.createTable(tableName, columnDefs, foreignKeys);
      logger.info(`Recreated table: ${tableName} from persisted schema`);
    }
  }

  /**
   * Creates a new table or adds missing columns to an existing table based on a provided schema.
   * @param tableName The name of the table to create or update.
   * @param schema The schema definition for the table, including field types.
   */
  async createTableFromSchema(tableName: string, schema: Record<string, any>) {
    await this.ensureInitialized();
    const adapter = await getDatabaseAdapter();
    
    const columnDefs = this.inferColumnTypesFromSchema(schema, adapter);

    const tableExists = await adapter.tableExists(tableName);

    if (!tableExists) {
      const foreignKeys = this.generateForeignKeys(schema);
      await adapter.createTable(tableName, columnDefs, foreignKeys);
      logger.info(`Created table: ${tableName}`);
    } else {
      await this.addMissingColumnsFromSchema(tableName, schema, adapter);
    }

    // Store schema both in memory and persistent storage
    this.tableSchemas.set(tableName, schema);
    metaManager.saveSchema(tableName, schema);
    
    // Cache the schema for faster access
    await cacheService.cacheTableSchema(tableName, schema);
  }

  /**
   * Infers database column types from a given schema definition using the appropriate adapter.
   * @param schema The schema definition.
   * @param adapter The database adapter to use for type mapping.
   * @returns An object mapping column names to their database-specific types.
   */
  private inferColumnTypesFromSchema(schema: Record<string, any>, adapter: DatabaseAdapter): Record<string, string> {
    const columns: Record<string, string> = { 
      id: adapter.getType() === 'postgresql' ? 'VARCHAR(255) PRIMARY KEY' : 'TEXT PRIMARY KEY' 
    };
    
    for (const [key, field] of Object.entries(schema.fields)) {
      if (key === 'id') continue;
      const typedField = field as { type: string; target?: string; onDelete?: string };
      
      if (typedField.type === 'relation') {
        columns[`${key}Id`] = adapter.mapColumnType('string');
      } else {
        columns[key] = adapter.mapColumnType(typedField.type);
      }
    }
    
    // Add timestamps with database-appropriate defaults
    if (adapter.getType() === 'postgresql') {
      columns.created_at = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
      columns.updated_at = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    } else {
      columns.created_at = 'TEXT DEFAULT CURRENT_TIMESTAMP';
      columns.updated_at = 'TEXT DEFAULT CURRENT_TIMESTAMP';
    }
    
    return columns;
  }

  /**
   * Generates foreign key constraints for a schema.
   * @param schema The schema definition for the table.
   * @returns An array of foreign key constraint strings.
   */
  private generateForeignKeys(schema: Record<string, any>): string[] {
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
   * Adds any missing columns to an existing table based on the provided schema.
   * @param tableName The name of the table to update.
   * @param schema The schema definition to compare against.
   * @param adapter The database adapter to use.
   */
  private async addMissingColumnsFromSchema(tableName: string, schema: Record<string, any>, adapter: DatabaseAdapter) {
    const existingColumns = await adapter.getTableColumns(tableName);
    const existingColumnNames = new Set(existingColumns.map((col) => col.name));
    const newColumns = this.inferColumnTypesFromSchema(schema, adapter);

    for (const [columnName, columnType] of Object.entries(newColumns)) {
      if (!existingColumnNames.has(columnName)) {
        await adapter.addColumn(tableName, columnName, columnType);
        logger.info(`Added column ${columnName} to ${tableName}`);
      }
    }

    // Note: Adding foreign key constraints to existing tables is complex.
    // For simplicity, we'll assume they are defined on table creation.
  }

  /**
   * Registers a hook to be executed before a create operation on a specific table.
   * @param tableName The name of the table.
   * @param hook The asynchronous function to execute before creation.
   */
  onBeforeCreate(tableName: string, hook: BeforeCreateHook) {
    if (!this.hooks.has(tableName)) {
      this.hooks.set(tableName, { beforeCreate: [], afterDelete: [] });
    }
    this.hooks.get(tableName)?.beforeCreate.push(hook);
  }

  /**
   * Registers a hook to be executed after a delete operation on a specific table.
   * @param tableName The name of the table.
   * @param hook The asynchronous function to execute after deletion.
   */
  onAfterDelete(tableName: string, hook: AfterDeleteHook) {
    if (!this.hooks.has(tableName)) {
      this.hooks.set(tableName, { beforeCreate: [], afterDelete: [] });
    }
    this.hooks.get(tableName)?.afterDelete.push(hook);
  }

  /**
   * Creates a new record in the specified table.
   * @param tableName The name of the table.
   * @param data The data for the new record.
   * @returns A Promise that resolves to the created record.
   * @throws An error if the record creation fails.
   */
  async create(tableName: string, data: Record<string, any>): Promise<any> {
    await this.ensureInitialized();
    const adapter = await getDatabaseAdapter();
    
    // Execute beforeCreate hooks
    const beforeCreateHooks = this.hooks.get(tableName)?.beforeCreate || [];
    for (const hook of beforeCreateHooks) {
      await hook(data);
    }

    if (!data.id) {
      data.id = crypto.randomUUID();
    }
    const schema = this.tableSchemas.get(tableName);
    if (!schema) throw new Error(`Schema not found for table: ${tableName}`);
    const insertData = { ...data };
    for (const [key, field] of Object.entries(schema.fields)) {
      const typedField = field as { type: string; target?: string };
      if (typedField.type === 'relation' && data[key]) {
        insertData[`${key}Id`] = data[key];
        delete insertData[key];
      }
    }
    const preparedData = this.prepareDataForInsert(insertData);
    const columns = Object.keys(preparedData).join(', ');
    const placeholders = Object.keys(preparedData).map(() => '?').join(', ');
    const values = Object.values(preparedData);
    const insertSQL = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    
    try {
      await adapter.execute(insertSQL, values);
      
      // Invalidate cache after successful insert
      await cacheService.invalidateTableCache(tableName);
      
      return this.findById(tableName, data.id);
    } catch (error: any) {
      logger.error('Insert error:', error);
      throw new Error(`Failed to create record in ${tableName}: ${error.message}`);
    }
  }

  /**
   * Finds a record by its ID in the specified table.
   * @param tableName The name of the table.
   * @param id The ID of the record to find.
   * @param populate An array of relation fields to populate.
   * @returns A Promise that resolves to the found record, or null if not found.
   */
  async findById(tableName: string, id: string, populate: string[] = []): Promise<any> {
    const adapter = await getDatabaseAdapter();
    const results = await adapter.query(`SELECT * FROM ${tableName} WHERE id = ?`, [this.sanitizeParam(id)]);
    
    if (results.length === 0) return null;

    const parsedResult = this.parseRowData(results[0], tableName);
    return this.populateFields(tableName, [parsedResult], populate).then(r => r[0]);
  }

  /**
   * Finds all records in the specified table based on provided criteria.
   * @param tableName The name of the table.
   * @param limit The maximum number of records to return (default: 100).
   * @param offset The number of records to skip (default: 0).
   * @param populate An array of relation fields to populate.
   * @param sort A string or array of strings for sorting (e.g., 'name:asc', '-createdAt').
   * @param select A string or array of strings for selecting specific columns.
   * @param where An object for filtering records (WHERE clause).
   * @returns A Promise that resolves to an array of records.
   * @throws An error if fetching records fails.
   */
  async findAll(tableName: string, limit = 100, offset = 0, populate: string[] = [], sort?: string | string[], select?: string | string[], where?: Record<string, any>): Promise<any[]> {
    try {
      const adapter = await getDatabaseAdapter();
      let query = `SELECT ${select ? (Array.isArray(select) ? select.join(', ') : select) : '*'} FROM ${tableName}`;
      const params: any[] = [];

      if (where) {
        const whereClauses: string[] = [];
        for (const key in where) {
          if (where.hasOwnProperty(key)) {
            const value = where[key];
            if (typeof value === 'object' && value !== null) {
              if (value.eq !== undefined) {
                whereClauses.push(`${key} = ?`);
                params.push(this.sanitizeParam(value.eq));
              } else if (value.gt !== undefined) {
                whereClauses.push(`${key} > ?`);
                params.push(this.sanitizeParam(value.gt));
              } else if (value.lt !== undefined) {
                whereClauses.push(`${key} < ?`);
                params.push(this.sanitizeParam(value.lt));
              } else if (value.in !== undefined && Array.isArray(value.in)) {
                const placeholders = value.in.map(() => '?').join(',');
                whereClauses.push(`${key} IN (${placeholders})`);
                params.push(...value.in.map((v: any) => this.sanitizeParam(v)));
              }
            } else {
              whereClauses.push(`${key} = ?`);
              params.push(this.sanitizeParam(value));
            }
          }
        }
        if (whereClauses.length > 0) {
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
      }

      if (sort) {
        const sortClauses = Array.isArray(sort) ? sort.join(', ') : sort;
        query += ` ORDER BY ${sortClauses}`;
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const results = await adapter.query(query, params);
      const parsedResults = results.map((row: any) => this.parseRowData(row, tableName));
      return this.populateFields(tableName, parsedResults, populate);
    } catch (error: any) {
      logger.error('Find all error:', error);
      // If table doesn't exist, return empty array instead of throwing error
      if (error.message.includes('no such table') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Failed to fetch records from ${tableName}: ${error.message}`);
    }
  }

  /**
   * Populates relation fields within records.
   * @param tableName The name of the table.
   * @param records The records to populate.
   * @param populate An array of relation fields to populate.
   * @returns A Promise that resolves to the records with populated fields.
   */
  private async populateFields(tableName: string, records: any[], populate: string[]): Promise<any[]> {
    if (populate.length === 0) return records;

    const adapter = await getDatabaseAdapter();
    const schema = this.tableSchemas.get(tableName);
    if (!schema) return records;

    for (const fieldName of populate) {
      const fieldSchema = schema.fields[fieldName] as { type?: string; target?: string };
      if (fieldSchema?.type !== 'relation') continue;

      const targetTable = fieldSchema.target;
      const foreignKey = `${fieldName}Id`;

      const idsToFetch = records.map(r => r[foreignKey]).filter(id => id);
      if (idsToFetch.length === 0) continue;

      const placeholders = idsToFetch.map(() => '?').join(',');
      const relatedRecords = await adapter.query(
        `SELECT * FROM ${targetTable} WHERE id IN (${placeholders})`,
        idsToFetch
      );
      const parsedRelatedRecords = relatedRecords.map((r: any) => this.parseRowData(r, targetTable));

      const relatedMap = new Map(parsedRelatedRecords.map((r: { id: any; }) => [r.id, r]));

      for (const record of records) {
        if (record[foreignKey]) {
          record[fieldName] = relatedMap.get(record[foreignKey]) || null;
        }
      }
    }

    return records;
  }

  /**
   * Updates an existing record in the specified table.
   * @param tableName The name of the table.
   * @param id The ID of the record to update.
   * @param data The data to update the record with.
   * @returns A Promise that resolves to the updated record.
   * @throws An error if the record update fails or the record is not found.
   */
  async update(tableName: string, id: string, data: Record<string, any>): Promise<any> {
    const adapter = await getDatabaseAdapter();
    const schema = this.tableSchemas.get(tableName);
    if (!schema) throw new Error(`Schema not found for table: ${tableName}`);
    const updateData = { ...data };
    for (const [key, field] of Object.entries(schema.fields)) {
      const typedField = field as { type: string; target?: string };
      if (typedField.type === 'relation' && data[key]) {
        updateData[`${key}Id`] = data[key];
        delete updateData[key];
      }
    }
    const preparedData = this.prepareDataForInsert(updateData);
    preparedData.updated_at = new Date().toISOString();
    const setClause = Object.keys(preparedData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(preparedData), id];
    const updateSQL = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
    
    try {
      const result = await adapter.execute(updateSQL, values);
      if (result.changes === 0) throw new Error('Record not found');
      
      // Invalidate cache after successful update
      await cacheService.invalidateTableCache(tableName);
      
      return this.findById(tableName, id);
    } catch (error: any) {
      logger.error('Update error:', error);
      throw new Error(`Failed to update record in ${tableName}: ${error.message}`);
    }
  }

  /**
   * Deletes a record from the specified table by its ID.
   * @param tableName The name of the table.
   * @param id The ID of the record to delete.
   * @returns A Promise that resolves to true if the record was deleted, false otherwise.
   */
  async delete(tableName: string, id: string): Promise<boolean> {
    const adapter = await getDatabaseAdapter();
    const result = await adapter.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);

    // Execute afterDelete hooks and invalidate cache
    if (result.changes > 0) {
      const afterDeleteHooks = this.hooks.get(tableName)?.afterDelete || [];
      for (const hook of afterDeleteHooks) {
        await hook(id);
      }
      
      // Invalidate cache after successful delete
      await cacheService.invalidateTableCache(tableName);
    }
    return result.changes > 0;
  }

  /**
   * Sanitizes a parameter for use in SQLite queries.
   * @param value The value to sanitize.
   * @returns The sanitized value.
   */
  private sanitizeParam(value: any): string | number | bigint | Buffer | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return value;
    }
    if (Buffer.isBuffer(value)) {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Prepares data for insertion into the database, handling type conversions.
   * @param data The raw data object.
   * @returns The prepared data object.
   */
  private prepareDataForInsert(data: Record<string, any>): Record<string, any> {
    const prepared: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;

      if (value === null || value === undefined) {
        prepared[key] = null;
      } else if (typeof value === 'boolean') {
        prepared[key] = value ? 1 : 0; // Convert boolean to integer
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        prepared[key] = JSON.stringify(value);
      } else if (value instanceof Date) {
        prepared[key] = value.toISOString();
      } else {
        prepared[key] = value;
      }
    }

    if (data.id) prepared.id = data.id;
    if (data.created_at) prepared.created_at = data.created_at;

    return prepared;
  }

  /**
   * Parses row data retrieved from the database, handling type conversions.
   * @param row The raw row data from SQLite.
   * @param tableName Optional: The name of the table, used for schema-based parsing.
   * @returns The parsed row data.
   */
  private parseRowData(row: any, tableName?: string): any {
    const parsed: any = {};
    const schema = tableName ? this.tableSchemas.get(tableName) : null;

    for (const [key, value] of Object.entries(row)) {
      // Check if this field is a boolean in the schema
      const fieldSchema = schema?.fields?.[key];
      if (fieldSchema?.type === 'boolean' && (value === 0 || value === 1)) {
        parsed[key] = Boolean(value);
      } else if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          parsed[key] = JSON.parse(value);
        } catch {
          parsed[key] = value;
        }
      } else {
        parsed[key] = value;
      }
    }

    return parsed;
  }

  /**
   * Retrieves the schema for a specific table.
   * @param tableName The name of the table.
   * @returns The table schema, or undefined if not found.
   */
  async getTableSchema(tableName: string) {
    await this.ensureInitialized();
    return this.tableSchemas.get(tableName);
  }

  /**
   * Public method to force initialization of the table manager
   * This should be called at application startup
   */
  async initialize() {
    await this.ensureInitialized();
  }

  /**
   * Reset the table manager (for testing purposes)
   */
  reset() {
    this.tableSchemas.clear();
    this.hooks.clear();
    this.initialized = false;
  }

  /**
   * Lists all non-internal tables in the database.
   * @returns An array of table names.
   */
  async getAllTables(): Promise<string[]> {
    const adapter = await getDatabaseAdapter();
    return adapter.getAllTables();
  }
}

/**
 * Singleton instance of the DynamicTableManager.
 */
export const tableManager = new DynamicTableManager();
