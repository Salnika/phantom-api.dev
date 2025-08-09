import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { tableManager } from '../database';
import { generateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../logger';
import { pullMigrations, applyMigration } from '../migration';
import { generateSeedData } from '../seed';
import { loadResourceMeta } from '../services/metaService';
import { pathManager } from '../storage/path-manager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Controller for handling administrative tasks and data management.
 */
export class AdminController {
  /**
   * Retrieves a list of all available table names (resources) from the meta directory.
   * @returns A Promise that resolves to an array of table names.
   * @throws {AppError} If there is an error reading the meta directory.
   */
  async getTables() {
    try {
      const metaDir = pathManager.getMetaDirectory();
      let metaFiles: string[] = [];
      try {
        metaFiles = await fs.readdir(metaDir);
      } catch (err) {
        // Si le dossier n'existe pas, retourner une liste vide
        if ((err as any).code === 'ENOENT') {
          return [];
        }
        throw err;
      }
      const tables = metaFiles
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));

      return tables;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to get tables');
      throw new AppError('Failed to get tables', 500);
    }
  }

  /**
   * Retrieves data from a specified table with pagination and population options.
   * @param tableName The name of the table to retrieve data from.
   * @param page The page number for pagination (default: 1).
   * @param limit The maximum number of records per page (default: 10).
   * @param populate An array of relation fields to populate.
   * @returns A Promise that resolves to an object containing the data, pagination info, and success status.
   * @throws {AppError} If there is an error retrieving table data.
   */
  async getTableData(tableName: string, page: number = 1, limit: number = 10, populate: string[] = []) {
    try {
      const offset = (page - 1) * limit;
      const data = await tableManager.findAll(tableName, limit, offset, populate);
      const total = (await tableManager.findAll(tableName, 9999, 0)).length;

      return {
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tableName }, 'Failed to get table data');
      throw new AppError('Failed to get table data', 500);
    }
  }

  /**
   * Retrieves the schema (field definitions) for a specified table.
   * @param tableName The name of the table to retrieve the schema for.
   * @returns A Promise that resolves to an object containing the schema data and success status.
   * @throws {AppError} If the schema is not found or an error occurs.
   */
  async getTableSchema(tableName: string) {
    try {
      const meta = await loadResourceMeta(tableName);
      if (!meta) {
        throw new AppError('Schema not found', 404);
      }

      return {
        success: true,
        data: meta.fields
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tableName }, 'Failed to get table schema');
      throw new AppError('Failed to get table schema', 500);
    }
  }

  /**
   * Updates a record in the specified table.
   * @param tableName The name of the table where the record is located.
   * @param id The ID of the record to update.
   * @param data The data to update the record with.
   * @returns A Promise that resolves to an object containing the updated record and success status.
   * @throws {AppError} If the record update fails.
   */
  async updateRecord(tableName: string, id: string, data: any) {
    try {
      const result = await tableManager.update(tableName, id, data);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tableName, id }, 'Failed to update record');
      throw new AppError('Failed to update record', 500);
    }
  }

  /**
   * Deletes a record from the specified table by its ID.
   * @param tableName The name of the table from which to delete the record.
   * @param id The ID of the record to delete.
   * @returns A Promise that resolves to an object indicating success or failure of the deletion.
   * @throws {AppError} If the record deletion fails.
   */
  async deleteRecord(tableName: string, id: string) {
    try {
      const deleted = await tableManager.delete(tableName, id);
      return {
        success: deleted === true,
        data: deleted
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tableName, id }, 'Failed to delete record');
      throw new AppError('Failed to delete record', 500);
    }
  }

  /**
   * Retrieves log entries from the application or error log files.
   * @param type The type of log to retrieve ('app' or 'error', default: 'app').
   * @param lines The number of lines to retrieve from the end of the log file (default: 100).
   * @returns A Promise that resolves to an object containing the log data, total lines, and file info.
   * @throws {AppError} If there is an error reading the log files.
   */
  async getLogs(type: string = 'app', lines: number = 100) {
    try {
      const logFile = type === 'error' ? 'error.log' : 'app.log';
      const logPath = path.join(__dirname, '../../logs', logFile);

      try {
        const logContent = await fs.readFile(logPath, 'utf-8');
        const logLines = logContent.split('\n').filter(line => line.trim()).slice(-lines);

        const logs = logLines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { msg: line, time: new Date().toISOString() };
          }
        });

        return {
          success: true,
          data: {
            logs,
            total: logLines.length,
            file: logFile
          }
        };
      } catch {
        return {
          success: true,
          data: {
            logs: [],
            total: 0,
            file: logFile,
            message: 'Log file not found or empty'
          }
        };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Error reading logs');
      throw new AppError('Failed to read logs', 500);
    }
  }

  /**
   * Initiates the process of pulling new database migrations from the backend.
   * @returns A Promise that resolves to an object indicating success and any data from the migration pull.
   * @throws {AppError} If the migration pull fails.
   */
  async pullMigrations() {
    try {
      const migrations = await pullMigrations();
      return {
        success: true,
        message: 'Migrations pulled successfully',
        data: migrations
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to pull migrations');
      throw new AppError('Failed to pull migrations', 500);
    }
  }

  /**
   * Applies a specific database migration by its ID (filename).
   * @param migrationId The ID (filename) of the migration to apply.
   * @returns A Promise that resolves to an object indicating success of the migration application.
   * @throws {AppError} If the migration application fails.
   */
  async applyMigration(migrationId: string) {
    try {
      await applyMigration(migrationId);
      return {
        success: true,
        message: `Migration ${migrationId} applied successfully`
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, migrationId }, 'Failed to apply migration');
      throw new AppError('Failed to apply migration', 500);
    }
  }

  /**
   * Generates seed data for specified tables.
   * @param tables An array of table names for which to generate seed data.
   * @returns A Promise that resolves to an object indicating success and the generated seed data.
   * @throws {AppError} If seed data generation fails.
   */
  async generateSeeds(tables: string[]) {
    try {
      const results = [];
      for (const table of tables) {
        await generateSeedData();
        results.push({ table });
      }

      return {
        success: true,
        message: 'Seeds generated successfully',
        data: results
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tables }, 'Failed to generate seeds');
      throw new AppError('Failed to generate seeds', 500);
    }
  }

  /**
   * Generates an API token with specified roles, expiration, and resource access.
   * @param role The role to assign to the token (default: 'user').
   * @param expiresIn The expiration time for the token (e.g., '30d', default: '30d').
   * @param resourceAccess The level of resource access ('all' or 'specific', default: 'all').
   * @param specificResource Optional: The specific resource name if `resourceAccess` is 'specific'.
   * @returns A Promise that resolves to an object containing the generated token, its payload, and expiration.
   * @throws {AppError} If token generation fails.
   */
  async generateToken(
    role: string = 'user',
    expiresIn: string = '30d',
    resourceAccess: string = 'all',
    specificResource?: string
  ) {
    try {
      const tokenPayload: any = {
        id: `api_${Date.now()}`,
        role: role
      };

      if (resourceAccess === 'specific' && specificResource) {
        tokenPayload.resourceAccess = specificResource;
      }

      const token = generateToken(tokenPayload, expiresIn);

      logger.info({ role, expiresIn, resourceAccess }, 'API token generated');

      return {
        success: true,
        data: {
          token,
          payload: tokenPayload,
          expiresIn
        }
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to generate token');
      throw new AppError('Failed to generate token', 500);
    }
  }

  /**
   * Retrieves system statistics, including table counts, uptime, memory usage, and version information.
   * Also includes record counts and last modification times for each table.
   * @returns A Promise that resolves to an object containing various system statistics.
   * @throws {AppError} If there is an error retrieving system statistics.
   */
  async getSystemStats() {
    try {
      const tables = await this.getTables();
      const stats: any = {
        tables: tables.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        tableStats: {}
      };

      // Get record counts for each table
      for (const table of tables) {
        try {
          const records = await tableManager.findAll(table, 9999, 0);
          stats.tableStats[table] = {
            records: records.length,
            lastModified: new Date().toISOString()
          };
        } catch {
          stats.tableStats[table] = {
            records: 0,
            error: 'Failed to count records'
          };
        }
      }

      return stats;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to get system stats');
      throw new AppError('Failed to get system stats', 500);
    }
  }

  /**
   * Deletes multiple records from a specified table by their IDs.
   * @param tableName The name of the table from which to delete records.
   * @param ids An array of IDs of the records to delete.
   * @returns A Promise that resolves to an object indicating success and the number of deleted records.
   * @throws {AppError} If no IDs are provided or if the bulk deletion fails.
   */
  async bulkDeleteRecords(tableName: string, ids: string[]) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('No IDs provided', 400);
      }
      let deletedCount = 0;
      for (const id of ids) {
        const deleted = await tableManager.delete(tableName, id);
        if (deleted) deletedCount++;
      }
      return {
        success: true,
        data: { deleted: deletedCount }
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tableName, ids }, 'Failed to bulk delete records');
      throw new AppError('Failed to bulk delete records', 500);
    }
  }

  /**
   * Exports data from a specified table in a given format.
   * @param tableName The name of the table to export.
   * @param format The desired export format ('csv', 'json', or 'xlsx', default: 'csv').
   * @returns A Promise that resolves to an object containing the exported content, MIME type, and file extension.
   * @throws {AppError} If the table export fails.
   */
  async exportTableData(tableName: string, format: string = 'csv') {
    try {
      const data = await tableManager.findAll(tableName, 99999, 0);
      let content;
      let mimeType = 'text/csv';
      let fileExt = 'csv';
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        fileExt = 'json';
      } else if (format === 'xlsx') {
        // Pour xlsx, il faudrait utiliser une lib type xlsx, ici on renvoie du JSON pour l'exemple
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExt = 'xlsx';
      } else {
        // CSV simple
        const keys = data.length > 0 ? Object.keys(data[0]) : [];
        const csvRows = [keys.join(',')];
        for (const row of data) {
          csvRows.push(keys.map(k => JSON.stringify(row[k] ?? '')).join(','));
        }
        content = csvRows.join('\n');
      }
      return { content, mimeType, fileExt };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, tableName, format }, 'Failed to export table');
      throw new AppError('Failed to export table', 500);
    }
  }
}
