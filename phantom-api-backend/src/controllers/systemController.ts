import { Request, Response, NextFunction } from 'express';
import { tableManager } from '../database';
import bcrypt from 'bcryptjs';
import { logger } from '../logger';

/**
 * Controller for managing system-level entities like users and roles.
 * All methods are static as they operate directly on system tables.
 */
export class SystemController {
  /**
   * Creates a new system user.
   * @param req The Express request object containing user data (email, password, roleId) in the body.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with the newly created user or an error message.
   */
  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, roleId } = req.body;

      if (!email || !password || !roleId) {
        return res.status(400).json({ message: 'Email, password, and roleId are required' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await tableManager.create('system_User', {
        email,
        password: hashedPassword,
        roleId
      });

      res.status(201).json(newUser);
    } catch (error) {
      logger.error('Error creating system user:', error);
      next(error);
    }
  }

  /**
   * Retrieves all system users.
   * @param req The Express request object.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with an array of system users.
   */
  static async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await tableManager.findAll('system_User', 100, 0, ['roleId']); // Populate role
      res.json(users);
    } catch (error) {
      logger.error('Error getting all system users:', error);
      next(error);
    }
  }

  /**
   * Retrieves a single system user by ID.
   * @param req The Express request object containing the user ID in params.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with the user data or a 404 if not found.
   */
  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await tableManager.findById('system_User', id, ['roleId']);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      logger.error('Error getting system user by ID:', error);
      next(error);
    }
  }

  /**
   * Updates an existing system user.
   * @param req The Express request object containing the user ID in params and update data in body.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with the updated user data or a 404 if not found.
   */
  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { email, password, roleId } = req.body;

      const updateData: { [key: string]: any } = {};
      if (email) updateData.email = email;
      if (roleId) updateData.roleId = roleId;
      if (password) updateData.password = await bcrypt.hash(password, 10);

      const updatedUser = await tableManager.update('system_User', id, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      logger.error('Error updating system user:', error);
      next(error);
    }
  }

  /**
   * Deletes a system user by ID.
   * @param req The Express request object containing the user ID in params.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A 204 No Content response on successful deletion or a 404 if not found.
   */
  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const deleted = await tableManager.delete('system_User', id);

      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting system user:', error);
      next(error);
    }
  }

  /**
   * Creates a new system role.
   * @param req The Express request object containing role data (name, permissions) in the body.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with the newly created role.
   */
  static async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, permissions } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Role name is required' });
      }

      const newRole = await tableManager.create('system_Role', {
        name,
        permissions: permissions ? JSON.stringify(permissions) : '[]'
      });

      res.status(201).json(newRole);
    } catch (error) {
      logger.error('Error creating system role:', error);
      next(error);
    }
  }

  /**
   * Retrieves all system roles.
   * @param req The Express request object.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with an array of system roles.
   */
  static async getAllRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await tableManager.findAll('system_Role');
      res.json(roles);
    } catch (error) {
      logger.error('Error getting all system roles:', error);
      next(error);
    }
  }

  /**
   * Retrieves a single system role by ID.
   * @param req The Express request object containing the role ID in params.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with the role data or a 404 if not found.
   */
  static async getRoleById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const role = await tableManager.findById('system_Role', id);

      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      res.json(role);
    } catch (error) {
      logger.error('Error getting system role by ID:', error);
      next(error);
    }
  }

  /**
   * Updates an existing system role.
   * @param req The Express request object containing the role ID in params and update data in body.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A JSON response with the updated role data or a 404 if not found.
   */
  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, permissions } = req.body;

      const updateData: { [key: string]: any } = {};
      if (name) updateData.name = name;
      if (permissions) updateData.permissions = JSON.stringify(permissions);

      const updatedRole = await tableManager.update('system_Role', id, updateData);

      if (!updatedRole) {
        return res.status(404).json({ message: 'Role not found' });
      }

      res.json(updatedRole);
    } catch (error) {
      logger.error('Error updating system role:', error);
      next(error);
    }
  }

  /**
   * Deletes a system role by ID.
   * @param req The Express request object containing the role ID in params.
   * @param res The Express response object.
   * @param next The next middleware function.
   * @returns A 204 No Content response on successful deletion or a 404 if not found.
   */
  static async deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const deleted = await tableManager.delete('system_Role', id);

      if (!deleted) {
        return res.status(404).json({ message: 'Role not found' });
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting system role:', error);
      next(error);
    }
  }
}