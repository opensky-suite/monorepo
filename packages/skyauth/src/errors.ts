/**
 * SkyAuth Error Classes
 * Following "fail fast, fail hard" philosophy - clear, immediate errors
 */

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class ValidationError extends AuthError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message: string = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AuthError {
  constructor(message: string = "Forbidden") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AuthError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AuthError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AuthError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      "RATE_LIMIT_EXCEEDED",
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      429,
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class NotImplementedError extends AuthError {
  constructor(feature: string) {
    super("NOT_IMPLEMENTED", `${feature} is not yet implemented`, 501);
    this.name = "NotImplementedError";
  }
}
