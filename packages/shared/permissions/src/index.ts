/**
 * @opensky/permissions - Unified permissions system for OpenSky Suite
 * 
 * This package provides a comprehensive permissions system used across all OpenSky products:
 * - RBAC: Role-based access control
 * - Inheritance: Hierarchical permission inheritance
 * - Middleware: Express middleware for permission checking
 * 
 * @example
 * ```ts
 * import { RbacService, PermissionInheritanceService } from '@opensky/permissions';
 * import { requirePermission } from '@opensky/permissions/middleware';
 * 
 * // Check permissions
 * const hasAccess = await rbac.checkPermission(userId, 'document', docId, 'read');
 * 
 * // Use middleware
 * app.get('/documents/:id', requirePermission('document', 'read'), handler);
 * ```
 */

// Re-export all modules
export * from './rbac/index.js';
export * from './inheritance/index.js';
