import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { pathManager } from './path-manager';
import { logger } from '../logger';

/**
 * Manages metadata schema storage for dynamic tables
 */
export class MetaManager {
  /**
   * Saves a table schema to a JSON file
   */
  saveSchema(tableName: string, schema: Record<string, any>): void {
    try {
      const filePath = pathManager.getMetaFilePath(`${tableName}.json`);
      writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');
      logger.info(`Schema saved for table ${tableName} at ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save schema for table ${tableName}:`, error);
      throw new Error(`Failed to save schema for table ${tableName}`);
    }
  }

  /**
   * Loads a table schema from a JSON file
   */
  loadSchema(tableName: string): Record<string, any> | null {
    try {
      const filePath = pathManager.getMetaFilePath(`${tableName}.json`);
      if (!existsSync(filePath)) {
        return null;
      }
      
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load schema for table ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Checks if a schema file exists for a table
   */
  hasSchema(tableName: string): boolean {
    const filePath = pathManager.getMetaFilePath(`${tableName}.json`);
    return existsSync(filePath);
  }

  /**
   * Lists all available schema files
   */
  listSchemas(): string[] {
    try {
      const metaDir = pathManager.getMetaDirectory();
      if (!existsSync(metaDir)) {
        return [];
      }
      
      const files = readdirSync(metaDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      logger.error('Failed to list schemas:', error);
      return [];
    }
  }

  /**
   * Loads all schemas from the meta directory
   */
  loadAllSchemas(): Map<string, Record<string, any>> {
    const schemas = new Map<string, Record<string, any>>();
    
    try {
      const tableNames = this.listSchemas();
      for (const tableName of tableNames) {
        const schema = this.loadSchema(tableName);
        if (schema) {
          schemas.set(tableName, schema);
        }
      }
      
      logger.info(`Loaded ${schemas.size} schemas from storage`);
    } catch (error) {
      logger.error('Failed to load all schemas:', error);
    }
    
    return schemas;
  }

  /**
   * Deletes a schema file
   */
  deleteSchema(tableName: string): boolean {
    try {
      const filePath = pathManager.getMetaFilePath(`${tableName}.json`);
      if (existsSync(filePath)) {
        // Using require to access fs.unlinkSync since it's not imported
        const fs = require('fs');
        fs.unlinkSync(filePath);
        logger.info(`Schema deleted for table ${tableName}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete schema for table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Gets storage information about schemas
   */
  getStorageInfo(): {
    totalSchemas: number;
    schemaFiles: string[];
    metaDirectory: string;
  } {
    const schemaFiles = this.listSchemas();
    return {
      totalSchemas: schemaFiles.length,
      schemaFiles,
      metaDirectory: pathManager.getMetaDirectory()
    };
  }
}

/**
 * Singleton instance of MetaManager
 */
export const metaManager = new MetaManager();