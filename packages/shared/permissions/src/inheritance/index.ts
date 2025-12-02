/**
 * Permission Inheritance System
 * 
 * Implements hierarchical permission inheritance for OpenSky Suite:
 * - Organization → Team → User
 * - Folder → Subfolder → File/Document
 * - Parent resource permissions inherited by children
 * 
 * Examples:
 * - If user has "read" on folder, they inherit "read" on all files in folder
 * - If team has "edit" on org, all team members inherit "edit" on org resources
 * - If folder is shared with "view", all subfolders/files inherit "view"
 */

import type { PermissionAction } from "@opensky/types";

/**
 * Resource hierarchy entry
 */
export interface ResourceHierarchy {
  resource: string;
  resourceId: string;
  parentResource?: string;
  parentResourceId?: string;
}

/**
 * Inherited permission with source tracking
 */
export interface InheritedPermission {
  resource: string;
  resourceId: string;
  action: PermissionAction;
  inherited: boolean;
  inheritedFrom?: {
    resource: string;
    resourceId: string;
  };
}

/**
 * Repository interface for hierarchy operations
 */
export interface HierarchyRepository {
  /**
   * Get parent of a resource
   */
  getParent(resource: string, resourceId: string): Promise<ResourceHierarchy | null>;

  /**
   * Get all ancestors of a resource (bottom-up)
   */
  getAncestors(resource: string, resourceId: string): Promise<ResourceHierarchy[]>;

  /**
   * Get all descendants of a resource (top-down)
   */
  getDescendants(resource: string, resourceId: string): Promise<ResourceHierarchy[]>;

  /**
   * Check if resourceA is ancestor of resourceB
   */
  isAncestor(
    ancestorResource: string,
    ancestorId: string,
    descendantResource: string,
    descendantId: string,
  ): Promise<boolean>;
}

/**
 * Permission checker interface (used to check base permissions)
 */
export interface PermissionChecker {
  checkPermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<boolean>;
}

/**
 * Permission Inheritance Service
 */
export class PermissionInheritanceService {
  constructor(
    private hierarchyRepo: HierarchyRepository,
    private permissionChecker: PermissionChecker,
  ) {}

  /**
   * Get all inherited permissions for a user on a resource
   * Includes both direct and inherited permissions
   */
  async getInheritedPermissions(
    userId: string,
    resource: string,
    resourceId: string,
  ): Promise<InheritedPermission[]> {
    const permissions: InheritedPermission[] = [];
    const actions: PermissionAction[] = ["read", "write", "delete", "share", "admin"];

    // Check direct permissions
    for (const action of actions) {
      const hasDirect = await this.permissionChecker.checkPermission(
        userId,
        resource,
        resourceId,
        action,
      );

      if (hasDirect) {
        permissions.push({
          resource,
          resourceId,
          action,
          inherited: false,
        });
      }
    }

    // Check inherited permissions from ancestors
    const ancestors = await this.hierarchyRepo.getAncestors(resource, resourceId);

    for (const ancestor of ancestors) {
      for (const action of actions) {
        // Skip if we already have this permission (direct or from closer ancestor)
        if (permissions.some((p) => p.action === action)) {
          continue;
        }

        const hasInherited = await this.permissionChecker.checkPermission(
          userId,
          ancestor.resource,
          ancestor.resourceId,
          action,
        );

        if (hasInherited) {
          permissions.push({
            resource,
            resourceId,
            action,
            inherited: true,
            inheritedFrom: {
              resource: ancestor.resource,
              resourceId: ancestor.resourceId,
            },
          });
        }
      }
    }

    return permissions;
  }

