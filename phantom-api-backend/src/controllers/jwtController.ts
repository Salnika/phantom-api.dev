import { Request, Response } from 'express';
import { JwtToken } from '../models/JwtToken';
import { JWTManager } from '../middleware/auth';
import { logger } from '../logger';
import crypto from 'crypto';

/**
 * Controller for managing JWT tokens
 */
export class JwtController {
  
  /**
   * Get all JWT tokens with pagination and filtering
   * GET /admin/api/tokens
   */
  async getTokens(req: Request, res: Response) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        userId, 
        tokenType, 
        isRevoked, 
        includeExpired = false 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const filters: any = {};

      if (userId) filters.user_id = userId;
      if (tokenType) filters.token_type = tokenType;
      if (isRevoked !== undefined) filters.is_revoked = isRevoked === 'true';

      let tokens = await JwtToken.findAll(Number(limit), offset, filters);

      // Filter out expired tokens if not requested
      if (includeExpired !== 'true') {
        const now = new Date().toISOString();
        tokens = tokens.filter(token => token.expires_at > now);
      }

      // Remove sensitive token_hash from response
      const sanitizedTokens = tokens.map(token => {
        let parsedMetadata = null;
        let parsedDeviceInfo = null;
        
        try {
          parsedMetadata = token.metadata ? JSON.parse(token.metadata) : null;
        } catch (error) {
          parsedMetadata = token.metadata;
        }
        
        try {
          parsedDeviceInfo = token.device_info ? JSON.parse(token.device_info) : null;
        } catch (error) {
          parsedDeviceInfo = token.device_info;
        }
        
        return {
          ...token,
          token_hash: `${token.token_hash.substring(0, 8)}...`,
          metadata: parsedMetadata,
          device_info: parsedDeviceInfo
        };
      });

