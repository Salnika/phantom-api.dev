import { Request, Response } from 'express';
import { JwtToken } from '../models/JwtToken';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../logger';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'anon' | 'user' | 'admin';
    email?: string;
  };
}

/**
 * Controller for managing JWT tokens - listing, revoking, and getting statistics
 */
export class TokenController {
  /**
   * Get all tokens with pagination and filtering
   */
  async getAllTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      
      // Build filters
      const filters: any = {};
      if (req.query.user_id) filters.user_id = req.query.user_id;
      if (req.query.token_type) filters.token_type = req.query.token_type;
      if (req.query.is_revoked !== undefined) filters.is_revoked = req.query.is_revoked === 'true';

      const tokens = await JwtToken.findAll(limit, offset, filters);
      
      // Remove sensitive information and add status
      const now = new Date().toISOString();
      const sanitizedTokens = tokens.map(token => ({
        id: token.id,
        user_id: token.user_id,
        token_type: token.token_type,
        is_revoked: token.is_revoked,
        expires_at: token.expires_at,
        issued_at: token.issued_at,
        revoked_at: token.revoked_at,
        last_used_at: token.last_used_at,
        ip_address: token.ip_address,
        user_agent: token.user_agent ? token.user_agent.substring(0, 100) : null, // Truncate user agent
        scopes: token.scopes,
        metadata: token.metadata,
        // Add computed status
        status: token.is_revoked ? 'revoked' : (token.expires_at <= now ? 'expired' : 'active'),
        token_hash_preview: token.token_hash.substring(0, 8) + '...' // Show preview only
      }));

      res.json({
        success: true,
        data: sanitizedTokens,
        pagination: {
          page,
          limit,
          hasMore: tokens.length === limit
        }
      });
    } catch (error) {
      logger.error('Failed to get tokens', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to retrieve tokens', 500);
    }
  }

  /**
   * Get tokens for a specific user
   */
  async getUserTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Check if user can access these tokens
      if (req.user?.role !== 'admin' && req.user?.id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const tokens = await JwtToken.findByUserId(userId, limit, offset);
      
      const now = new Date().toISOString();
      const sanitizedTokens = tokens.map(token => ({
        id: token.id,
        token_type: token.token_type,
        is_revoked: token.is_revoked,
        expires_at: token.expires_at,
        issued_at: token.issued_at,
        revoked_at: token.revoked_at,
        last_used_at: token.last_used_at,
        ip_address: token.ip_address,
        user_agent: token.user_agent ? token.user_agent.substring(0, 100) : null,
        scopes: token.scopes,
        status: token.is_revoked ? 'revoked' : (token.expires_at <= now ? 'expired' : 'active'),
        token_hash_preview: token.token_hash.substring(0, 8) + '...'
      }));

      res.json({
        success: true,
        data: sanitizedTokens
      });
    } catch (error) {
      logger.error('Failed to get user tokens', { 
        userId: req.params.userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Revoke a specific token by ID
   */
  async revokeToken(req: AuthenticatedRequest, res: Response) {
    try {
      const { tokenId } = req.params;
      const { reason } = req.body;

      // Find the token first
      const tokens = await JwtToken.findAll(1, 0, { id: tokenId });
      if (tokens.length === 0) {
        throw new AppError('Token not found', 404);
      }

      const token = tokens[0];

      // Check permissions
      if (req.user?.role !== 'admin' && req.user?.id !== token.user_id) {
        throw new AppError('Access denied', 403);
      }

      // Revoke the token
      const success = await JwtToken.revokeToken(token.token_hash);
      
      if (!success) {
        throw new AppError('Failed to revoke token', 500);
      }

      // Log the revocation
      logger.info('Token revoked via API', {
        tokenId,
        tokenType: token.token_type,
        revokedBy: req.user?.id,
        reason: reason || 'Manual revocation via admin interface'
      });

      res.json({
        success: true,
        message: 'Token revoked successfully',
        data: {
          id: tokenId,
          revoked_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to revoke token', { 
        tokenId: req.params.tokenId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Revoke all tokens for a specific user
   */
  async revokeAllUserTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      // Check permissions
      if (req.user?.role !== 'admin' && req.user?.id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const revokedCount = await JwtToken.revokeAllUserTokens(userId);

      logger.info('All user tokens revoked via API', {
        userId,
        revokedCount,
        revokedBy: req.user?.id,
        reason: reason || 'Manual revocation via admin interface'
      });

      res.json({
        success: true,
        message: `${revokedCount} tokens revoked successfully`,
        data: {
          user_id: userId,
          revoked_count: revokedCount,
          revoked_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to revoke user tokens', { 
        userId: req.params.userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(req: AuthenticatedRequest, res: Response) {
    try {
      // Only admins can see global stats
      if (req.user?.role !== 'admin') {
        throw new AppError('Access denied', 403);
      }

      const stats = await JwtToken.getTokenStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get token stats', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(req: AuthenticatedRequest, res: Response) {
    try {
      // Only admins can trigger cleanup
      if (req.user?.role !== 'admin') {
        throw new AppError('Access denied', 403);
      }

      const deletedCount = await JwtToken.cleanupExpiredTokens();

      logger.info('Expired tokens cleanup triggered via API', {
        deletedCount,
        triggeredBy: req.user?.id
      });

      res.json({
        success: true,
        message: `${deletedCount} expired tokens cleaned up`,
        data: {
          deleted_count: deletedCount,
          cleaned_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Validate if a token is still active (for debugging purposes)
   */
  async validateToken(req: AuthenticatedRequest, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        throw new AppError('Token is required', 400);
      }

      // Only admins or token owners can validate tokens
      try {
        const decoded = jwt.decode(token) as any;
        if (req.user?.role !== 'admin' && req.user?.id !== decoded?.id) {
          throw new AppError('Access denied', 403);
        }
      } catch {
        throw new AppError('Invalid token format', 400);
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const isValid = await JwtToken.isTokenValid(tokenHash);
      const tokenData = await JwtToken.findByTokenHash(tokenHash);

      res.json({
        success: true,
        data: {
          is_valid: isValid,
          token_info: tokenData ? {
            id: tokenData.id,
            token_type: tokenData.token_type,
            is_revoked: tokenData.is_revoked,
            expires_at: tokenData.expires_at,
            issued_at: tokenData.issued_at,
            last_used_at: tokenData.last_used_at,
            status: tokenData.is_revoked ? 'revoked' : (tokenData.expires_at <= new Date().toISOString() ? 'expired' : 'active')
          } : null
        }
      });
    } catch (error) {
      logger.error('Failed to validate token', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}

export const tokenController = new TokenController();