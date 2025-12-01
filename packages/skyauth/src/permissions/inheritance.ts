/**
 * Permission Inheritance System
 * Issue #40: Permission inheritance system
 *
 * Implements hierarchical permission inheritance:
 * - Organization → Team → User
 * - Folder → Subfolder → Document
 * - Parent resource permissions inherited by children
 */

import type { PermissionAction } from "@opensky/types";
import { NotImplementedError } from "../errors.js";

export interface ResourceHierarchy {
  resource: string;
  resourceId: string;
  parentResource?: string;
  parentResourceId?: string;
}

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

export class PermissionInheritanceService {
  async getInheritedPermissions(
    userId: string,
    resource: string,
    resourceId: string,
  ): Promise<InheritedPermission[]> {
    throw new NotImplementedError(
      "Permission inheritance - getInheritedPermissions",
    );
  }

  async checkInheritedPermission(
    userId: string,
    resource: string,
    resourceId: string,
    action: PermissionAction,
  ): Promise<boolean> {
    throw new NotImplementedError(
      "Permission inheritance - checkInheritedPermission",
    );
  }

  async getResourceHierarchy(
    resource: string,
    resourceId: string,
  ): Promise<ResourceHierarchy[]> {
    throw new NotImplementedError(
      "Permission inheritance - getResourceHierarchy",
    );
  }

  async propagatePermissions(
    resource: string,
    resourceId: string,
    subjectType: "user" | "team" | "organization",
    subjectId: string,
    action: PermissionAction,
  ): Promise<void> {
    throw new NotImplementedError(
      "Permission inheritance - propagatePermissions",
    );
  }
}
