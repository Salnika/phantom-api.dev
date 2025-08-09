import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Manages Zod schemas for data validation, including inference from sample data,
 * loading from and saving to disk, and caching.
 */
export class ValidationManager {
  private schemaCache = new Map<string, z.ZodSchema>();
  
  /**
   * Retrieves an existing Zod schema for a given resource, or infers and creates a new one
   * if it doesn't exist. Schemas are cached in memory and persisted to disk.
   * @param resource The name of the resource for which to get or create the schema.
   * @param sampleData Sample data used to infer the schema if it needs to be created.
   * @returns A Promise that resolves to the Zod schema for the resource.
   */
  async getOrCreateSchema(resource: string, sampleData: Record<string, any>): Promise<z.ZodSchema> {
    // Check cache first
    if (this.schemaCache.has(resource)) {
      return this.schemaCache.get(resource)!;
    }

    // Try to load existing schema
    const schemaPath = this.getSchemaPath(resource);
    let schema: z.ZodSchema;

    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      const schemaData = JSON.parse(schemaContent);
      schema = this.buildZodSchemaFromConfig(schemaData);
    } // eslint-disable-next-line @typescript-eslint/no-unused-vars
    catch (_error) {
      // Create new schema from sample data
      schema = this.inferSchemaFromData(sampleData);
      await this.saveSchema(resource, schema);
    }

