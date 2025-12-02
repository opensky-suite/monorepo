/**
 * Express middleware for permission checking
 * Use in API routes to enforce permissions
 */

import type { Request, Response, NextFunction } from 'express';
import type { PermissionAction } from '@opensky/types';
import { AuthenticationError, AuthorizationError } from '@opensky/utils/errors';

/**
 * Permission checker interface (inject your RBAC service)
 */
export interface PermissionMiddlewareChecker {
  checkPermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<boolean>;
}

/**
 * Request with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

/**
 * Global permission checker (set during app initialization)
 */
let globalChecker: PermissionMiddlewareChecker | null = null;

/**
 * Initialize permission middleware with checker
 */
export function initializePermissionMiddleware(checker: PermissionMiddlewareChecker) {
  globalChecker = checker;
}

/**
 * Resource ID extractor function type
 */
type ResourceIdExtractor = (req: AuthenticatedRequest) => string | Promise<string>;

/**
 * Middleware: Require permission on a resource
 * 
 * @example
 * ```ts
 * // Check permission on document from route param
 * app.get('/documents/:id', requirePermission('document', 'read', (req) => req.params.id), handler);
 * 
 * // Check permission on document from body
 * app.post('/documents', requirePermission('document', 'write', (req) => req.body.documentId), handler);
 * 
 * // Check permission on current user's own resource
 * app.get('/profile', requirePermission('user', 'read', (req) => req.user!.id), handler);
 * ```
 */
export function requirePermission(
  resource: string,
  action: PermissionAction,
  resourceIdExtractor: ResourceIdExtractor | string,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('User not authenticated');
      }

      // Check if middleware is initialized
      if (!globalChecker) {
        throw new Error('Permission middleware not initialized. Call initializePermissionMiddleware() first.');
      }

      // Extract resource ID
      const resourceId = typeof resourceIdExtractor === 'function'
        ? await resourceIdExtractor(req)
        : resourceIdExtractor;

      // Check permission
      const hasPermission = await globalChecker.checkPermission(
        req.user.id,
        resource,
        resourceId,
        action,
      );

      if (!hasPermission) {
        throw new AuthorizationError(
          `Insufficient permissions to ${action} ${resource}:${resourceId}`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Require any of multiple permissions (OR logic)
 */
export function requireAnyPermission(
  checks: Array<{
    resource: string;
    action: PermissionAction;
    resourceId: ResourceIdExtractor | string;
  }>,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('User not authenticated');
      }

      if (!globalChecker) {
        throw new Error('Permission middleware not initialized');
      }

      let hasAnyPermission = false;

      for (const check of checks) {
        const resourceId = typeof check.resourceId === 'function'
          ? await check.resourceId(req)
          : check.resourceId;

        const hasPermission = await globalChecker.checkPermission(
          req.user.id,
          check.resource,
          resourceId,
          check.action,
        );

        if (hasPermission) {
          hasAnyPermission = true;
          break;
        }
      }

      if (!hasAnyPermission) {
        throw new AuthorizationError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Require all of multiple permissions (AND logic)
 */
export function requireAllPermissions(
  checks: Array<{
    resource: string;
    action: PermissionAction;
    resourceId: ResourceIdExtractor | string;
  }>,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('User not authenticated');
      }

      if (!globalChecker) {
        throw new Error('Permission middleware not initialized');
      }

      for (const check of checks) {
        const resourceId = typeof check.resourceId === 'function'
          ? await check.resourceId(req)
          : check.resourceId;

        const hasPermission = await globalChecker.checkPermission(
          req.user.id,
          check.resource,
          resourceId,
          check.action,
        );

        if (!hasPermission) {
          throw new AuthorizationError(
            `Insufficient permissions to ${check.action} ${check.resource}`,
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Check if user owns a resource
 */
export function requireOwnership(
  resourceIdExtractor: ResourceIdExtractor,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('User not authenticated');
      }

      const resourceId = await resourceIdExtractor(req);

      // Check if user ID matches resource ID (for user resources)
      // Or check ownership via permission system
      if (globalChecker) {
        const hasPermission = await globalChecker.checkPermission(
          req.user.id,
          'resource',
          resourceId,
          'admin', // Ownership implies admin permission
        );

        if (!hasPermission && req.user.id !== resourceId) {
          throw new AuthorizationError('You do not own this resource');
        }
      } else {
        // Fallback: simple ID match
        if (req.user.id !== resourceId) {
          throw new AuthorizationError('You do not own this resource');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Attach user permissions to request
 * Useful for conditional UI rendering or bulk permission checks
 */
export function attachPermissions(
  resource: string,
  resourceIdExtractor: ResourceIdExtractor,
  actions: PermissionAction[] = ['read', 'write', 'delete', 'share', 'admin'],
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return next();
      }

      if (!globalChecker) {
        return next();
      }

      const resourceId = await resourceIdExtractor(req);
      const permissions: Record<string, boolean> = {};

      for (const action of actions) {
        permissions[action] = await globalChecker.checkPermission(
          req.user.id,
          resource,
          resourceId,
          action,
        );
      }

      // Attach to request
      (req as any).permissions = permissions;

      next();
    } catch (error) {
      next(error);
    }
  };
}
