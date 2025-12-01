/**
 * SkyAuth-specific types
 */

import { z } from "zod";

// Validation schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().length(6).optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// Request/Response types
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetSchema>;
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>;

export interface RegisterResponse {
  userId: string;
  email: string;
  message: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
  };
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string; // Full API key (only shown once!)
  prefix: string;
  scopes: string[];
  expiresAt?: Date;
}

// Auth context
export interface AuthContext {
  userId: string;
  email: string;
  type: "jwt" | "api-key";
  scopes?: string[];
}

// Configuration
export interface AuthConfig {
  jwtSecret: string;
  jwtAccessExpiry: string; // e.g., '15m'
  jwtRefreshExpiry: string; // e.g., '7d'
  passwordSaltRounds: number;
  emailVerificationExpiry: number; // milliseconds
  passwordResetExpiry: number; // milliseconds
}