    this.schemaCache.set(resource, schema);
    return schema;
  }

  /**
   * Infers a Zod schema based on the types and structure of provided sample data.
   * @param data The sample data from which to infer the schema.
   * @returns A Zod schema representing the inferred structure.
   */
  private inferSchemaFromData(data: Record<string, any>): z.ZodSchema {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') {
        schemaFields[key] = z.string().optional(); // ID is auto-generated if not provided
        continue;
      }

      if (value === null || value === undefined) {
        schemaFields[key] = z.any().optional();
      } else if (typeof value === 'string') {
        if (this.isEmail(value)) {
          schemaFields[key] = z.string().email();
        } else if (this.isUrl(value)) {
          schemaFields[key] = z.string().url();
        } else if (this.isISODate(value)) {
          schemaFields[key] = z.string().datetime();
        } else {
          schemaFields[key] = z.string();
        }
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          schemaFields[key] = z.number().int();
        } else {
          schemaFields[key] = z.number();
        }
      } else if (typeof value === 'boolean') {
        schemaFields[key] = z.boolean();
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          const firstItem = value[0];
          if (typeof firstItem === 'string') {
            schemaFields[key] = z.array(z.string());
          } else if (typeof firstItem === 'number') {
            schemaFields[key] = z.array(z.number());
          } else {
            schemaFields[key] = z.array(z.any());
          }
        } else {
          schemaFields[key] = z.array(z.any());
        }
      } else if (typeof value === 'object') {
        // For nested objects, create a basic object schema
        schemaFields[key] = z.object({}).passthrough();
      } else {
        schemaFields[key] = z.any();
      }
    }

    return z.object(schemaFields);
  }

  /**
   * Builds a Zod schema from a configuration object (e.g., loaded from a JSON schema file).
   * @param config The schema configuration object.
   * @returns A Zod schema built from the configuration.
   */
  private buildZodSchemaFromConfig(config: any): z.ZodSchema {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    for (const [key, fieldConfig] of Object.entries(config.fields)) {
      const field = fieldConfig as any;
      
      let zodType: z.ZodTypeAny;

      switch (field.type) {
        case 'string':
          zodType = z.string();
          if (field.email) zodType = (zodType as z.ZodString).email();
          if (field.url) zodType = (zodType as z.ZodString).url();
          if (field.datetime) zodType = (zodType as z.ZodString).datetime();
          if (field.min) zodType = (zodType as z.ZodString).min(field.min);
          if (field.max) zodType = (zodType as z.ZodString).max(field.max);
          break;
        case 'number':
          zodType = z.number();
          if (field.int) zodType = (zodType as z.ZodNumber).int();
          if (field.min !== undefined) zodType = (zodType as z.ZodNumber).min(field.min);
          if (field.max !== undefined) zodType = (zodType as z.ZodNumber).max(field.max);
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          const itemType = field.items?.type === 'string' ? z.string() : 
                          field.items?.type === 'number' ? z.number() : z.any();
          zodType = z.array(itemType);
          break;
        case 'object':
          zodType = z.object({}).passthrough();
          break;
        default:
          zodType = z.any();
      }

      if (field.optional) {
        zodType = zodType.optional();
      }

      schemaFields[key] = zodType;
    }

    return z.object(schemaFields);
  }

  /**
   * Saves a Zod schema configuration to a JSON file on disk.
   * @param resource The name of the resource associated with the schema.
   * @param schema The Zod schema to save.
   */
  private async saveSchema(resource: string, schema: z.ZodSchema) {
    const schemaConfig = this.zodSchemaToConfig(schema);
    const schemaPath = this.getSchemaPath(resource);
    const schemaDir = path.dirname(schemaPath);

    try {
      await fs.mkdir(schemaDir, { recursive: true });
      await fs.writeFile(schemaPath, JSON.stringify(schemaConfig, null, 2));
    } catch (error) {
      console.error('Failed to save schema:', error);
    }
  }

  /**
   * Converts a Zod schema into a simplified configuration object.
   * Note: This is a basic implementation and may not capture all Zod schema complexities.
   * @param _schema The Zod schema to convert.
   * @returns A simplified configuration object representing the schema.
   */
  private zodSchemaToConfig(_schema: z.ZodSchema): any {
    // This is a simplified conversion - in a real implementation,
    // you might want to store the schema definition in a more detailed format
    return {
      version: '1.0',
      createdAt: new Date().toISOString(),
      fields: {
        // This would need to be implemented based on the actual Zod schema structure
        // For now, we'll use a basic structure
      }
    };
  }

  /**
   * Validates data against the schema for a given resource.
   * @param resource The name of the resource whose schema to use for validation.
   * @param data The data object to validate.
   * @returns A Promise that resolves to an object indicating success or failure,
   *          along with validated data or a list of errors.
   */
  async validateData(resource: string, data: Record<string, any>): Promise<{
    success: boolean;
    data?: any;
    errors?: string[];
  }> {
    try {
      const schema = await this.getOrCreateSchema(resource, data);
      const validatedData = schema.parse(data);
      
      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      
      return {
        success: false,
        errors: ['Validation failed']
      };
    }
  }

  /**
   * Updates an existing schema for a resource with new field definitions.
   * @param resource The name of the resource whose schema to update.
   * @param updates An object containing the new field definitions to apply to the schema.
   */
  async updateSchema(resource: string, updates: Record<string, any>) {
    // Update existing schema with new field definitions
    const schema = await this.getOrCreateSchema(resource, updates);
    this.schemaCache.delete(resource); // Clear cache to force reload
    await this.saveSchema(resource, schema);
  }

  /**
   * Constructs the file path for a resource's schema JSON file.
   * @param resource The name of the resource.
   * @returns The absolute path to the schema file.
   */
  private getSchemaPath(resource: string): string {
    return path.join(__dirname, '../schemas', `${resource}.json`);
  }

  /**
   * Checks if a string is a valid email address.
   * @param str The string to check.
   * @returns True if the string is an email, false otherwise.
   */
  private isEmail(str: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  /**
   * Checks if a string is a valid URL.
   * @param str The string to check.
   * @returns True if the string is a URL, false otherwise.
   */
  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a string is a valid ISO 8601 date string.
   * @param str The string to check.
   * @returns True if the string is an ISO date, false otherwise.
   */
  private isISODate(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(str);
  }

  /**
   * Retrieves a list of all available schema names (resource names) from the schemas directory.
   * @returns A Promise that resolves to an array of schema names.
   */
  async getAllSchemas(): Promise<string[]> {
    try {
      const schemaDir = path.join(__dirname, '../schemas');
      const files = await fs.readdir(schemaDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch {
      return [];
    }
  }
}

/**
 * Singleton instance of the ValidationManager.
 */
export const validationManager = new ValidationManager();