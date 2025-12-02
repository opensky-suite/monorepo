/**
 * Common error classes and error handling utilities
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details?: Record<string, unknown>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super(message, 500, 'INTERNAL_ERROR', details, false);
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details?: Record<string, unknown>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 500, 'DATABASE_ERROR', details, false);
  }
}

/**
 * External API error
 */
export class ExternalApiError extends AppError {
  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_API_ERROR', details);
  }
}

/**
 * Check if error is operational (expected) or programmer error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: Error): Record<string, unknown> {
  const formatted: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (error instanceof AppError) {
    formatted.statusCode = error.statusCode;
    formatted.code = error.code;
    formatted.details = error.details;
    formatted.isOperational = error.isOperational;
  }

  return formatted;
}

/**
 * Format error for API response (hide sensitive details)
 */
export function formatErrorForResponse(error: Error): Record<string, unknown> {
  if (error instanceof AppError) {
    return error.toJSON();
  }

  // Don't expose internal error details to clients
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
}

/**
 * Wrap async function with error handling
 */
export function catchAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return ((...args: Parameters<T>) => {
    return Promise.resolve(fn(...args)).catch((error) => {
      throw error;
    });
  }) as T;
}
