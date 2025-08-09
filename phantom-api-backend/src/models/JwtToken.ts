import { tableManager } from '../database';
import { logger } from '../logger';

/**
 * JWT Token model for managing token lifecycle and revocation
 */
export interface JwtTokenData {
  id?: string;
  token_hash: string;          // SHA-256 hash of the JWT token
  user_id?: string;           // User ID (optional for API tokens)
  token_type: 'access' | 'refresh' | 'api' | 'reset_password';
  is_revoked: boolean;        // Whether the token has been revoked
  expires_at: string;         // ISO datetime when token expires
  issued_at: string;          // ISO datetime when token was issued
  revoked_at?: string;        // ISO datetime when token was revoked
  last_used_at?: string;      // ISO datetime when token was last used
  device_info?: string;       // Device/browser info (JSON string)
  ip_address?: string;        // IP address where token was issued
  user_agent?: string;        // User agent string
  scopes?: string;            // Comma-separated list of scopes/permissions
  metadata?: string;          // Additional metadata (JSON string)
  created_at?: string;
  updated_at?: string;
}

/**
 * JWT Token schema definition for dynamic table creation
 */
export const JWT_TOKEN_SCHEMA = {
  fields: {
    token_hash: { 
      type: 'string',
      required: true,
      unique: true,
      description: 'SHA-256 hash of the JWT token for security'
    },
    user_id: { 
      type: 'string',
      required: false,
      description: 'User ID associated with the token (null for API tokens)'
    },
    token_type: { 
      type: 'string',
      required: true,
      enum: ['access', 'refresh', 'api', 'reset_password'],
      description: 'Type of JWT token'
    },
    is_revoked: { 
      type: 'boolean',
      required: true,
      default: false,
      description: 'Whether the token has been revoked'
    },
    expires_at: { 
      type: 'datetime',
      required: true,
      description: 'When the token expires'
    },
    issued_at: { 
      type: 'datetime',
      required: true,
      description: 'When the token was issued'
    },
    revoked_at: { 
      type: 'datetime',
      required: false,
      description: 'When the token was revoked'
    },
    last_used_at: { 
      type: 'datetime',
      required: false,
      description: 'When the token was last used'
    },
    device_info: { 
      type: 'json',
      required: false,
      description: 'Device/browser information'
    },
    ip_address: { 
      type: 'string',
      required: false,
      description: 'IP address where token was issued'
    },
    user_agent: { 
      type: 'text',
      required: false,
      description: 'User agent string'
    },
    scopes: { 
      type: 'text',
      required: false,
      description: 'Comma-separated list of scopes/permissions'
    },
    metadata: { 
      type: 'json',
      required: false,
      description: 'Additional metadata'
    }
  }
};

/**
 * JwtToken model class for managing JWT tokens in the database
 */
export class JwtToken {
  private static TABLE_NAME = 'jwt_tokens';
  private static initialized = false;

  /**
   * Initialize the JWT tokens table
   */
  static async initialize() {
    if (!this.initialized) {
      try {
        await tableManager.createTableFromSchema(this.TABLE_NAME, JWT_TOKEN_SCHEMA);
        
        // Add cleanup hook for expired tokens
        tableManager.onBeforeCreate(this.TABLE_NAME, async (_data) => {
          // Auto-cleanup expired tokens when creating new ones
          await this.cleanupExpiredTokens();
        });

        this.initialized = true;
        logger.info('JWT Token model initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize JWT Token model', { error });
        throw error;
      }
    }
  }

  /**
   * Create a new JWT token record
   */
  static async create(tokenData: Omit<JwtTokenData, 'id' | 'created_at' | 'updated_at'>): Promise<JwtTokenData> {
    await this.initialize();
    
    const data = {
      ...tokenData,
      issued_at: tokenData.issued_at || new Date().toISOString(),
      is_revoked: tokenData.is_revoked || false
    };

    return await tableManager.create(this.TABLE_NAME, data);
  }

  /**
   * Find a token by its hash
   */
  static async findByTokenHash(tokenHash: string): Promise<JwtTokenData | null> {
    await this.initialize();
    
    const tokens = await tableManager.findAll(this.TABLE_NAME, 1, 0, [], undefined, undefined, {
      token_hash: tokenHash
    });
    
    return tokens.length > 0 ? tokens[0] : null;
  }

