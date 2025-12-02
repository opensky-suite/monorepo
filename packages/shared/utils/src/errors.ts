/**
 * Shared Error Classes
 *
 * Common error types for all OpenSky products
 */

/**
 * Base error class for OpenSky
 */
export class OpenSkyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends OpenSkyError {
  constructor(message: string, details?: any) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends OpenSkyError {
  constructor(message: string = "Authentication required") {
    super(message, "AUTHENTICATION_ERROR", 401);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends OpenSkyError {
  constructor(message: string = "Insufficient permissions") {
    super(message, "AUTHORIZATION_ERROR", 403);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends OpenSkyError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

/**
 * Conflict error
 */
export class ConflictError extends OpenSkyError {
  constructor(message: string = "Resource already exists") {
    super(message, "CONFLICT", 409);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends OpenSkyError {
  constructor(message: string = "Too many requests") {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends OpenSkyError {
  constructor(message: string = "Service temporarily unavailable") {
    super(message, "SERVICE_UNAVAILABLE", 503);
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown): OpenSkyError {
  if (error instanceof OpenSkyError) {
    return error;
  }

  if (error instanceof Error) {
    return new OpenSkyError(error.message, "INTERNAL_ERROR", 500);
  }

  return new OpenSkyError("An unknown error occurred", "UNKNOWN_ERROR", 500);
}

/**
 * Error logger
 */
export function logError(error: unknown, context?: any): void {
  const err = handleError(error);

  console.error("[ERROR]", {
    name: err.name,
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    details: err.details,
    context,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
}
