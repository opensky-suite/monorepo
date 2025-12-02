/**
 * @opensky/utils - Shared utilities for OpenSky Suite
 * 
 * This package provides common utilities used across all OpenSky products:
 * - Validation: Zod schemas and validation helpers
 * - Errors: Custom error classes and error handling
 * - Logging: Pino-based logging utilities
 * - Dates: Date formatting and manipulation
 * - API: Response formatters and API helpers
 * - Crypto: Cryptographic utilities (hashing, tokens, etc.)
 * 
 * @example
 * ```ts
 * import { emailSchema, validateBody } from '@opensky/utils/validation';
 * import { ValidationError, NotFoundError } from '@opensky/utils/errors';
 * import { logger, logError } from '@opensky/utils/logging';
 * import { formatRelativeTime, expiresInDays } from '@opensky/utils/dates';
 * import { successResponse, paginatedResponse } from '@opensky/utils/api';
 * import { generateToken, hashPassword } from '@opensky/utils/crypto';
 * ```
 */

// Re-export all modules
export * from './validation/index.js';
export * from './errors/index.js';
export * from './logging/index.js';
export * from './dates/index.js';
export * from './api/index.js';
export * from './crypto/index.js';