  /**
   * Find all tokens for a specific user
   */
  static async findByUserId(userId: string, limit = 50, offset = 0): Promise<JwtTokenData[]> {
    await this.initialize();
    
    return await tableManager.findAll(this.TABLE_NAME, limit, offset, [], 'issued_at DESC', undefined, {
      user_id: userId
    });
  }

  /**
   * Find all active (non-revoked and non-expired) tokens for a user
   */
  static async findActiveTokensByUserId(userId: string): Promise<JwtTokenData[]> {
    await this.initialize();
    
    const now = new Date().toISOString();
    
    return await tableManager.findAll(this.TABLE_NAME, 100, 0, [], 'issued_at DESC', undefined, {
      user_id: userId,
      is_revoked: false
    }).then(tokens => 
      tokens.filter(token => token.expires_at > now)
    );
  }

  /**
   * Get all tokens with pagination and filtering
   */
  static async findAll(
    limit = 50, 
    offset = 0, 
    filters: Partial<JwtTokenData> = {}
  ): Promise<JwtTokenData[]> {
    await this.initialize();
    
    return await tableManager.findAll(this.TABLE_NAME, limit, offset, [], 'issued_at DESC', undefined, filters);
  }

  /**
   * Revoke a token by its hash
   */
  static async revokeToken(tokenHash: string): Promise<boolean> {
    await this.initialize();
    
    const token = await this.findByTokenHash(tokenHash);
    if (!token) {
      return false;
    }

    if (token.is_revoked) {
      return true; // Already revoked
    }

    await tableManager.update(this.TABLE_NAME, token.id!, {
      is_revoked: true,
      revoked_at: new Date().toISOString()
    });

    logger.info(`Token revoked: ${tokenHash.substring(0, 8)}...`, { 
      tokenId: token.id,
      userId: token.user_id,
      tokenType: token.token_type
    });

    return true;
  }

  /**
   * Revoke all tokens for a specific user
   */
  static async revokeAllUserTokens(userId: string): Promise<number> {
    await this.initialize();
    
    const activeTokens = await this.findActiveTokensByUserId(userId);
    let revokedCount = 0;

    for (const token of activeTokens) {
      if (!token.is_revoked) {
        await tableManager.update(this.TABLE_NAME, token.id!, {
          is_revoked: true,
          revoked_at: new Date().toISOString()
        });
        revokedCount++;
      }
    }

    logger.info(`Revoked ${revokedCount} tokens for user: ${userId}`);
    return revokedCount;
  }

  /**
   * Update the last used timestamp for a token
   */
  static async updateLastUsed(tokenHash: string): Promise<void> {
    await this.initialize();
    
    const token = await this.findByTokenHash(tokenHash);
    if (token && !token.is_revoked) {
      await tableManager.update(this.TABLE_NAME, token.id!, {
        last_used_at: new Date().toISOString()
      });
    }
  }

  /**
   * Check if a token is valid (exists, not revoked, not expired)
   */
  static async isTokenValid(tokenHash: string): Promise<boolean> {
    await this.initialize();
    
    const token = await this.findByTokenHash(tokenHash);
    if (!token) {
      return false;
    }

    if (token.is_revoked) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    
    if (expiresAt <= now) {
      return false;
    }

    return true;
  }

  /**
   * Clean up expired tokens from the database
   */
  static async cleanupExpiredTokens(): Promise<number> {
    await this.initialize();
    
    const now = new Date().toISOString();
    const expiredTokens = await tableManager.findAll(this.TABLE_NAME, 1000, 0, [], undefined, undefined, {});
    
    let deletedCount = 0;
    for (const token of expiredTokens) {
      if (token.expires_at <= now) {
        await tableManager.delete(this.TABLE_NAME, token.id!);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired tokens`);
    }

    return deletedCount;
  }

  /**
   * Get token statistics
   */
  static async getTokenStats(): Promise<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
    byType: Record<string, number>;
  }> {
    await this.initialize();
    
    const allTokens = await this.findAll(1000, 0);
    const now = new Date().toISOString();

    const stats = {
      total: allTokens.length,
      active: 0,
      revoked: 0,
      expired: 0,
      byType: {} as Record<string, number>
    };

    for (const token of allTokens) {
      // Count by type
      stats.byType[token.token_type] = (stats.byType[token.token_type] || 0) + 1;

      // Count by status
      if (token.is_revoked) {
        stats.revoked++;
      } else if (token.expires_at <= now) {
        stats.expired++;
      } else {
        stats.active++;
      }
    }

    return stats;
  }
}