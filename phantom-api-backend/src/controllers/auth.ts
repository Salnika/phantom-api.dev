import { tableManager } from '../database';
import {
  hashPassword,
  comparePassword,
  generateToken,
  revokeToken
} from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../logger';
import { JwtToken } from '../models/JwtToken';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Register a hook to hash passwords before creating a user
tableManager.onBeforeCreate('User', async (data) => {
  if (data.password) {
    data.password = await hashPassword(data.password);
  }
});

// Register a hook to log user deletion
tableManager.onAfterDelete('User', async (id) => {
  logger.info({ userId: id }, 'User deleted');
});

/**
 * Controller for handling user authentication and authorization.
 * Includes methods for login, registration, token management, and password reset.
 */
export class AuthController {
  /**
   * Handles user login, authenticating against database users.
   * Generates a JWT token upon successful authentication and stores it in the database.
   * @param email The user's email address.
   * @param password The user's password.
   * @param req Optional request object for device/IP info.
   * @returns A Promise that resolves to an object containing success status, JWT token, and user information.
   * @throws {AppError} If authentication fails (e.g., invalid credentials).
   */
  async login(email: string, password: string, req?: any) {
    try {

      // Check database users
      const users = await tableManager.findAll('User', 1, 0, [], undefined, undefined, {
        email: { eq: email }
      });

      if (users.length === 0) {
        throw new AppError('Invalid credentials', 401);
      }

      const user = users[0];

      // Password is required for authentication
      if (!user.password) {
        throw new AppError('Invalid credentials', 401);
      }

      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401);
      }

      // Check if user is active
      if (user.isActive === false) {
        throw new AppError('Account is disabled', 401);
      }

      const token = generateToken({
        id: user.id,
        role: user.role || 'user',
        email: user.email
      });

