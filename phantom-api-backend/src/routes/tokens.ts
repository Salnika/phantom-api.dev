import { Router } from 'express';
import { tokenController } from '../controllers/tokenController';
import { requireRole } from '../middleware/policyAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * JWT Token management routes
 * All routes require authentication and appropriate permissions
 */

// Apply authentication to all token routes
router.use(authenticateToken);

/**
 * GET /tokens - Get all tokens (admin only)
 * Query params: page, limit, user_id, token_type, is_revoked
 */
router.get('/', 
  requireRole(['admin']),
  asyncHandler(tokenController.getAllTokens.bind(tokenController))
);

/**
 * GET /tokens/stats - Get token statistics (admin only)
 */
router.get('/stats',
  requireRole(['admin']),
  asyncHandler(tokenController.getTokenStats.bind(tokenController))
);

/**
 * POST /tokens/cleanup - Clean up expired tokens (admin only)
 */
router.post('/cleanup',
  requireRole(['admin']),
  asyncHandler(tokenController.cleanupExpiredTokens.bind(tokenController))
);

/**
 * POST /tokens/validate - Validate a token (admin or token owner)
 */
router.post('/validate',
  asyncHandler(tokenController.validateToken.bind(tokenController))
);

/**
 * GET /tokens/user/:userId - Get tokens for a specific user
 * Users can only see their own tokens, admins can see any user's tokens
 */
router.get('/user/:userId',
  asyncHandler(tokenController.getUserTokens.bind(tokenController))
);

/**
 * DELETE /tokens/:tokenId - Revoke a specific token
 * Users can only revoke their own tokens, admins can revoke any token
 */
router.delete('/:tokenId',
  asyncHandler(tokenController.revokeToken.bind(tokenController))
);

/**
 * DELETE /tokens/user/:userId/all - Revoke all tokens for a user
 * Users can only revoke their own tokens, admins can revoke any user's tokens
 */
router.delete('/user/:userId/all',
  asyncHandler(tokenController.revokeAllUserTokens.bind(tokenController))
);

export { router as tokenRoutes };