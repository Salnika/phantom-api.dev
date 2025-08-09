import { Router, Request, Response } from 'express';
import { adminAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AdminController } from '../controllers/admin';
import { PolicyController } from '../controllers/policy';
import { JwtController } from '../controllers/jwtController';
import { tokenRoutes } from './tokens';

/**
 * Creates and configures the Express routes for the admin API.
 * These routes are typically protected by `adminAuth` middleware.
 * @returns A Promise that resolves to an Express Router instance with admin routes.
 */
export async function createAdminRoutes() {
  const adminController = new AdminController();
  const policyController = new PolicyController();
  const jwtController = new JwtController();

  // API routes under /admin/api/
  const apiRouter = Router();

  /**
   * GET /admin/api/tables
   * Retrieves a list of all available table names (resources).
   * Requires admin authentication.
   */
  apiRouter.get('/tables', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const tables = await adminController.getTables();
    res.json({ success: true, data: tables });
  }));

  /**
   * GET /admin/api/tables/:table/data
   * Retrieves data from a specified table with pagination and population options.
   * Requires admin authentication.
   * @param {string} table - The name of the table.
   * @query {number} [page=1] - The page number for pagination.
   * @query {number} [limit=10] - The maximum number of records per page.
   * @query {string} [populate] - Comma-separated list of fields to populate.
   */
  apiRouter.get('/tables/:table/data', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { table } = req.params;
    const { page = 1, limit = 10, populate } = req.query;

    const result = await adminController.getTableData(
      table,
      Number(page),
      Number(limit),
      populate ? (populate as string).split(',') : []
    );

    res.json(result);
  }));

  /**
   * GET /admin/api/tables/:table/schema
   * Retrieves the schema (field definitions) for a specified table.
   * Requires admin authentication.
   * @param {string} table - The name of the table.
   */
  apiRouter.get('/tables/:table/schema', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { table } = req.params;
    const schema = await adminController.getTableSchema(table);
    res.json(schema);
  }));

  /**
   * PUT /admin/api/tables/:table/records/:id
   * Updates a record in the specified table.
   * Requires admin authentication.
   * @param {string} table - The name of the table.
   * @param {string} id - The ID of the record to update.
   * @body {object} - The data to update the record with.
   */
  apiRouter.put('/tables/:table/records/:id', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { table, id } = req.params;
    const result = await adminController.updateRecord(table, id, req.body);
    res.json(result);
  }));

  /**
   * DELETE /admin/api/tables/:table/records/:id
   * Deletes a record from the specified table by its ID.
   * Requires admin authentication.
   * @param {string} table - The name of the table.
   * @param {string} id - The ID of the record to delete.
   */
  apiRouter.delete('/tables/:table/records/:id', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { table, id } = req.params;
    const result = await adminController.deleteRecord(table, id);
    res.json(result);
  }));

  /**
   * POST /admin/api/tables/:table/records/bulk-delete
   * Deletes multiple records from a specified table by their IDs.
   * Requires admin authentication.
   * @param {string} table - The name of the table.
   * @body {string[]} ids - An array of IDs of the records to delete.
   */
  apiRouter.post('/tables/:table/records/bulk-delete', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { table } = req.params;
    const { ids } = req.body;
    const result = await adminController.bulkDeleteRecords(table, ids);
    res.json(result);
  }));

  /**
   * GET /admin/api/tables/:table/export
   * Exports data from a specified table in a given format.
   * Requires admin authentication.
   * @param {string} table - The name of the table.
   * @query {string} [format='csv'] - The desired export format ('csv', 'json', or 'xlsx').
   */
  apiRouter.get('/tables/:table/export', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { table } = req.params;
    const { format = 'csv' } = req.query;
    const { content, mimeType, fileExt } = await adminController.exportTableData(table, format as string);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${table}_export.${fileExt}"`);
    res.send(content);
  }));

  /**
   * GET /admin/api/logs
   * Retrieves log entries from the application or error log files.
   * Requires admin authentication.
   * @query {string} [type='app'] - The type of log to retrieve ('app' or 'error').
   * @query {number} [lines=100] - The number of lines to retrieve from the end of the log file.
   */
  apiRouter.get('/logs', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { type = 'app', lines = 100 } = req.query;
    const result = await adminController.getLogs(type as string, Number(lines));
    res.json(result);
  }));

  /**
   * POST /admin/api/migrations/pull
   * Initiates the process of pulling new database migrations from the backend.
   * Requires admin authentication.
   */
  apiRouter.post('/migrations/pull', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const result = await adminController.pullMigrations();
    res.json(result);
  }));

  /**
   * POST /admin/api/migrations/apply
   * Applies a specific database migration by its ID (filename).
   * Requires admin authentication.
   * @body {string} migrationId - The ID (filename) of the migration to apply.
   */
  apiRouter.post('/migrations/apply', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { migrationId } = req.body;
    const result = await adminController.applyMigration(migrationId);
    res.json(result);
  }));

  /**
   * POST /admin/api/seeds/generate
   * Generates seed data for specified tables.
   * Requires admin authentication.
   * @body {string[]} tables - An array of table names for which to generate seed data.
   */
  apiRouter.post('/seeds/generate', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { tables } = req.body;
    const result = await adminController.generateSeeds(tables);
    res.json(result);
  }));

  /**
   * POST /admin/api/generate-token
   * Generates an API token with specified roles, expiration, and resource access.
   * Requires admin authentication.
   * @body {string} [role='user'] - The role to assign to the token.
   * @body {string} [expiresIn='30d'] - The expiration time for the token (e.g., '1h', '30d').
   * @body {string} [resourceAccess='all'] - The level of resource access ('all' or 'specific').
   * @body {string} [specificResource] - The specific resource name if `resourceAccess` is 'specific'.
   */
  apiRouter.post('/generate-token', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { role = 'user', expiresIn = '30d', resourceAccess = 'all', specificResource } = req.body;
    const result = await adminController.generateToken(role, expiresIn, resourceAccess, specificResource);
    res.json(result);
  }));

  /**
   * GET /admin/api/stats
   * Retrieves system statistics, including table counts, uptime, memory usage, and version information.
   * Requires admin authentication.
   */
  apiRouter.get('/stats', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const stats = await adminController.getSystemStats();
    res.json({ success: true, data: stats });
  }));

  /**
   * GET /admin/api/current-user
   * Retrieves information about the currently authenticated admin user.
   * Requires admin authentication.
   */
  apiRouter.get('/current-user', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    res.json({
      success: true,
      data: {
        id: user.id,
        role: user.role,
        email: user.email || 'admin@phantom-api.com'
      }
    });
  }));

  /**
   * GET /admin/api/logs/:type
   * Retrieves log entries of a specific type (app or error).
   * Requires admin authentication.
   * @param {string} type - The type of log to retrieve ('app' or 'error').
   * @query {number} [lines=100] - The number of lines to retrieve from the end of the log file.
   */
  apiRouter.get('/logs/:type', adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params;
    const { lines = 100 } = req.query;
    const logs = await adminController.getLogs(type, Number(lines));
    res.json({ success: true, data: logs });
  }));

  // ============ POLICIES MANAGEMENT ============

  /**
   * GET /admin/api/policies
   * Retrieves all policies based on optional filters.
   * Requires admin authentication.
   * @query {boolean} [isActive] - Filter by policy active status.
   * @query {string} [type] - Filter by policy type.
   */
  apiRouter.get('/policies', adminAuth, asyncHandler(policyController.getPolicies.bind(policyController)));

  /**
   * GET /admin/api/policies/:id
   * Retrieves a single policy by its ID.
   * Requires admin authentication.
   * @param {string} id - The ID of the policy.
   */
  apiRouter.get('/policies/:id', adminAuth, asyncHandler(policyController.getPolicyById.bind(policyController)));

  /**
   * POST /admin/api/policies
   * Creates a new policy.
   * Requires admin authentication.
   * @body {string} name - The name of the policy.
   * @body {string} [description] - A description of the policy.
   * @body {string} type - The type of the policy (e.g., 'ROLE_BASED', 'ATTRIBUTE_BASED').
   * @body {object[]} rules - An array of policy rules.
   * @body {boolean} [isActive=true] - Whether the policy is active.
   * @body {number} [priority=100] - The priority of the policy.
   * @body {string[]} [tags] - An array of tags for the policy.
   */
  apiRouter.post('/policies', adminAuth, asyncHandler(policyController.createPolicy.bind(policyController)));

  /**
   * PUT /admin/api/policies/:id
   * Updates an existing policy.
   * Requires admin authentication.
   * @param {string} id - The ID of the policy to update.
   * @body {object} - The policy data to update.
   */
  apiRouter.put('/policies/:id', adminAuth, asyncHandler(policyController.updatePolicy.bind(policyController)));

  /**
   * DELETE /admin/api/policies/:id
   * Deletes a policy by its ID.
   * Requires admin authentication.
   * @param {string} id - The ID of the policy to delete.
   */
  apiRouter.delete('/policies/:id', adminAuth, asyncHandler(policyController.deletePolicy.bind(policyController)));

  /**
   * POST /admin/api/policies/:policyId/assign/user/:userId
   * Assigns a policy to a specific user.
   * Requires admin authentication.
   * @param {string} policyId - The ID of the policy to assign.
   * @param {string} userId - The ID of the user to assign the policy to.
   * @body {string} [expiresAt] - Optional expiration date for the assignment.
   */
  apiRouter.post('/policies/:policyId/assign/user/:userId', adminAuth, asyncHandler(policyController.assignPolicyToUser.bind(policyController)));

  /**
   * POST /admin/api/policies/:policyId/assign/role/:role
   * Assigns a policy to a specific role.
   * Requires admin authentication.
   * @param {string} policyId - The ID of the policy to assign.
   * @param {string} role - The name of the role to assign the policy to.
   * @body {number} [priority=100] - The priority of the role assignment.
   */
  apiRouter.post('/policies/:policyId/assign/role/:role', adminAuth, asyncHandler(policyController.assignPolicyToRole.bind(policyController)));

  /**
   * GET /admin/api/users/:userId/policies
   * Retrieves all policies assigned to a specific user and role.
   * Requires admin authentication.
   * @param {string} userId - The ID of the user.
   * @query {string} role - The role of the user.
   */
  apiRouter.get('/users/:userId/policies', adminAuth, asyncHandler(policyController.getUserPolicies.bind(policyController)));

  /**
   * POST /admin/api/policies/test-access
   * Tests access for a given context (user, resource, action).
   * Requires admin authentication.
   * @body {object} context - The evaluation context, including user, resource, and action.
   */
  apiRouter.post('/policies/test-access', adminAuth, asyncHandler(policyController.testAccess.bind(policyController)));

  /**
   * POST /admin/api/policies/:id/test
   * Tests a specific policy against a given context.
   * Requires admin authentication.
   * @param {string} id - The ID of the policy to test.
   * @body {object} context - The evaluation context, including user, resource, and action.
   */
  apiRouter.post('/policies/:id/test', adminAuth, asyncHandler(policyController.testPolicy.bind(policyController)));

  /**
   * GET /admin/api/policies-templates
   * Retrieves a list of predefined policy templates.
   * Requires admin authentication.
   */
  apiRouter.get('/policies-templates', adminAuth, asyncHandler(policyController.getPolicyTemplates.bind(policyController)));

  /**
   * GET /admin/api/policies-analytics
   * Retrieves policy analytics, including counts of total and active policies, and distribution by type.
   * Requires admin authentication.
   */
  apiRouter.get('/policies-analytics', adminAuth, asyncHandler(policyController.getPolicyAnalytics.bind(policyController)));

  // ============ JWT TOKEN MANAGEMENT ============

  /**
   * GET /admin/api/tokens
   * Retrieves all JWT tokens with pagination and filtering.
   * Requires admin authentication.
   * @query {number} [page=1] - Page number for pagination
   * @query {number} [limit=20] - Number of tokens per page
   * @query {string} [userId] - Filter by user ID
   * @query {string} [tokenType] - Filter by token type
   * @query {boolean} [isRevoked] - Filter by revocation status
   * @query {boolean} [includeExpired=false] - Include expired tokens
   */
  apiRouter.get('/tokens', adminAuth, asyncHandler(jwtController.getTokens.bind(jwtController)));

  /**
   * GET /admin/api/tokens/stats
   * Retrieves JWT token statistics.
   * Requires admin authentication.
   */
  apiRouter.get('/tokens/stats', adminAuth, asyncHandler(jwtController.getTokenStats.bind(jwtController)));

  /**
   * GET /admin/api/tokens/:tokenId
   * Retrieves details of a specific JWT token.
   * Requires admin authentication.
   * @param {string} tokenId - The ID of the token
   */
  apiRouter.get('/tokens/:tokenId', adminAuth, asyncHandler(jwtController.getTokenById.bind(jwtController)));

  /**
   * GET /admin/api/tokens/user/:userId
   * Retrieves all tokens for a specific user.
   * Requires admin authentication.
   * @param {string} userId - The ID of the user
   * @query {number} [limit=20] - Number of tokens to return
   * @query {number} [offset=0] - Number of tokens to skip
   */
  apiRouter.get('/tokens/user/:userId', adminAuth, asyncHandler(jwtController.getUserTokens.bind(jwtController)));

  /**
   * POST /admin/api/tokens
   * Creates a new JWT token.
   * Requires admin authentication.
   * @body {string} [userId] - User ID to associate with the token
   * @body {string} [tokenType='api'] - Type of token (api, access, refresh)
   * @body {string} [expiresIn='30d'] - Token expiration time
   * @body {string|string[]} [scopes] - Token scopes/permissions
   * @body {object} [metadata] - Additional metadata
   */
  apiRouter.post('/tokens', adminAuth, asyncHandler(jwtController.createToken.bind(jwtController)));

  /**
   * POST /admin/api/tokens/:tokenId/revoke
   * Revokes a specific JWT token.
   * Requires admin authentication.
   * @param {string} tokenId - The ID of the token to revoke
   */
  apiRouter.post('/tokens/:tokenId/revoke', adminAuth, asyncHandler(jwtController.revokeToken.bind(jwtController)));

  /**
   * POST /admin/api/tokens/user/:userId/revoke-all
   * Revokes all tokens for a specific user.
   * Requires admin authentication.
   * @param {string} userId - The ID of the user
   */
  apiRouter.post('/tokens/user/:userId/revoke-all', adminAuth, asyncHandler(jwtController.revokeAllUserTokens.bind(jwtController)));

  /**
   * POST /admin/api/tokens/cleanup
   * Cleans up expired tokens from the database.
   * Requires admin authentication.
   */
  apiRouter.post('/tokens/cleanup', adminAuth, asyncHandler(jwtController.cleanupExpiredTokens.bind(jwtController)));

  /**
   * POST /admin/api/tokens/validate
   * Validates a JWT token.
   * Requires admin authentication.
   * @body {string} token - The JWT token to validate
   */
  apiRouter.post('/tokens/validate', adminAuth, asyncHandler(jwtController.validateToken.bind(jwtController)));

  // Mount API routes directly (no /api prefix since it's already in app.ts)
  return apiRouter;
}