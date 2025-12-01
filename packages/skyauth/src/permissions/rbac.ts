/**
 * Role-Based Access Control (RBAC)
 * Issue #41: Role-based access control (RBAC)
 */

import type {
  Role,
  UserRole,
  Permission,
  PermissionAction,
} from "@opensky/types";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  NotImplementedError,
} from "../errors.js";

export interface RoleRepository {
  create(data: Omit<Role, "id" | "createdAt" | "updatedAt">): Promise<Role>;
  findById(id: string): Promise<Role | null>;
  findByOrg(orgId: string): Promise<Role[]>;
  findGlobalRoles(): Promise<Role[]>;
  update(id: string, data: Partial<Role>): Promise<Role>;
  delete(id: string): Promise<void>;
}

export interface UserRoleRepository {
  assign(data: Omit<UserRole, "assignedAt">): Promise<UserRole>;
  findByUser(userId: string, orgId?: string): Promise<UserRole[]>;
  revoke(userId: string, roleId: string): Promise<void>;
}

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

export class RbacService {
  constructor(
    private roleRepo: RoleRepository,
    private userRoleRepo: UserRoleRepository,
    private permissionRepo: PermissionRepository,
  ) {}

  // Role Management
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

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }

    await this.roleRepo.delete(roleId);
  }

  async getRole(roleId: string): Promise<Role> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }
    return role;
  }

  async listRoles(orgId?: string): Promise<Role[]> {
    if (orgId) {
      return this.roleRepo.findByOrg(orgId);
    }
    return this.roleRepo.findGlobalRoles();
  }

  // User Role Assignment
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

  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.userRoleRepo.revoke(userId, roleId);
  }

  async getUserRoles(userId: string, orgId?: string): Promise<UserRole[]> {
    return this.userRoleRepo.findByUser(userId, orgId);
  }

  // Permission Checks
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
        role.permissions.includes("*")
      ) {
        return true;
      }
    }

    return false;
  }

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
      throw new ForbiddenError(
        `User does not have ${action} permission on ${resource}:${resourceId}`,
      );
    }
  }

  // Grant/Revoke Permissions
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

  async revokePermission(permissionId: string): Promise<void> {
    await this.permissionRepo.revoke(permissionId);
  }

  async listResourcePermissions(
    resource: string,
    resourceId: string,
  ): Promise<Permission[]> {
    return this.permissionRepo.findByResource(resource, resourceId);
  }

  async listSubjectPermissions(
    subjectType: string,
    subjectId: string,
  ): Promise<Permission[]> {
    return this.permissionRepo.findBySubject(subjectType, subjectId);
  }
}