      res.json({
        success: true,
        data: {
          tokens: sanitizedTokens,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: tokens.length
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching tokens', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tokens'
      });
    }
  }

  /**
   * Get token statistics
   * GET /admin/api/tokens/stats
   */
  async getTokenStats(req: Request, res: Response) {
    try {
      const stats = await JwtToken.getTokenStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching token stats', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch token statistics'
      });
    }
  }

  /**
   * Get tokens for a specific user
   * GET /admin/api/tokens/user/:userId
   */
  async getUserTokens(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const tokens = await JwtToken.findByUserId(userId, Number(limit), Number(offset));
      
      // Remove sensitive token_hash from response
      const sanitizedTokens = tokens.map(token => {
        let parsedMetadata = null;
        let parsedDeviceInfo = null;
        
        try {
          parsedMetadata = token.metadata ? JSON.parse(token.metadata) : null;
        } catch (error) {
          parsedMetadata = token.metadata;
        }
        
        try {
          parsedDeviceInfo = token.device_info ? JSON.parse(token.device_info) : null;
        } catch (error) {
          parsedDeviceInfo = token.device_info;
        }
        
        return {
          ...token,
          token_hash: `${token.token_hash.substring(0, 8)}...`,
          metadata: parsedMetadata,
          device_info: parsedDeviceInfo
        };
      });

      res.json({
        success: true,
        data: sanitizedTokens
      });
    } catch (error) {
      logger.error('Error fetching user tokens', { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user tokens'
      });
    }
  }

  /**
   * Create a new API token
   * POST /admin/api/tokens
   */
  async createToken(req: Request, res: Response) {
    try {
      const { 
        userId, 
        tokenType = 'api', 
        expiresIn = '30d', 
        scopes,
        metadata 
      } = req.body;

      // Get device info from request
      const deviceInfo = {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      };

      // Generate JWT token
      const jwtManager = JWTManager.getInstance();
      const payload: { id: any; role: string; tokenType: any; scopes?: any } = {
        id: userId || `api_${Date.now()}`,
        role: 'user',
        tokenType,
        ...(scopes && { scopes })
      };

      const token = jwtManager.generateToken(payload, expiresIn);
      const decoded: any = await jwtManager.verifyToken(token);

      // Hash the token for storage
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Store token in database
      const tokenData = await JwtToken.create({
        token_hash: tokenHash,
        user_id: userId,
        token_type: tokenType,
        is_revoked: false,
        expires_at: new Date(decoded.exp * 1000).toISOString(),
        issued_at: new Date(decoded.iat * 1000).toISOString(),
        device_info: JSON.stringify(deviceInfo),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        scopes: Array.isArray(scopes) ? scopes.join(',') : scopes,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      });

      logger.info('API token created', { 
        tokenId: tokenData.id,
        userId,
        tokenType,
        expiresAt: tokenData.expires_at
      });

      res.json({
        success: true,
        data: {
          token,
          tokenInfo: {
            id: tokenData.id,
            type: tokenData.token_type,
            expiresAt: tokenData.expires_at,
            scopes: tokenData.scopes
          }
        }
      });
    } catch (error) {
      logger.error('Error creating token', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create token'
      });
    }
  }

  /**
   * Revoke a specific token
   * POST /admin/api/tokens/:tokenId/revoke
   */
  async revokeToken(req: Request, res: Response) {
    try {
      const { tokenId } = req.params;
      
      // Find token by ID
      const tokens = await JwtToken.findAll(1000, 0, { id: tokenId });
      const token = tokens.find(t => t.id === tokenId);
      
      if (!token) {
        return res.status(404).json({
          success: false,
          error: 'Token not found'
        });
      }

      const success = await JwtToken.revokeToken(token.token_hash);
      
      if (success) {
        // Add to blacklist
        const jwtManager = JWTManager.getInstance();
        jwtManager.addToBlacklist(token.token_hash);

        logger.info('Token revoked', { 
          tokenId,
          userId: token.user_id,
          tokenType: token.token_type
        });

        res.json({
          success: true,
          message: 'Token revoked successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to revoke token'
        });
      }
    } catch (error) {
      logger.error('Error revoking token', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to revoke token'
      });
    }
  }

  /**
   * Revoke all tokens for a user
   * POST /admin/api/tokens/user/:userId/revoke-all
   */
  async revokeAllUserTokens(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const revokedCount = await JwtToken.revokeAllUserTokens(userId);
      
      // Add all user tokens to blacklist
      const jwtManager = JWTManager.getInstance();
      const userTokens = await JwtToken.findByUserId(userId);
      for (const token of userTokens) {
        if (token.is_revoked) {
          jwtManager.addToBlacklist(token.token_hash);
        }
      }

      logger.info('All user tokens revoked', { userId, revokedCount });

      res.json({
        success: true,
        message: `Revoked ${revokedCount} tokens for user`,
        data: { revokedCount }
      });
    } catch (error) {
      logger.error('Error revoking all user tokens', { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to revoke user tokens'
      });
    }
  }

  /**
   * Clean up expired tokens
   * POST /admin/api/tokens/cleanup
   */
  async cleanupExpiredTokens(req: Request, res: Response) {
    try {
      const deletedCount = await JwtToken.cleanupExpiredTokens();
      
      logger.info('Expired tokens cleanup completed', { deletedCount });

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} expired tokens`,
        data: { deletedCount }
      });
    } catch (error) {
      logger.error('Error cleaning up expired tokens', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired tokens'
      });
    }
  }

  /**
   * Validate a token
   * POST /admin/api/tokens/validate
   */
  async validateToken(req: Request, res: Response) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token is required'
        });
      }

      // Hash the token for lookup
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Check if token exists and is valid
      const isValid = await JwtToken.isTokenValid(tokenHash);
      
      if (isValid) {
        // Update last used timestamp
        await JwtToken.updateLastUsed(tokenHash);
        
        // Get token info
        const tokenInfo = await JwtToken.findByTokenHash(tokenHash);
        
        res.json({
          success: true,
          data: {
            valid: true,
            tokenInfo: tokenInfo ? {
              id: tokenInfo.id,
              type: tokenInfo.token_type,
              expiresAt: tokenInfo.expires_at,
              lastUsedAt: tokenInfo.last_used_at,
              scopes: tokenInfo.scopes
            } : null
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            valid: false,
            reason: 'Token is expired, revoked, or invalid'
          }
        });
      }
    } catch (error) {
      logger.error('Error validating token', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to validate token'
      });
    }
  }

  /**
   * Get token details by ID
   * GET /admin/api/tokens/:tokenId
   */
  async getTokenById(req: Request, res: Response) {
    try {
      const { tokenId } = req.params;
      
      const tokens = await JwtToken.findAll(1000, 0, { id: tokenId });
      const token = tokens.find(t => t.id === tokenId);
      
      if (!token) {
        return res.status(404).json({
          success: false,
          error: 'Token not found'
        });
      }

      // Sanitize response
      const sanitizedToken = {
        ...token,
        token_hash: `${token.token_hash.substring(0, 8)}...`,
        metadata: token.metadata ? JSON.parse(token.metadata) : null,
        device_info: token.device_info ? JSON.parse(token.device_info) : null
      };

      res.json({
        success: true,
        data: sanitizedToken
      });
    } catch (error) {
      logger.error('Error fetching token details', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch token details'
      });
    }
  }
}