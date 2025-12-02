/**
 * API Key Authentication Middleware
 * For LLM and programmatic access
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    userId: string;
    name: string;
    scopes: string[];
  };
}

// In production, this would query the database
// For now, using environment variable
const VALID_API_KEYS = process.env.API_KEYS?.split(',') || [];

export async function apiKeyMiddleware(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get API key from header
    const apiKey =
      req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required',
        hint: 'Provide API key in X-API-Key header or Authorization: Bearer <key>',
      });
      return;
    }

    // Validate API key
    // In production: query database with hashed key
    const isValid = VALID_API_KEYS.includes(apiKey as string);

    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    // Attach API key info to request
    // In production: load from database
    req.apiKey = {
      id: 'api-key-id',
      userId: 'user-id',
      name: 'LLM Integration Key',
      scopes: ['read', 'write'],
    };

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'API key validation failed',
    });
  }
}

/**
 * Require specific scopes
 */
export function requireScope(...scopes: string[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required',
      });
      return;
    }

    const hasScope = scopes.some((scope) => req.apiKey!.scopes.includes(scope));

    if (!hasScope) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient scopes',
        required: scopes,
        provided: req.apiKey.scopes,
      });
      return;
    }

    next();
  };
}
