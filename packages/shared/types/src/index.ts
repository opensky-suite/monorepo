/**
 * Shared TypeScript types for OpenSky Suite
 */

// User types
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash?: string; // Optional for OAuth-only users
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
}

export interface UserProfile {
  userId: string;
  bio?: string;
  phoneNumber?: string;
  timezone: string;
  locale: string;
  notificationPreferences: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  slack: boolean;
  inApp: boolean;
}

// Organization/Team types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

export enum TeamRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  GUEST = "guest",
}

// Authentication types
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  orgId?: string;
  name: string;
  keyHash: string;
  prefix: string; // First 8 chars for identification
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
}

export interface OAuth2Provider {
  id: string;
  provider: "google" | "github" | "microsoft" | "slack";
  userId: string;
  providerId: string; // User ID from the OAuth provider
  providerEmail: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Permission types
export interface Permission {
  id: string;
  resource: string; // e.g., 'document', 'folder', 'organization'
  resourceId: string;
  subjectType: "user" | "team" | "organization";
  subjectId: string;
  action: PermissionAction;
  granted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum PermissionAction {
  READ = "read",
  WRITE = "write",
  DELETE = "delete",
  SHARE = "share",
  ADMIN = "admin",
}

// Role-based access control
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Array of permission identifiers
  orgId?: string; // Org-specific role or global
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  orgId?: string;
  assignedAt: Date;
}

// Email verification
export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  verifiedAt?: Date;
}

// Password reset
export interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// JWT payload types
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}
