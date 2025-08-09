import { tableManager } from '../database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../logger';
import { loadResourceMeta, saveResourceMeta } from '../services/metaService';
import { policyFilter, fieldPolicyFilter, PolicyRequest } from '../middleware/policyAuth';

/**
 * Controller for handling resource-related operations, including CRUD, schema management, and batch requests.
 */
export class ResourceController {
  /**
   * Finds resources based on query parameters.
   * Applies policy filters to the results.
   * @param req The Express request object, extended with PolicyRequest properties.
   * @param res The Express response object.
   */
  async find(req: PolicyRequest, res: any) {
    const { resource } = req.params;
    const { limit, offset, page, sort, select, where, populate } = req.query;
    const actualLimit = limit ? Number(limit) : undefined;
    const actualOffset = offset ? Number(offset) : (page ? (Number(page) - 1) * (actualLimit || 10) : undefined);
    const actualPopulate = populate ? (populate as string).split(',') : [];

    let actualWhere: Record<string, any> | undefined;
    if (typeof where === 'string') {
      try {
        actualWhere = JSON.parse(where);
      } catch {
        actualWhere = undefined;
      }
    } else if (where && typeof where === 'object' && !Array.isArray(where)) {
      actualWhere = where as Record<string, any>;
    } else {
      actualWhere = undefined;
    }

    const results = await tableManager.findAll(
      resource,
      actualLimit,
      actualOffset,
      actualPopulate,
      sort as string | string[],
      select as string | string[],
      actualWhere
    );

    const filteredResults = await policyFilter(req, results, resource);

    res.json({ success: true, data: filteredResults });
  }

  /**
   * Finds a single resource by its ID.
   * Applies field-level policy filters to the result.
   * @param req The Express request object, extended with PolicyRequest properties.
   * @param res The Express response object.
   * @throws {AppError} If the resource is not found.
   */
  async findById(req: PolicyRequest, res: any) {
    const { resource, id } = req.params;
    const { populate } = req.query;
    const actualPopulate = populate ? (populate as string).split(',') : [];

    const result = await tableManager.findById(resource, id, actualPopulate);

    if (!result) {
      throw new AppError('Not found', 404);
    }

    const filteredResult = await fieldPolicyFilter(req, result);

    res.json({ success: true, data: filteredResult });
  }

  /**
   * Creates a new resource.
   * If the resource schema does not exist, it will be auto-generated from the provided data.
   * If new fields are detected, they will be automatically added to the schema and database.
   * @param req The Express request object, extended with PolicyRequest properties, containing resource data in the body.
   * @param res The Express response object.
   */
  async create(req: PolicyRequest, res: any) {
    const { resource } = req.params;
    const data = req.body;

    // Check if resource exists, if not auto-generate it
    let meta = await loadResourceMeta(resource);
    
    if (!meta) {
      // Auto-generate resource schema from the provided data
      meta = await this.autoGenerateResource(resource, data, req.user?.role || 'user');
    } else {
      // Check for new fields and add them if needed
      await this.ensureFieldsExist(resource, meta, data);
    }

    const result = await tableManager.create(resource, data);

    res.status(201).json({ success: true, data: result });
  }

  /**
   * Updates an existing resource.
   * If new fields are detected, they will be automatically added to the schema and database.
   * @param req The Express request object, extended with PolicyRequest properties, containing resource ID in params and update data in body.
   * @param res The Express response object.
   */
  async update(req: PolicyRequest, res: any) {
    const { resource, id } = req.params;
    const data = req.body;

    // Check for new fields and add them if needed
    const meta = await loadResourceMeta(resource);
    if (meta) {
      await this.ensureFieldsExist(resource, meta, data);
    }

    const result = await tableManager.update(resource, id, data);

    res.json({ success: true, data: result });
  }

  /**
   * Deletes a resource by its ID.
   * @param req The Express request object, extended with PolicyRequest properties, containing resource ID in params.
   * @param res The Express response object.
   */
  async delete(req: PolicyRequest, res: any) {
    const { resource, id } = req.params;

    await tableManager.delete(resource, id);

    res.json({ success: true, message: 'Deleted successfully' });
  }

