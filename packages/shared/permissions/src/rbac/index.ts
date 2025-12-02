/**
 * Role-Based Access Control (RBAC)
 * Shared permissions system for all OpenSky Suite products
 */

import type {
  Role,
  UserRole,
  Permission,
  PermissionAction,
} from "@opensky/types";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "@opensky/utils/errors";

/**
 * Repository interface for Role operations
 */
export interface RoleRepository {
  create(data: Omit<Role, "id" | "createdAt" | "updatedAt">): Promise<Role>;
  findById(id: string): Promise<Role | null>;
  findByOrg(orgId: string): Promise<Role[]>;
  findGlobalRoles(): Promise<Role[]>;
  update(id: string, data: Partial<Role>): Promise<Role>;
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for UserRole operations
 */
export interface UserRoleRepository {
  assign(data: Omit<UserRole, "assignedAt">): Promise<UserRole>;
  findByUser(userId: string, orgId?: string): Promise<UserRole[]>;
  revoke(userId: string, roleId: string): Promise<void>;
}

/**
 * Repository interface for Permission operations
 */
export interface PermissionRepository {
  create(
    data: Omit<Permission, "id" | "createdAt" | "updatedAt">,
  ): Promise<Permission>;
  findByResource(resource: string, resourceId: string): Promise<Permission[]>;
  findBySubject(subjectType: string, subjectId: string): Promise<Permission[]>;
  checkPermission(
    resource: string,
    resourceId: string,
    subjectType: string,
    subjectId: string,
    action: PermissionAction,
  ): Promise<boolean>;
  revoke(id: string): Promise<void>;
}

/**
 * RBAC Service
 * Core service for role-based access control across all OpenSky products
 */
export class RbacService {
  constructor(
    private roleRepo: RoleRepository,
    private userRoleRepo: UserRoleRepository,
    private permissionRepo: PermissionRepository,
  ) {}

  // ============= Role Management =============

  /**
   * Create a new role
   */
  async createRole(data: {
    name: string;
    description: string;
    permissions: string[];
    orgId?: string;
  }): Promise<Role> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("Role name is required");
    }

