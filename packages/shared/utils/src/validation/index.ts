/**
 * Common validation utilities and Zod schemas
 */
import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z.string().email().toLowerCase().trim();

/**
 * Password validation schema
 * Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid();

/**
 * URL validation schema
 */
export const urlSchema = z.string().url();

/**
 * Phone number validation (E.164 format)
 */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format (use E.164: +1234567890)');

/**
 * Slug validation (lowercase alphanumeric with hyphens)
 */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
  .min(1)
  .max(100);

/**
 * ISO 8601 date string validation
 */
export const isoDateSchema = z.string().datetime();

/**
 * Pagination query params
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Sort order validation
 */
export const sortOrderSchema = z.enum(['asc', 'desc']);

/**
 * API key validation (32-character hex string)
 */
export const apiKeySchema = z.string().regex(/^[a-f0-9]{32}$/, 'Invalid API key format');

/**
 * Organization/Team name validation
 */
export const nameSchema = z.string().trim().min(1).max(255);

/**
 * Sanitize HTML input (strip all HTML tags)
 */
export function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize SQL input (escape single quotes)
 */
export function sanitizeSql(input: string): string {
  return input.replace(/'/g, "''");
}

/**
 * Validate and parse pagination params
 */
export function parsePagination(params: unknown): PaginationParams {
  return paginationSchema.parse(params);
}

/**
 * Validate request body against schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validate request query params against schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validate request params against schema
 */
export function validateParams<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe parse with error formatting
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`),
  };
}
