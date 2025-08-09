import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  validateResource,
  validatePagination,
  validateId
} from '../middleware/validation';
import { checkMultiplePermissions, dynamicPolicyAuth } from '../middleware/policyAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { ResourceController } from '../controllers/resource';
import { resourceCacheMiddleware, cacheInvalidationMiddleware } from '../middleware/cache';

export async function createApiRoutes() {
  const router = Router();
  const resourceController = new ResourceController();

  /**
   * GET /api/:resource
   * Retrieves a list of resources based on query parameters.
   * Supports pagination, sorting, selection, and filtering.
   * @param {string} resource - The name of the resource.
   * @query {number} [limit] - The maximum number of records to return.
   * @query {number} [offset] - The number of records to skip.
   * @query {number} [page] - The page number for pagination.
   * @query {string} [sort] - Fields to sort by (e.g., 'name:asc', '-createdAt').
   * @query {string} [select] - Fields to select (comma-separated).
   * @query {object} [where] - A JSON string or object for filtering records.
   * @query {string} [populate] - Comma-separated list of fields to populate.
   */
  router.get('/:resource',
    validateResource,
    validatePagination,
    resourceCacheMiddleware({ ttl: 300 }),
    authenticateToken,
    dynamicPolicyAuth('read'),
    asyncHandler(resourceController.find.bind(resourceController))
  );

  /**
   * GET /api/:resource/:id
   * Retrieves a single resource by its ID.
   * @param {string} resource - The name of the resource.
   * @param {string} id - The ID of the resource to retrieve.
   * @query {string} [populate] - Comma-separated list of fields to populate.
   */
  router.get('/:resource/:id',
    validateResource,
    validateId,
    resourceCacheMiddleware({ ttl: 600 }),
    authenticateToken,
    dynamicPolicyAuth('read'),
    asyncHandler(resourceController.findById.bind(resourceController))
  );

  /**
   * POST /api/:resource
   * Creates a new resource.
   * If the resource schema does not exist, it will be auto-generated.
   * @param {string} resource - The name of the resource.
   * @body {object} - The data for the new resource.
   */
  router.post('/:resource',
    validateResource,
    cacheInvalidationMiddleware(),
    authenticateToken,
    dynamicPolicyAuth('create'),
    asyncHandler(resourceController.create.bind(resourceController))
  );

  /**
   * PUT /api/:resource/:id
   * Updates an existing resource.
   * @param {string} resource - The name of the resource.
   * @param {string} id - The ID of the resource to update.
   * @body {object} - The data to update the resource with.
   */
  router.put('/:resource/:id',
    validateResource,
    validateId,
    cacheInvalidationMiddleware(),
    authenticateToken,
    dynamicPolicyAuth('update'),
    asyncHandler(resourceController.update.bind(resourceController))
  );

  /**
   * DELETE /api/:resource/:id
   * Deletes a resource by its ID.
   * @param {string} resource - The name of the resource.
   * @param {string} id - The ID of the resource to delete.
   */
  router.delete('/:resource/:id',
    validateResource,
    validateId,
    cacheInvalidationMiddleware(),
    authenticateToken,
    dynamicPolicyAuth('delete'),
    asyncHandler(resourceController.delete.bind(resourceController))
  );

  /**
   * POST /api/:resource/createIfNotExists
   * Creates a resource if it does not already exist based on a filter.
   * @param {string} resource - The name of the resource.
   * @body {object} filter - An object used to check for existing records.
   * @body {object} data - The data for the new resource if it needs to be created.
   */
  router.post('/:resource/createIfNotExists',
    validateResource,
    authenticateToken,
    dynamicPolicyAuth('create'), // Use 'create' permission for this action
    asyncHandler(resourceController.createIfNotExists.bind(resourceController))
  );

  /**
   * POST /api/:resource/updateIfExists
   * Updates a resource if it exists based on a filter.
   * @param {string} resource - The name of the resource.
   * @body {object} filter - An object used to find existing records.
   * @body {object} data - The data to update the resource with.
   */
  router.post('/:resource/updateIfExists',
    validateResource,
    authenticateToken,
    dynamicPolicyAuth('update'), // Use 'update' permission for this action
    asyncHandler(resourceController.updateIfExists.bind(resourceController))
  );

  /**
   * POST /api/batch
   * Executes a batch of resource requests (create, read, update, delete).
   * @body {Array<object>} requests - An array of request objects, each with `resource`, `action`, and `data`.
   */
  router.post('/batch',
    authenticateToken,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { requests } = req.body;
      const userRole = req.user?.role || 'anon';

      if (!Array.isArray(requests)) {
        return res.status(400).json({
          success: false,
          error: 'Requests must be an array'
        });
      }

      if (requests.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 requests per batch'
        });
      }

      const results = await resourceController.handleBatchRequests(
        requests,
        userRole,
        req.user?.resourceAccess
      );

      res.json({
        success: true,
        results
      });
    })
  );

  /**
   * GET /api/schema/:resource
   * Retrieves the schema (metadata) for a specific resource.
   * @param {string} resource - The name of the resource.
   */
  router.get('/schema/:resource',
    validateResource,
    authenticateToken,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { resource } = req.params;

      const schema = await resourceController.getResourceSchema(resource);

      if (!schema) {
        return res.status(404).json({
          success: false,
          error: 'Schema not found'
        });
      }

      res.json({
        success: true,
        schema
      });
    })
  );

  /**
   * POST /api/permissions/check
   * Checks multiple permissions for the authenticated user.
   * @body {Array<object>} permissions - An array of objects, each specifying a `resource` and `action` to check.
   */
  router.post('/permissions/check',
    authenticateToken,
    checkMultiplePermissions([]),
    (req, res) => {
      res.json({ success: true, message: 'All permissions granted' });
    }
  );

  return router;
}