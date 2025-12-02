/**
 * Common API response formatters and utilities
 */
import type { ApiResponse } from '@opensky/types';

/**
 * Format success response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Format error response
 */
export function errorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Format paginated response
 */
export function paginatedResponse<T>(data: T[], page: number, limit: number, total: number): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta: calculatePagination(page, limit, total),
  };
}

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

/**
 * Generate rate limit headers
 */
export function rateLimitHeaders(limit: number, remaining: number, resetAt: Date): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.floor(resetAt.getTime() / 1000).toString(),
  };
}

/**
 * CORS headers
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
} as const;

/**
 * Security headers
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
} as const;

/**
 * Extract pagination params from query string
 */
export function extractPaginationParams(query: Record<string, any>): { page: number; limit: number } {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit };
}

/**
 * Calculate SQL offset from page and limit
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Build query string from params
 */
export function buildQueryString(params: Record<string, any>): string {
  const filtered = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return filtered ? `?${filtered}` : '';
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const cleaned = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  
  if (!cleaned) return params;
  
  cleaned.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
  
  return params;
}
