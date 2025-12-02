/**
 * Tests for User Registration Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegistrationService } from "../registration.js";
import type {
  UserRepository,
  EmailVerificationRepository,
  EmailService,
} from "../registration.js";
import type { AuthConfig } from "../../types.js";
import { ValidationError, ConflictError } from "../../errors.js";

// Mock repositories
const createMockUserRepo = (): UserRepository => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
});

const createMockEmailVerificationRepo = (): EmailVerificationRepository => ({
  create: vi.fn(),
  findByToken: vi.fn(),
  markAsVerified: vi.fn(),
});

const createMockEmailService = (): EmailService => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
});

const mockConfig: AuthConfig = {
  jwtSecret: "test-secret",
  jwtAccessExpiry: "15m",
  jwtRefreshExpiry: "7d",
  passwordSaltRounds: 10,
  emailVerificationExpiry: 24 * 60 * 60 * 1000, // 24 hours
  passwordResetExpiry: 60 * 60 * 1000, // 1 hour
};

describe("RegistrationService", () => {
  let service: RegistrationService;
  let userRepo: UserRepository;
  let emailVerificationRepo: EmailVerificationRepository;
  let emailService: EmailService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    emailVerificationRepo = createMockEmailVerificationRepo();
    emailService = createMockEmailService();
    service = new RegistrationService(
      mockConfig,
      userRepo,
      emailVerificationRepo,
      emailService,
    );
  });

  describe("register", () => {
    it("should successfully register a new user", async () => {
      const registerData = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      vi.mocked(userRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(userRepo.create).mockResolvedValue({
        id: "user-123",
        email: registerData.email,
        emailVerified: false,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        displayName: "John Doe",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(emailVerificationRepo.create).mockResolvedValue({
        id: "verification-123",
        userId: "user-123",
        email: registerData.email,
        token: "test-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      const result = await service.register(registerData);

      expect(result).toEqual({
        userId: "user-123",
        email: registerData.email,
        message: expect.stringContaining("verify"),
      });

      expect(userRepo.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerData.email,
          emailVerified: false,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
        }),
      );
    });

    it("should throw ConflictError if user already exists", async () => {
      const registerData = {
        email: "existing@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      vi.mocked(userRepo.findByEmail).mockResolvedValue({
        id: "existing-user",
        email: registerData.email,
        emailVerified: true,
        firstName: "Existing",
        lastName: "User",
        displayName: "Existing User",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.register(registerData)).rejects.toThrow(
        /already exists/i,
      );
    });

    it("should throw ValidationError for invalid email", async () => {
      const registerData = {
        email: "invalid-email",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      await expect(service.register(registerData)).rejects.toThrow();
    });

    it("should throw ValidationError for short password", async () => {
      const registerData = {
        email: "test@example.com",
        password: "short",
        firstName: "John",
        lastName: "Doe",
      };

      await expect(service.register(registerData)).rejects.toThrow();
    });
  });

  describe("verifyEmail", () => {
    it("should successfully verify email with valid token", async () => {
      const token = "valid-token";
      const verification = {
        id: "verification-123",
        userId: "user-123",
        email: "test@example.com",
        token,
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };

      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(
        verification,
      );

      await service.verifyEmail(token);

      expect(emailVerificationRepo.markAsVerified).toHaveBeenCalledWith(
        verification.id,
      );
    });

    it("should throw ValidationError for invalid token", async () => {
      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(null);

      await expect(service.verifyEmail("invalid-token")).rejects.toThrow(
        /invalid|not found/i,
      );
    });

    it("should throw ValidationError for expired token", async () => {
      const verification = {
        id: "verification-123",
        userId: "user-123",
        email: "test@example.com",
        token: "expired-token",
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(
        verification,
      );

      await expect(service.verifyEmail("expired-token")).rejects.toThrow(
        /expired/i,
      );
    });

    it("should throw ValidationError if already verified", async () => {
      const verification = {
        id: "verification-123",
        userId: "user-123",
        email: "test@example.com",
        token: "token",
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        verifiedAt: new Date(),
      };

      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(
        verification,
      );

      await expect(service.verifyEmail("token")).rejects.toThrow(
        /already verified/i,
      );
    });
  });

  describe("resendVerificationEmail", () => {
    it("should send new verification email for unverified user", async () => {
      const email = "test@example.com";
      const user = {
        id: "user-123",
        email,
        emailVerified: false,
        firstName: "John",
        lastName: "Doe",
        displayName: "John Doe",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
      vi.mocked(emailVerificationRepo.create).mockResolvedValue({
        id: "verification-123",
        userId: user.id,
        email,
        token: "new-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      await service.resendVerificationEmail(email);

      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it("should not reveal if user does not exist", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(null);

      await expect(
        service.resendVerificationEmail("nonexistent@example.com"),
      ).resolves.toBeUndefined();
    });

    it("should throw ValidationError if email already verified", async () => {
      const user = {
        id: "user-123",
        email: "verified@example.com",
        emailVerified: true,
        firstName: "John",
        lastName: "Doe",
        displayName: "John Doe",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepo.findByEmail).mockResolvedValue(user);

      await expect(service.resendVerificationEmail(user.email)).rejects.toThrow(
        /already verified/i,
      );
    });
  });
});
