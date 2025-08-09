import { Request, Response, NextFunction } from 'express';
import { policyService, EvaluationContext } from '../services/policyService';
import { logger } from '../logger';
import { AppError } from './errorHandler';

// Extend Request interface to include user and evaluation context
export interface PolicyRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    [key: string]: any;
  };
  evaluationContext?: EvaluationContext;
}

/**
 * Policy-based authorization middleware factory.
 * Creates a middleware function that checks if a user has permission to perform a specific action on a resource.
 * @param resource The name of the resource (e.g., 'User', 'Product').
 * @param action The action to be performed (e.g., 'read', 'create', 'update', 'delete').
 * @returns An Express middleware function.
 */
const policyAuth = (resource: string, action: string) => {
  return async (req: PolicyRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Build evaluation context
      const context: EvaluationContext = {
        user: {
          ...req.user
        },
        resource: {
          name: resource,
          id: req.params.id,
          data: req.body
        },
        action,
        environment: {
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        },
        request: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          headers: req.headers
        }
      };

      // Store context for auditing
      req.evaluationContext = context;

      // Evaluate access
      const evaluation = await policyService.evaluateAccess(context);

      if (!evaluation.allowed) {
        logger.warn({
          userId: req.user.id,
          resource,
          action,
          reason: evaluation.reason,
          ip: req.ip
        }, 'Access denied by policy');

        throw new AppError(`Access denied: ${evaluation.reason}`, 403);
      }

      logger.debug({
        userId: req.user.id,
        resource,
        action,
        reason: evaluation.reason
      }, 'Access granted by policy');

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          userId: req.user?.id,
          resource,
          action
        }, 'Policy evaluation error');

        next(new AppError('Authorization failed', 500));
      }
    }
  };
};

/**
 * Middleware to check if the authenticated user has a specific role.
 * This is for legacy compatibility and simpler role checks.
 * @param roles A single role string or an array of role strings that are allowed.
 * @returns An Express middleware function.
 */
export const requireRole = (roles: string | string[]) => {
  return (req: PolicyRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Middleware for dynamic policy authorization based on resource names from URL parameters.
 * @param action The action to be performed on the resource.
 * @returns An Express middleware function.
 */
export const dynamicPolicyAuth = (action: string) => {
  return async (req: PolicyRequest, res: Response, next: NextFunction) => {
    try {
      const resource = req.params.resource || req.params.table;

      if (!resource) {
        throw new AppError('Resource name is required for authorization', 400);
      }

      // Use the policy auth middleware with dynamic resource
      return policyAuth(resource, action)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check multiple permissions simultaneously.
 * Useful for routes that require access to multiple resources or actions.
 * @param permissions An array of objects, each specifying a `resource` and `action` to check.
 * @returns An Express middleware function.
 */
export const checkMultiplePermissions = (permissions: Array<{ resource: string; action: string }>) => {
  return async (req: PolicyRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      for (const permission of permissions) {
        const context: EvaluationContext = {
          user: {
            ...req.user
          },
          resource: {
            name: permission.resource,
            id: req.params.id,
            data: req.body
          },
          action: permission.action,
          environment: {
            timestamp: new Date(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
          },
          request: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body,
            headers: req.headers
          }
        };

        const evaluation = await policyService.evaluateAccess(context);

        if (!evaluation.allowed) {
          throw new AppError(`Access denied for ${permission.resource}:${permission.action} - ${evaluation.reason}`, 403);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Filters a list of data records based on user policies.
 * Only records for which the user has 'read' access will be returned.
 * @param req The Express request object, extended with PolicyRequest properties.
 * @param data An array of data records to filter.
 * @param resource The name of the resource to which the data records belong.
 * @returns A Promise that resolves to a new array containing only the allowed data records.
 */
export const policyFilter = async (req: PolicyRequest, data: any[], resource: string): Promise<any[]> => {
  if (!req.user) {
    return [];
  }

  const filteredData = [];

  for (const item of data) {
    const context: EvaluationContext = {
      user: {
        ...req.user
      },
      resource: {
        name: resource,
        id: item.id,
        data: item
      },
      action: 'read',
      environment: {
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      },
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        headers: req.headers
      }
    };

    try {
      const evaluation = await policyService.evaluateAccess(context);
      if (evaluation.allowed) {
        filteredData.push(item);
      }
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        userId: req.user.id,
        resource,
        itemId: item.id
      }, 'Failed to evaluate policy for item');
      // If evaluation fails, err on the side of caution and exclude item
    }
  }

  return filteredData;
};

/**
 * Field-level policy filtering
 * Filters object fields based on user policies
 */
export const fieldPolicyFilter = async (req: PolicyRequest, data: any): Promise<any> => {
  if (!req.user || !data) {
    return data;
  }

  // For now, return all fields
  // This could be extended to check field-level permissions
  return data;
};

/**
 * Middleware to log policy decisions for auditing
 */
export const policyAudit = (req: PolicyRequest, res: Response, next: NextFunction) => {
  if (req.evaluationContext) {
    logger.info({
      userId: req.user?.id,
      resource: req.evaluationContext.resource.name,
      action: req.evaluationContext.action,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    }, 'Policy decision audit log');
  }

  next();
};