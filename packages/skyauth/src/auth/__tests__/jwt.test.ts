/**
 * Tests for JWT Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JwtService } from "../jwt.js";
import type { AuthConfig } from "../../types.js";
import { UnauthorizedError } from "../../errors.js";

const mockConfig: AuthConfig = {
  jwtSecret: "test-secret-key-for-jwt",
  jwtAccessExpiry: "15m",
  jwtRefreshExpiry: "7d",
  passwordSaltRounds: 10,
  emailVerificationExpiry: 24 * 60 * 60 * 1000,
  passwordResetExpiry: 60 * 60 * 1000,
};

describe("JwtService", () => {
  let service: JwtService;

  beforeEach(() => {
    service = new JwtService(mockConfig);
  });

  describe("generateAccessToken", () => {
    it("should generate a valid access token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateAccessToken(userId, email);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT format
    });

    it("should generate tokens with correct payload", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateAccessToken(userId, email);
      const decoded = service.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(userId);
      expect(decoded?.email).toBe(email);
      expect(decoded?.type).toBe("access");
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateRefreshToken(userId, email);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });

    it("should generate refresh tokens with correct type", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateRefreshToken(userId, email);
      const decoded = service.decodeToken(token);

      expect(decoded?.type).toBe("refresh");
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify valid access token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateAccessToken(userId, email);
      const context = service.verifyAccessToken(token);

      expect(context.userId).toBe(userId);
      expect(context.email).toBe(email);
      expect(context.type).toBe("jwt");
    });

    it("should throw UnauthorizedError for invalid token", () => {
      expect(() => service.verifyAccessToken("invalid.token.here")).toThrow(
        UnauthorizedError,
      );
    });

    it("should throw UnauthorizedError for refresh token used as access token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const refreshToken = service.generateRefreshToken(userId, email);

      expect(() => service.verifyAccessToken(refreshToken)).toThrow(
        UnauthorizedError,
      );
      expect(() => service.verifyAccessToken(refreshToken)).toThrow(
        "Invalid token type",
      );
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify valid refresh token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateRefreshToken(userId, email);
      const context = service.verifyRefreshToken(token);

      expect(context.userId).toBe(userId);
      expect(context.email).toBe(email);
    });

    it("should throw UnauthorizedError for access token used as refresh token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const accessToken = service.generateAccessToken(userId, email);

      expect(() => service.verifyRefreshToken(accessToken)).toThrow(
        UnauthorizedError,
      );
    });
  });

  describe("decodeToken", () => {
    it("should decode token without verification", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateAccessToken(userId, email);
      const decoded = service.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(userId);
      expect(decoded?.email).toBe(email);
    });

    it("should return null for invalid token", () => {
      const decoded = service.decodeToken("invalid-token");
      expect(decoded).toBeNull();
    });
  });

  describe("getTokenExpiry", () => {
    it("should return expiry date for valid token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = service.generateAccessToken(userId, email);
      const expiry = service.getTokenExpiry(token);

      expect(expiry).toBeInstanceOf(Date);
      expect(expiry!.getTime()).toBeGreaterThan(Date.now());
    });

    it("should return null for invalid token", () => {
      const expiry = service.getTokenExpiry("invalid-token");
      expect(expiry).toBeNull();
    });
  });
});
