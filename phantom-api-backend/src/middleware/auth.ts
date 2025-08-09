import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import crypto from 'crypto';

/**
 * Extends the Express Request interface to include an optional `user` property,
 * which will hold authenticated user information.
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'anon' | 'user' | 'admin';
    resourceAccess?: string;
  };
}

/**
 * Manages JWT token generation, verification, and blacklisting.
 * Implemented as a singleton to ensure a single source of truth for JWT operations.
 */
class JWTManager {
  private static instance: JWTManager;
  private jwtSecret: string;
  private tokenBlacklist: Set<string> = new Set();

  /**
   * Private constructor to enforce singleton pattern.
   * Initializes the JWT secret from environment variables.
   * @throws {Error} If JWT_SECRET is not set or is insecure in production.
   */
  private constructor() {
    this.jwtSecret = this.validateJWTSecret();
  }

  /**
   * Returns the singleton instance of JWTManager.
   * @returns The JWTManager instance.
   */
  public static getInstance(): JWTManager {
    if (!JWTManager.instance) {
      JWTManager.instance = new JWTManager();
    }
    return JWTManager.instance;
  }

  /**
   * Validates the JWT_SECRET environment variable.
   * @returns The validated JWT secret.
   * @throws {Error} If JWT_SECRET is missing, too short, or the default in production.
   */
  private validateJWTSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (secret === 'your-super-secret-jwt-key-change-this-in-production' && process.env.NODE_ENV === 'production') {
      throw new Error('Default JWT_SECRET detected. Please use a secure secret in production.');
    }

    return secret;
  }

  /**
   * Generates a new JWT token.
   * @param payload The data to be included in the token.
   * @param expiresIn The expiration time for the token (e.g., '1h', '30d').
   * @returns The generated JWT token string.
   * @throws {Error} If token generation fails.
   */
  public generateToken(payload: Record<string, unknown>, expiresIn: string | number = '30d'): string {
    try {
      const options = { expiresIn } as unknown as SignOptions;
      return jwt.sign(payload, this.jwtSecret, options);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ error: errMsg }, 'Failed to generate JWT token');
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verifies a JWT token.
   * @param token The JWT token string to verify.
   * @returns The decoded payload of the token.
   * @throws {Error} If the token is invalid, expired, or revoked.
   */
  public async verifyToken(token: string): Promise<any> {
    try {
      // Check in-memory blacklist first (for backwards compatibility)
      if (this.tokenBlacklist.has(token)) {
        throw new Error('Token has been revoked');
      }

      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, this.jwtSecret);

      // Check database for token revocation status
      try {
        const { JwtToken } = await import('../models/JwtToken');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const isValid = await JwtToken.isTokenValid(tokenHash);
        
        if (!isValid) {
          throw new Error('Token has been revoked or is invalid');
        }
        
        // Update last used timestamp
        await JwtToken.updateLastUsed(tokenHash);
      } catch {
        // If model is not available, fall back to in-memory only
        logger.warn('JwtToken model not available, using in-memory blacklist only');
      }

      return decoded;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errMsg }, 'JWT verification failed');
      throw error;
    }
  }

  /**
   * Adds a token to the blacklist, effectively revoking it.
   * @param token The JWT token string to revoke.
   */
  public addToBlacklist(token: string): void {
    this.tokenBlacklist.add(token);
    logger.info('Token added to in-memory blacklist');
  }

  /**
   * Revokes a token both in-memory and in database.
   * @param token The JWT token string to revoke.
   */
  public async revokeToken(token: string): Promise<boolean> {
    try {
      // Add to in-memory blacklist
      this.tokenBlacklist.add(token);
      
      // Also revoke in database
      try {
        const { JwtToken } = await import('../models/JwtToken');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await JwtToken.revokeToken(tokenHash);
        logger.info('Token revoked in database and memory');
        return true;
      } catch {
        logger.warn('JwtToken model not available, token revoked in memory only');
        return true;
      }
    } catch (error) {
      logger.error('Failed to revoke token', { error });
      return false;
    }
  }

  /**
   * Clears all tokens from the blacklist.
   * (Note: In a production environment, this would involve a more sophisticated cleanup mechanism for expired tokens).
   */
  public clearExpiredTokens(): void {
    // In production, implement proper token blacklist cleanup
    // For now, clear all (tokens will naturally expire)
    this.tokenBlacklist.clear();
  }
}

// Get JWT manager instance (lazy initialization)
let jwtManager: JWTManager | null = null;
const getJWTManager = () => {
  if (!jwtManager) {
    jwtManager = JWTManager.getInstance();
  }
  return jwtManager;
};

/**
 * Hashes a plain-text password using bcrypt.
 * @param password The plain-text password to hash.
 * @returns A Promise that resolves to the hashed password string.
 * @throws {Error} If password hashing fails.
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Password hashing failed');
    throw new Error('Password hashing failed');
  }
};

/**
 * Compares a plain-text password with a hashed password.
 * @param password The plain-text password.
 * @param hashedPassword The hashed password to compare against.
 * @returns A Promise that resolves to true if the passwords match, false otherwise.
 */
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Password comparison failed');
    return false;
  }
};

/**
 * Generates a JWT token using the JWTManager instance.
 * @param payload The data to be included in the token.
 * @param expiresIn Optional: The expiration time for the token (e.g., '1h', '30d').
 * @returns The generated JWT token string.
 */
export const generateToken = (payload: any, expiresIn?: string): string => {
  return getJWTManager().generateToken(payload, expiresIn);
};

/**
 * Revokes a JWT token by adding it to the blacklist.
 * @param token The JWT token string to revoke.
 */
export const revokeToken = async (token: string): Promise<boolean> => {
  return await getJWTManager().revokeToken(token);
};

/**
 * Express middleware for authenticating requests using JWT tokens.
 * Extracts token from Authorization header or cookies, verifies it, and attaches user info to `req.user`.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 * @returns A 401 or 403 response if authentication fails, otherwise calls next().
 */
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const cookieToken = req.cookies['token'];

    // Try to get token from Authorization header or cookie
    const token = authHeader?.split(' ')[1] || cookieToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = await getJWTManager().verifyToken(token);
    req.user = decoded;

    logger.debug({
      userId: decoded.id,
      role: decoded.role,
      url: req.url
    }, 'User authenticated');

    next();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn({
      error: errMsg,
      url: req.url,
      ip: req.ip
    }, 'Authentication failed');

    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

/**
 * Express middleware for authenticating admin users.
 * Uses `authenticateToken` and then checks if the authenticated user has the 'admin' role.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 * @returns A 403 response if the user is not an admin, otherwise calls next().
 */
export const adminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, (err) => {
    if (err) return;

    if (req.user?.role !== 'admin') {
      logger.warn({
        userId: req.user?.id,
        role: req.user?.role,
        url: req.url,
        ip: req.ip
      }, 'Admin access denied');

      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    next();
  });
};

/**
 * Factory function that creates an Express middleware to enforce role-based access.
 * @param roles An array of roles that are allowed to access the route.
 * @returns An Express middleware function.
 */
const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn({
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: roles,
        url: req.url
      }, 'Insufficient permissions');

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Export types and instances
export { AuthenticatedRequest, requireRole, JWTManager };