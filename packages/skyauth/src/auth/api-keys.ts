/**
 * API Key Authentication for LLM Integration
 * Issue #28: Implement API key authentication for LLM integration
 */

import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import type { ApiKey } from "@opensky/types";
import type {
  ApiKeyCreate,
  ApiKeyCreateResponse,
  AuthContext,
  AuthConfig,
} from "../types.js";
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from "../errors.js";
import { apiKeyCreateSchema } from "../types.js";

export interface ApiKeyRepository {
  create(data: Omit<ApiKey, "id" | "createdAt">): Promise<ApiKey>;
  findByPrefix(prefix: string): Promise<ApiKey | null>;
  findByUserId(userId: string): Promise<ApiKey[]>;
  updateLastUsed(id: string): Promise<void>;
  revoke(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class ApiKeyService {
  constructor(
    private config: AuthConfig,
    private apiKeyRepo: ApiKeyRepository,
  ) {}

  async createApiKey(
    userId: string,
    data: ApiKeyCreate,
    orgId?: string,
  ): Promise<ApiKeyCreateResponse> {
    // Validate input
    const validated = apiKeyCreateSchema.safeParse(data);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0].message);
    }

    const { name, scopes, expiresInDays } = validated.data;

    // Generate API key: sky_<random 32 chars>
    const keySecret = nanoid(32);
    const fullKey = `sky_${keySecret}`;
    const prefix = fullKey.substring(0, 12); // sky_xxxxxxxx

    // Hash the key for storage
    const keyHash = await bcrypt.hash(fullKey, this.config.passwordSaltRounds);

    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create API key
    const apiKey = await this.apiKeyRepo.create({
      userId,
      orgId,
      name,
      keyHash,
      prefix,
      scopes,
      expiresAt,
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey, // Only returned once!
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    };
  }

  async verifyApiKey(key: string): Promise<AuthContext> {
    if (!key.startsWith("sky_")) {
      throw new UnauthorizedError("Invalid API key format");
    }

    const prefix = key.substring(0, 12);

    // Find API key by prefix
    const apiKey = await this.apiKeyRepo.findByPrefix(prefix);
    if (!apiKey) {
      throw new UnauthorizedError("Invalid API key");
    }

    // Check if revoked
    if (apiKey.revokedAt) {
      throw new UnauthorizedError("API key has been revoked");
    }

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedError("API key has expired");
    }

    // Verify key hash
    const keyValid = await bcrypt.compare(key, apiKey.keyHash);
    if (!keyValid) {
      throw new UnauthorizedError("Invalid API key");
    }

    // Update last used timestamp
    await this.apiKeyRepo.updateLastUsed(apiKey.id);

    return {
      userId: apiKey.userId,
      email: "", // API keys don't have email context
      type: "api-key",
      scopes: apiKey.scopes,
    };
  }

  async listApiKeys(userId: string): Promise<Array<Omit<ApiKey, "keyHash">>> {
    const keys = await this.apiKeyRepo.findByUserId(userId);

    // Remove sensitive key hash from response
    return keys.map(({ keyHash, ...key }) => key);
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const keys = await this.apiKeyRepo.findByUserId(userId);
    const key = keys.find((k) => k.id === keyId);

    if (!key) {
      throw new NotFoundError("API key");
    }

    await this.apiKeyRepo.revoke(keyId);
  }

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    const keys = await this.apiKeyRepo.findByUserId(userId);
    const key = keys.find((k) => k.id === keyId);

    if (!key) {
      throw new NotFoundError("API key");
    }

    await this.apiKeyRepo.delete(keyId);
  }
}