    return this.roleRepo.create({
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      orgId: data.orgId,
    });
  }

  /**
   * Update an existing role
   */
  async updateRole(
    roleId: string,
    data: Partial<Pick<Role, "name" | "description" | "permissions">>,
  ): Promise<Role> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }

    return this.roleRepo.update(roleId, data);
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }

    await this.roleRepo.delete(roleId);
  }

  /**
   * Get a role by ID
   */
  async getRole(roleId: string): Promise<Role> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }
    return role;
  }

  /**
   * List roles (global or org-specific)
   */
  async listRoles(orgId?: string): Promise<Role[]> {
    if (orgId) {
      return this.roleRepo.findByOrg(orgId);
    }
    return this.roleRepo.findGlobalRoles();
  }

  // ============= User Role Assignment =============

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    roleId: string,
    orgId?: string,
  ): Promise<UserRole> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }

    // Verify org match if role is org-specific
    if (role.orgId && role.orgId !== orgId) {
      throw new ValidationError("Role does not belong to this organization");
    }

    return this.userRoleRepo.assign({ userId, roleId, orgId });
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.userRoleRepo.revoke(userId, roleId);
  }

  /**
   * Get all roles assigned to a user
   */
  async getUserRoles(userId: string, orgId?: string): Promise<UserRole[]> {
    return this.userRoleRepo.findByUser(userId, orgId);
  }

  // ============= Permission Checks =============

  /**
   * Check if a user has permission to perform an action on a resource
   */
  async checkPermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<boolean> {
    // Check direct user permission
    const hasDirectPermission = await this.permissionRepo.checkPermission(
      resource,
      resourceId,
      "user",
      userId,
      action,
    );

    if (hasDirectPermission) {
      return true;
    }

    // Check role-based permissions
    const userRoles = await this.userRoleRepo.findByUser(userId);

    for (const userRole of userRoles) {
      const role = await this.roleRepo.findById(userRole.roleId);
      if (!role) continue;

      // Check if role has this permission
      const permissionKey = `${resource}:${action}`;
      if (
        role.permissions.includes(permissionKey) ||
        role.permissions.includes(`${resource}:*`) ||
        role.permissions.includes("*")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Require permission or throw error
   */
  async requirePermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<void> {
    const hasPermission = await this.checkPermission(
      userId,
      resource,
      resourceId,
      action,
    );

    if (!hasPermission) {
      throw new AuthorizationError(
        `Insufficient permissions to ${action} ${resource}:${resourceId}`,
      );
    }
  }

  // ============= Grant/Revoke Permissions =============

  /**
   * Grant permission to a subject (user/team/org)
   */
  async grantPermission(data: {
    resource: string;
    resourceId: string;
    subjectType: "user" | "team" | "organization";
    subjectId: string;
    action: PermissionAction;
  }): Promise<Permission> {
    return this.permissionRepo.create({
      ...data,
      granted: true,
    });
  }

  /**
   * Revoke a permission
   */
  async revokePermission(permissionId: string): Promise<void> {
    await this.permissionRepo.revoke(permissionId);
  }

  /**
   * List all permissions on a resource
   */
  async listResourcePermissions(
    resource: string,
    resourceId: string,
  ): Promise<Permission[]> {
    return this.permissionRepo.findByResource(resource, resourceId);
  }

  /**
   * List all permissions for a subject
   */
  async listSubjectPermissions(
    subjectType: string,
    subjectId: string,
  ): Promise<Permission[]> {
    return this.permissionRepo.findBySubject(subjectType, subjectId);
  }

  // ============= Bulk Operations =============

  /**
   * Check multiple permissions at once
   */
  async checkPermissions(
    userId: string,
    checks: Array<{
      resource: string;
      resourceId: string;
      action: PermissionAction;
    }>,
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const check of checks) {
      const key = `${check.resource}:${check.resourceId}:${check.action}`;
      results[key] = await this.checkPermission(
        userId,
        check.resource,
        check.resourceId,
        check.action,
      );
    }

    return results;
  }

  /**
   * Get all accessible resources of a type for a user
   */
  async getAccessibleResources(
    userId: string,
    resource: string,
    action: PermissionAction,
  ): Promise<string[]> {
    // Get direct permissions
    const directPermissions = await this.permissionRepo.findBySubject(
      "user",
      userId,
    );

    const resourceIds = new Set<string>();

    // Add directly permitted resources
    directPermissions
      .filter((p) => p.resource === resource && p.action === action && p.granted)
      .forEach((p) => resourceIds.add(p.resourceId));

    // Check role-based permissions
    const userRoles = await this.userRoleRepo.findByUser(userId);

    for (const userRole of userRoles) {
      const role = await this.roleRepo.findById(userRole.roleId);
      if (!role) continue;

      // If role has wildcard or matching permission, need to query all resources
      const permissionKey = `${resource}:${action}`;
      if (
        role.permissions.includes(permissionKey) ||
        role.permissions.includes(`${resource}:*`) ||
        role.permissions.includes("*")
      ) {
        // This role grants access to all resources of this type
        // Return indicator that user has broad access
        resourceIds.add("*");
        break;
      }
    }

    return Array.from(resourceIds);
  }
}

/**
 * Helper functions for permission string manipulation
 */
export const PermissionHelpers = {
  /**
   * Create permission string (e.g., "document:read")
   */
  create(resource: string, action: PermissionAction): string {
    return `${resource}:${action}`;
  },

  /**
   * Parse permission string into parts
   */
  parse(permission: string): { resource: string; action: string } | null {
    const parts = permission.split(":");
    if (parts.length !== 2) return null;
    return { resource: parts[0], action: parts[1] };
  },

  /**
   * Check if permission matches pattern (supports wildcards)
   */
  matches(permission: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (permission === pattern) return true;

    const permParts = permission.split(":");
    const patternParts = pattern.split(":");

    if (patternParts.length !== 2) return false;

    return (
      (patternParts[0] === "*" || patternParts[0] === permParts[0]) &&
      (patternParts[1] === "*" || patternParts[1] === permParts[1])
    );
  },
};