  /**
   * Check if user has permission (including inherited)
   */
  async checkInheritedPermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<boolean> {
    // Check direct permission first (faster)
    const hasDirect = await this.permissionChecker.checkPermission(
      userId,
      resource,
      resourceId,
      action,
    );

    if (hasDirect) {
      return true;
    }

    // Check inherited from ancestors
    const ancestors = await this.hierarchyRepo.getAncestors(resource, resourceId);

    for (const ancestor of ancestors) {
      const hasInherited = await this.permissionChecker.checkPermission(
        userId,
        ancestor.resource,
        ancestor.resourceId,
        action,
      );

      if (hasInherited) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get resource hierarchy (all ancestors)
   */
  async getResourceHierarchy(
    resource: string,
    resourceId: string,
  ): Promise<ResourceHierarchy[]> {
    const hierarchy: ResourceHierarchy[] = [];

    // Add current resource
    hierarchy.push({ resource, resourceId });

    // Add ancestors
    const ancestors = await this.hierarchyRepo.getAncestors(resource, resourceId);
    hierarchy.push(...ancestors);

    return hierarchy;
  }

  /**
   * Propagate permissions to all descendants
   * Used when granting permission on a parent resource
   */
  async propagatePermissions(
    resource: string,
    resourceId: string,
    subjectType: "user" | "team" | "organization",
    subjectId: string,
    action: PermissionAction,
  ): Promise<void> {
    // Get all descendants
    const descendants = await this.hierarchyRepo.getDescendants(resource, resourceId);

    // Note: We don't actually create permission records for descendants
    // Instead, we rely on the inheritance check to traverse up the hierarchy
    // This is more efficient and avoids permission duplication

    // If you want to denormalize for performance, uncomment:
    /*
    for (const descendant of descendants) {
      await this.permissionRepo.create({
        resource: descendant.resource,
        resourceId: descendant.resourceId,
        subjectType,
        subjectId,
        action,
        granted: true,
        inherited: true,
      });
    }
    */
  }

  /**
   * Check if user has access to any resources in a hierarchy
   */
  async hasAccessToHierarchy(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<boolean> {
    // Check current resource
    const hasCurrent = await this.checkInheritedPermission(
      userId,
      resource,
      resourceId,
      action,
    );

    if (hasCurrent) {
      return true;
    }

    // Check any descendants
    const descendants = await this.hierarchyRepo.getDescendants(resource, resourceId);

    for (const descendant of descendants) {
      const hasDescendant = await this.checkInheritedPermission(
        userId,
        descendant.resource,
        descendant.resourceId,
        action,
      );

      if (hasDescendant) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find effective permission (closest in hierarchy)
   * Returns the permission source (direct or inherited from which ancestor)
   */
  async findEffectivePermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<{
    hasPermission: boolean;
    source?: { resource: string; resourceId: string; inherited: boolean };
  }> {
    // Check direct permission
    const hasDirect = await this.permissionChecker.checkPermission(
      userId,
      resource,
      resourceId,
      action,
    );

    if (hasDirect) {
      return {
        hasPermission: true,
        source: { resource, resourceId, inherited: false },
      };
    }

    // Check ancestors (closest first)
    const ancestors = await this.hierarchyRepo.getAncestors(resource, resourceId);

    for (const ancestor of ancestors) {
      const hasInherited = await this.permissionChecker.checkPermission(
        userId,
        ancestor.resource,
        ancestor.resourceId,
        action,
      );

      if (hasInherited) {
        return {
          hasPermission: true,
          source: {
            resource: ancestor.resource,
            resourceId: ancestor.resourceId,
            inherited: true,
          },
        };
      }
    }

    return { hasPermission: false };
  }
}

/**
 * Common hierarchy types for OpenSky Suite
 */
export const HierarchyTypes = {
  /**
   * Organization hierarchy: Organization → Team → User
   */
  ORGANIZATION: {
    organization: null, // Root
    team: "organization",
    user: "team",
  },

  /**
   * File hierarchy: Folder → Subfolder → File
   */
  FILE_SYSTEM: {
    drive: null, // Root
    folder: "drive",
    subfolder: "folder",
    file: "folder",
  },

  /**
   * Document hierarchy: Workspace → Collection → Document
   */
  DOCUMENT: {
    workspace: null, // Root
    collection: "workspace",
    document: "collection",
  },
} as const;
