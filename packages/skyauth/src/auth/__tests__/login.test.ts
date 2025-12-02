/**
 * LoginService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcrypt";
import { LoginService, type UserRepository } from "../login.js";
import type { AuthConfig } from "../../types.js";
import { UnauthorizedError, ValidationError } from "../../errors.js";
import type { User } from "@opensky/types";

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

// Mock JwtService
vi.mock("../jwt.js", () => {
  return {
    JwtService: class MockJwtService {
      generateAccessToken = vi.fn().mockReturnValue("mock-access-token");
      generateRefreshToken = vi.fn().mockReturnValue("mock-refresh-token");
      verifyRefreshToken = vi.fn().mockReturnValue({
        userId: "user-123",
        email: "test@example.com",
      });
    },
  };
});

describe("LoginService", () => {
  let loginService: LoginService;
  let mockUserRepo: UserRepository;
  let mockConfig: AuthConfig;

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: "user-123",
    email: "test@example.com",
    emailVerified: true,
    passwordHash: "$2b$10$mockhashedpassword",
    firstName: "John",
    lastName: "Doe",
    displayName: "John Doe",
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockConfig = {
      jwtSecret: "test-secret",
      jwtAccessExpiry: "15m",
      jwtRefreshExpiry: "7d",
      passwordSaltRounds: 10,
      emailVerificationExpiry: 3600000,
      passwordResetExpiry: 3600000,
    };

    mockUserRepo = {
      findByEmail: vi.fn(),
      updateLastLogin: vi.fn(),
    };

    loginService = new LoginService(mockConfig, mockUserRepo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await loginService.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresIn: 900, // 15 minutes
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
        },
      });

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        user.passwordHash,
      );
      expect(mockUserRepo.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it("should throw validation error for invalid email", async () => {
      await expect(
        loginService.login({
          email: "invalid-email",
          password: "password123",
        }),
      ).rejects.toThrow("Invalid email");
    });

    it("should throw validation error for missing password", async () => {
      await expect(
        loginService.login({
          email: "test@example.com",
          password: "",
        } as any),
      ).rejects.toThrow();
    });

    it("should throw unauthorized error for non-existent user", async () => {
      (mockUserRepo.findByEmail as any).mockResolvedValue(null);

      await expect(
        loginService.login({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      ).rejects.toThrow("Invalid email or password");
    });

    it("should throw unauthorized error for user without password hash", async () => {
      const user = createMockUser({ passwordHash: undefined });
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);

      await expect(
        loginService.login({
          email: "test@example.com",
          password: "password123",
        }),
      ).rejects.toThrow("Invalid email or password");
    });

    it("should throw unauthorized error for unverified email", async () => {
      const user = createMockUser({ emailVerified: false });
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);

      await expect(
        loginService.login({
          email: "test@example.com",
          password: "password123",
        }),
      ).rejects.toThrow("Email not verified");
    });

    it("should throw unauthorized error for invalid password", async () => {
      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        loginService.login({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      ).rejects.toThrow("Invalid email or password");
    });

    it("should require 2FA code when 2FA is enabled", async () => {
      const user = createMockUser({ twoFactorEnabled: true });
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(
        loginService.login({
          email: "test@example.com",
          password: "password123",
        }),
      ).rejects.toThrow("Two-factor authentication code required");
    });

    it("should throw not implemented error for 2FA code validation", async () => {
      const user = createMockUser({ twoFactorEnabled: true });
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(
        loginService.login({
          email: "test@example.com",
          password: "password123",
          twoFactorCode: "123456",
        }),
      ).rejects.toThrow("not yet fully implemented");
    });

    it("should update last login timestamp", async () => {
      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      await loginService.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(mockUserRepo.updateLastLogin).toHaveBeenCalledWith(user.id);
    });
  });

  describe("refreshToken", () => {
    it("should generate new access token from refresh token", async () => {
      const result = await loginService.refreshToken("mock-refresh-token");

      expect(result).toEqual({
        accessToken: "mock-access-token",
        expiresIn: 900, // 15 minutes
      });
    });

    it("should throw error for invalid refresh token", async () => {
      const mockJwtService = (loginService as any).jwtService;
      mockJwtService.verifyRefreshToken.mockImplementation(() => {
        throw new UnauthorizedError("Invalid refresh token");
      });

      await expect(loginService.refreshToken("invalid-token")).rejects.toThrow(
        "Invalid refresh token",
      );
    });
  });

  describe("logout", () => {
    it("should logout user", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await loginService.logout("user-123");

      expect(consoleLogSpy).toHaveBeenCalledWith("User user-123 logged out");

      consoleLogSpy.mockRestore();
    });
  });

  describe("parseExpiryToSeconds", () => {
    it("should parse seconds correctly", async () => {
      const service = new LoginService(
        { ...mockConfig, jwtAccessExpiry: "30s" },
        mockUserRepo,
      );

      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.expiresIn).toBe(30);
    });

    it("should parse minutes correctly", async () => {
      const service = new LoginService(
        { ...mockConfig, jwtAccessExpiry: "30m" },
        mockUserRepo,
      );

      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.expiresIn).toBe(1800); // 30 * 60
    });

    it("should parse hours correctly", async () => {
      const service = new LoginService(
        { ...mockConfig, jwtAccessExpiry: "2h" },
        mockUserRepo,
      );

      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.expiresIn).toBe(7200); // 2 * 3600
    });

    it("should parse days correctly", async () => {
      const service = new LoginService(
        { ...mockConfig, jwtAccessExpiry: "1d" },
        mockUserRepo,
      );

      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.expiresIn).toBe(86400); // 1 * 86400
    });

    it("should default to 15 minutes for invalid expiry format", async () => {
      const service = new LoginService(
        { ...mockConfig, jwtAccessExpiry: "invalid" },
        mockUserRepo,
      );

      const user = createMockUser();
      (mockUserRepo.findByEmail as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.expiresIn).toBe(900); // default 15 minutes
    });
  });
});