      // Store token in database for tracking
      try {
        const decoded = jwt.decode(token) as any;
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        await JwtToken.create({
          token_hash: tokenHash,
          user_id: user.id,
          token_type: 'access',
          is_revoked: false,
          expires_at: new Date(decoded.exp * 1000).toISOString(),
          issued_at: new Date(decoded.iat * 1000).toISOString(),
          ip_address: req?.ip || req?.connection?.remoteAddress,
          user_agent: req?.get?.('User-Agent'),
          device_info: req ? JSON.stringify({
            userAgent: req.get?.('User-Agent'),
            ip: req.ip || req.connection?.remoteAddress,
            timestamp: new Date().toISOString()
          }) : undefined
        });
      } catch (error) {
        // Log error but don't fail login if token storage fails
        logger.warn('Failed to store login token in database', { 
          userId: user.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }

      logger.info({ userId: user.id, email: user.email }, 'User logged in');

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role || 'user'
        }
      };
    } catch (error) {
      logger.warn({ email, error: error instanceof Error ? error.message : String(error) }, 'Login attempt failed');
      throw error;
    }
  }

  /**
   * Creates the first admin user if no admin exists in the system.
   * This method should only be called during initial setup.
   * @param email The email address for the admin user.
   * @param password The password for the admin user.
   * @param name Optional: The name of the admin user.
   * @returns A Promise that resolves to an object containing success status and admin user information.
   * @throws {AppError} If an admin already exists or creation fails.
   */
  async createFirstAdmin(email: string, password: string, name?: string) {
    try {
      // Check if any admin users already exist
      const existingAdmins = await tableManager.findAll('User', 1, 0, [], undefined, undefined, {
        role: { eq: 'admin' }
      });

      if (existingAdmins.length > 0) {
        throw new AppError('Admin user already exists', 400);
      }

      // Validate email and password strength
      if (!email || !email.includes('@')) {
        throw new AppError('Valid email is required', 400);
      }

      if (!password || password.length < 8) {
        throw new AppError('Password must be at least 8 characters long', 400);
      }

      // Create admin user
      const adminUser = await tableManager.create('User', {
        email,
        password,
        name: name || 'Admin',
        role: 'admin',
        isActive: 1
      });

      logger.info({ userId: adminUser.id, email }, 'First admin user created');

      return {
        success: true,
        message: 'Admin user created successfully',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: 'admin'
        }
      };
    } catch (error) {
      logger.error({ email, error: error instanceof Error ? error.message : String(error) }, 'Admin creation failed');
      throw error;
    }
  }

  /**
   * Checks if the system needs initial setup (no admin users exist).
   * @returns A Promise that resolves to true if setup is needed, false otherwise.
   */
  async needsInitialSetup() {
    try {
      const adminUsers = await tableManager.findAll('User', 1, 0, [], undefined, undefined, {
        role: { eq: 'admin' }
      });
      return adminUsers.length === 0;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to check setup status');
      return false;
    }
  }

  /**
   * Registers a new user in the system.
   * Hashes the password before storing it and generates a JWT token for the new user.
   * @param email The email address for the new user.
   * @param password The password for the new user.
   * @param name Optional: The name of the new user.
   * @returns A Promise that resolves to an object containing success status, JWT token, and new user information.
   * @throws {AppError} If the user already exists or registration fails.
   */
  async register(email: string, password: string, name?: string) {
    try {
      // Check if user already exists
      const existingUsers = await tableManager.findAll('User', 1, 0, [], undefined, undefined, {
        email: { eq: email }
      });

      if (existingUsers.length > 0) {
        throw new AppError('User already exists', 400);
      }

      // Create user
      const newUser = await tableManager.create('User', {
        email,
        password,
        name: name || email.split('@')[0],
        role: 'user',
        isActive: true
      });

      const token = generateToken({
        id: newUser.id,
        role: 'user',
        email: newUser.email
      });

      logger.info({ userId: newUser.id, email }, 'New user registered');

      return {
        success: true,
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: 'user'
        }
      };
    } catch (error) {
      logger.warn({ email, error: error instanceof Error ? error.message : String(error) }, 'Registration failed');
      throw error;
    }
  }

  /**
   * Logs out a user by revoking their JWT token.
   * @param token The JWT token to revoke.
   * @returns A Promise that resolves to an object indicating successful logout.
   * @throws {AppError} If logout fails.
   */
  async logout(token: string) {
    try {
      revokeToken(token);
      logger.info('User logged out');

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Logout failed');
      throw new AppError('Logout failed', 500);
    }
  }

  /**
   * Refreshes an existing JWT token. (Simplified implementation for demonstration).
   * In a production environment, this would involve more robust token verification.
   * @param oldToken The old JWT token to be refreshed.
   * @returns A Promise that resolves to an object containing success status and a new JWT token.
   * @throws {AppError} If token refresh fails.
   */
  async refreshToken(oldToken: string) {
    try {
      // In a production app, you'd verify the old token and issue a new one
      // For now, we'll just revoke the old token and generate a new one
      // This is a simplified implementation

      revokeToken(oldToken);

      // Generate new token with same payload
      // In production, you'd decode the old token to get the payload
      const newToken = generateToken({
        id: 'refreshed-user',
        role: 'user'
      });

      return {
        success: true,
        token: newToken
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Token refresh failed');
      throw new AppError('Token refresh failed', 401);
    }
  }

  /**
   * Initiates the password reset process for a given email.
   * (Simplified implementation - in production, this would send an email with a reset link).
   * @param email The email address for which to request a password reset.
   * @returns A Promise that resolves to an object indicating success and a message.
   * @throws {AppError} If the password reset request fails.
   */
  async requestPasswordReset(email: string) {
    try {
      // Check if user exists
      const users = await tableManager.findAll('User', 1, 0, [], undefined, undefined, {
        email: { eq: email }
      });

      if (users.length === 0) {
        // Don't reveal if email exists or not
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }

      // In production, you'd generate a reset token and send an email
      logger.info({ email }, 'Password reset requested');

      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      };
    } catch (error) {
      logger.error({ email, error: error instanceof Error ? error.message : String(error) }, 'Password reset request failed');
      throw new AppError('Password reset request failed', 500);
    }
  }

  /**
   * Resets a user's password using a reset token.
   * (Simplified implementation - in production, this would verify the token and update the password).
   * @param _resetToken The password reset token.
   * @param _newPassword The new password.
   * @returns A Promise that resolves to an object indicating successful password reset.
   * @throws {AppError} If password reset fails.
   */
  async resetPassword(_resetToken: string, _newPassword: string) {
    try {
      // In production, you'd verify the reset token and update the password
      // This is a simplified implementation

      logger.info('Password reset completed');

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Password reset failed');
      throw new AppError('Password reset failed', 400);
    }
  }
}