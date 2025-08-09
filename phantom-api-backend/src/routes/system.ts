import { Router } from 'express';
import { SystemController } from '../controllers/systemController';
import { volumeMonitor } from '../storage/volume-monitor';

export async function createSystemRoutes() {
  const router = Router();

  /**
   * POST /system/users
   * Creates a new system user.
   * @body {string} email - The email address of the new user.
   * @body {string} password - The password for the new user.
   * @body {string} roleId - The ID of the role to assign to the new user.
   */
  router.post('/users', SystemController.createUser);
  /**
   * GET /system/users
   * Retrieves all system users.
   */
  router.get('/users', SystemController.getAllUsers);
  /**
   * GET /system/users/:id
   * Retrieves a single system user by ID.
   * @param {string} id - The ID of the user to retrieve.
   */
  router.get('/users/:id', SystemController.getUserById);
  /**
   * PUT /system/users/:id
   * Updates an existing system user.
   * @param {string} id - The ID of the user to update.
   * @body {string} [email] - The new email address for the user.
   * @body {string} [password] - The new password for the user.
   * @body {string} [roleId] - The new role ID for the user.
   */
  router.put('/users/:id', SystemController.updateUser);
  /**
   * DELETE /system/users/:id
   * Deletes a system user by ID.
   * @param {string} id - The ID of the user to delete.
   */
  router.delete('/users/:id', SystemController.deleteUser);

  /**
   * POST /system/roles
   * Creates a new system role.
   * @body {string} name - The name of the new role.
   * @body {string[]} [permissions] - An array of permissions for the new role.
   */
  router.post('/roles', SystemController.createRole);
  /**
   * GET /system/roles
   * Retrieves all system roles.
   */
  router.get('/roles', SystemController.getAllRoles);
  /**
   * GET /system/roles/:id
   * Retrieves a single system role by ID.
   * @param {string} id - The ID of the role to retrieve.
   */
  router.get('/roles/:id', SystemController.getRoleById);
  /**
   * PUT /system/roles/:id
   * Updates an existing system role.
   * @param {string} id - The ID of the role to update.
   * @body {string} [name] - The new name for the role.
   * @body {string[]} [permissions] - The new permissions for the role.
   */
  router.put('/roles/:id', SystemController.updateRole);
  /**
   * DELETE /system/roles/:id
   * Deletes a system role by ID.
   * @param {string} id - The ID of the role to delete.
   */
  router.delete('/roles/:id', SystemController.deleteRole);

  /**
   * GET /system/storage
   * Gets detailed information about storage usage on the volume
   */
  router.get('/storage', (req, res) => {
    try {
      const volumeInfo = volumeMonitor.getVolumeInfo();
      res.json({
        success: true,
        data: volumeInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve storage information',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /system/storage/summary
   * Gets a brief summary of storage usage
   */
  router.get('/storage/summary', (req, res) => {
    try {
      const summary = volumeMonitor.getUsageSummary();
      const isApproachingCapacity = volumeMonitor.isApproachingCapacity();
      
      res.json({
        success: true,
        data: {
          summary,
          warning: isApproachingCapacity ? 'Storage is approaching capacity (>80%)' : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve storage summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}