  /**
   * Creates a resource if it does not already exist based on a filter.
   * @param req The Express request object, extended with PolicyRequest properties, containing filter and data in the body.
   * @param res The Express response object.
   * @throws {AppError} If filter or data are missing or invalid.
   */
  async createIfNotExists(req: PolicyRequest, res: any) {
    const { resource } = req.params;
    const { filter, data } = req.body;

    if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
      throw new AppError('Filter is required and must be a non-empty object', 400);
    }
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new AppError('Data is required and must be a non-empty object', 400);
    }

    let meta = await loadResourceMeta(resource);

    if (!meta) {
      meta = await this.autoGenerateResource(resource, data, req.user?.role || 'user');
    } else {
      // Check for new fields and add them if needed
      await this.ensureFieldsExist(resource, meta, data);
    }

    // Check permissions for 'create' action
    this.checkPermissions(meta, 'create', req.user?.role || 'anon', req.user?.resourceAccess, resource);

    // Try to find existing records
    const existingRecords = await tableManager.findAll(resource, undefined, undefined, undefined, undefined, undefined, filter);

    if (existingRecords && existingRecords.length > 0) {
      // If records exist, return the first one
      res.status(200).json({ success: true, data: existingRecords[0], created: false });
    } else {
      // If no records found, create a new one
      const newRecord = await tableManager.create(resource, data);
      res.status(201).json({ success: true, data: newRecord, created: true });
    }
  }

  /**
   * Updates a resource if it exists based on a filter.
   * @param req The Express request object, extended with PolicyRequest properties, containing filter and data in the body.
   * @param res The Express response object.
   * @throws {AppError} If filter or data are missing or invalid, or if the resource is not found.
   */
  async updateIfExists(req: PolicyRequest, res: any) {
    const { resource } = req.params;
    const { filter, data } = req.body;

    if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
      throw new AppError('Filter is required and must be a non-empty object', 400);
    }
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new AppError('Data is required and must be a non-empty object', 400);
    }

    let meta = await loadResourceMeta(resource);

    if (!meta) {
      throw new AppError(`Resource '${resource}' not found`, 404);
    }

    // Check for new fields and add them if needed
    await this.ensureFieldsExist(resource, meta, data);

    // Check permissions for 'update' action
    this.checkPermissions(meta, 'update', req.user?.role || 'anon', req.user?.resourceAccess, resource);

    // Try to find existing records
    const existingRecords = await tableManager.findAll(resource, undefined, undefined, undefined, undefined, undefined, filter);

    if (existingRecords && existingRecords.length > 0) {
      // If records exist, update the first one
      const recordToUpdate = existingRecords[0];
      const updatedRecord = await tableManager.update(resource, recordToUpdate.id, data);
      res.status(200).json({ success: true, data: updatedRecord, updated: true });
    } else {
      // If no records found, return a message indicating no update
      res.status(200).json({ success: true, message: 'No matching record found for update', updated: false });
    }
  }

  /**
   * Handles a single resource request (create, read, update, delete).
   * Performs permission checks and foreign key validations.
   * @param resource The name of the resource.
   * @param action The action to perform (e.g., 'create', 'read').
   * @param data The data payload for the action.
   * @param userRole The role of the authenticated user.
   * @param resourceAccess Optional: Specific resource access granted to the user.
   * @param query Optional: Query parameters for read operations.
   * @returns A Promise that resolves to the result of the action.
   * @throws {AppError} If the resource is not found, permissions are insufficient, or validation fails.
   */
  async handleRequest(
    resource: string,
    action: string,
    data: any,
    userRole: string,
    resourceAccess?: string,
    query?: any
  ) {
    // Load and validate metadata
    let meta = await loadResourceMeta(resource);

    // If metadata doesn't exist and we're trying to create, auto-generate it
    if (!meta && action === 'create') {
      meta = await this.autoGenerateResource(resource, data, userRole);
    } else if (!meta) {
      throw new AppError(`Resource '${resource}' not found`, 404);
    } else if ((action === 'create' || action === 'update') && data) {
      // Check for new fields and add them if needed
      await this.ensureFieldsExist(resource, meta, data);
    }

    // Check permissions
    this.checkPermissions(meta, action, userRole, resourceAccess, resource);

    // Validate foreign keys for create/update
    if (action === 'create' || action === 'update') {
      await this.validateForeignKeys(meta, data);
    }

    // Execute action
    return await this.executeAction(resource, action, data, query);
  }

  /**
   * Handles a batch of resource requests.
   * @param requests An array of request objects, each containing resource, action, and data.
   * @param userRole The role of the authenticated user.
   * @param resourceAccess Optional: Specific resource access granted to the user.
   * @returns A Promise that resolves to an array of results for each batch request.
   */
  async handleBatchRequests(
    requests: any[],
    userRole: string,
    resourceAccess?: string
  ) {
    const results: any[] = [];

    for (const request of requests) {
      try {
        const { resource, action, data } = request;
        const result = await this.handleRequest(
          resource,
          action,
          data,
          userRole,
          resourceAccess
        );
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Retrieves the schema (metadata) for a specific resource.
   * @param resource The name of the resource.
   * @returns A Promise that resolves to the resource's metadata.
   */
  async getResourceSchema(resource: string) {
    return await loadResourceMeta(resource);
  }

  /**
   * Checks if the user has sufficient permissions to perform a given action on a resource.
   * @param meta The resource metadata containing permission definitions.
   * @param action The action to check (e.g., 'create', 'read').
   * @param userRole The role of the authenticated user.
   * @param resourceAccess Optional: Specific resource access granted to the user.
   * @param resource Optional: The name of the resource.
   * @throws {AppError} If permissions are insufficient.
   */
  private checkPermissions(
    meta: any,
    action: string,
    userRole: string,
    resourceAccess?: string,
    resource?: string
  ) {
    const requiredRoles = meta.permissions?.[action] || [];

    if (!requiredRoles.includes(userRole)) {
      logger.warn({
        resource,
        action,
        userRole,
        requiredRoles
      }, 'Permission denied');
      throw new AppError('Insufficient permissions', 403);
    }

    // Check resource-specific access
    if (resourceAccess && resourceAccess !== 'all' && resourceAccess !== resource) {
      throw new AppError(`Access denied to resource '${resource}'`, 403);
    }
  }

  /**
   * Validates foreign key relationships for data being created or updated.
   * Ensures that related records exist in their respective tables.
   * @param meta The resource metadata containing field definitions.
   * @param data The data payload to validate.
   * @throws {AppError} If a foreign key validation fails.
   */
  private async validateForeignKeys(meta: any, data: any) {
    for (const [key, field] of Object.entries(meta.fields)) {
      if ((field as any).type === 'relation' && data[key]) {
        const relatedId = data[key];
        const target = (field as any).target;

        const relatedRecord = await tableManager.findById(target, relatedId);
        if (!relatedRecord) {
          throw new AppError(
            `Validation failed: Record with ID '${relatedId}' does not exist in '${target}'`,
            400
          );
        }
      }
    }
  }

  /**
   * Executes the specified CRUD action on a resource.
   * @param resource The name of the resource.
   * @param action The action to perform (e.g., 'create', 'read', 'update', 'delete').
   * @param data The data payload for the action.
   * @param query Optional: Query parameters for read operations.
   * @returns A Promise that resolves to the result of the executed action.
   * @throws {AppError} If the action is invalid or required data is missing.
   */
  private async executeAction(
    resource: string,
    action: string,
    data: any,
    query?: any
  ) {
    const populate = query?.populate ? (query.populate as string).split(',') : [];

    switch (action) {
      case 'create':
        return await tableManager.create(resource, data);

      case 'read':
        if (data.id) {
          return await tableManager.findById(resource, data.id, data.populate || populate);
        } else {
          const { limit, offset, page, sort, select, where, populate: dataPopulate } = data;
          const actualLimit = limit ? Number(limit) : undefined;
          const actualOffset = offset ? Number(offset) : (page ? (Number(page) - 1) * (actualLimit || 10) : undefined);
          const actualPopulate = dataPopulate ? (Array.isArray(dataPopulate) ? dataPopulate : [dataPopulate]) : populate;

          return await tableManager.findAll(
            resource,
            actualLimit,
            actualOffset,
            actualPopulate,
            sort,
            select,
            where
          );
        }

      case 'update':
        if (!data.id) {
          throw new AppError('ID is required for update operations', 400);
        }
        return await tableManager.update(resource, data.id, data);

      case 'delete':
        if (!data.id) {
          throw new AppError('ID is required for delete operations', 400);
        }
        return await tableManager.delete(resource, data.id);

      default:
        throw new AppError(`Invalid action: ${action}`, 400);
    }
  }

  /**
   * Auto-generates a resource schema and creates its corresponding table in the database.
   * Infers field types from provided sample data.
   * @param resource The name of the resource to auto-generate.
   * @param data Sample data used to infer the resource's fields.
   * @param userRole The role of the user initiating the auto-generation.
   * @returns A Promise that resolves to the newly generated resource metadata.
   */
  private async autoGenerateResource(resource: string, data: any, userRole: string) {
    logger.info({ resource, userRole }, 'Auto-generating new resource');

    // Infer schema from data
    const fields: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue; // Skip ID as it's auto-generated

      fields[key] = {
        type: this.inferFieldType(value),
        required: value !== null && value !== undefined
      };
    }

    // Create metadata with default permissions
    const meta = {
      fields,
      permissions: {
        create: ["admin", "user"],
        read: ["admin", "user", "anon"],
        update: ["admin", "user"],
        delete: ["admin"]
      }
    };

    // Save metadata
    await saveResourceMeta(resource, meta);

    // Create table in database
    await tableManager.createTableFromSchema(resource, meta);

    logger.info({ resource, fields }, 'Resource auto-generated successfully');

    return meta;
  }

  /**
   * Infers the appropriate field type (e.g., 'string', 'integer', 'boolean') from a given value.
   * @param value The value from which to infer the type.
   * @returns The inferred field type as a string.
   */
  private inferFieldType(value: any): string {
    if (value === null || value === undefined) {
      return 'string'; // Default to string for null/undefined
    }

    if (typeof value === 'boolean') {
      return 'boolean';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'decimal';
    }

    if (typeof value === 'string') {
      // Check if it's an email
      if (value.includes('@') && value.includes('.')) {
        return 'email';
      }

      // Check if it's a date
      if (!isNaN(Date.parse(value))) {
        return 'datetime';
      }

      // Check if it's a long text (more than 255 chars)
      if (value.length > 255) {
        return 'text';
      }

      return 'string';
    }

    if (typeof value === 'object') {
      return 'json';
    }

    return 'string'; // Default fallback
  }

  /**
   * Ensures that all fields in the provided data exist in the resource schema and database.
   * If new fields are detected, they are automatically added to both the schema and the database table.
   * @param resource The name of the resource.
   * @param meta The current resource metadata.
   * @param data The data containing potentially new fields.
   */
  private async ensureFieldsExist(resource: string, meta: any, data: any) {
    const newFields: any = {};
    let hasNewFields = false;

    // Check each field in the data
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue; // Skip system fields

      // If field doesn't exist in current schema, add it
      if (!meta.fields[key]) {
        newFields[key] = {
          type: this.inferFieldType(value),
          required: false // New fields are optional by default
        };
        hasNewFields = true;
        logger.info({ resource, field: key, type: newFields[key].type }, 'Auto-adding new field to resource');
      }
    }

    // If we have new fields, update the schema and database
    if (hasNewFields) {
      // Update the metadata
      meta.fields = { ...meta.fields, ...newFields };
      
      // Save updated metadata
      await saveResourceMeta(resource, meta);
      
      // Update the database table to add new columns
      await tableManager.createTableFromSchema(resource, meta);
      
      logger.info({ resource, newFields: Object.keys(newFields) }, 'Successfully added new fields to resource');
    }
  }
}