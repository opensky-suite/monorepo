/**
 * TwoFactorService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TwoFactorService,
  type UserRepository,
  type TwoFactorConfig,
} from "../two-factor.js";
import { UnauthorizedError, ValidationError } from "../../errors.js";
import { authenticator } from "otplib";

// Mock QRCode
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqrcode"),
  },
}));

describe("TwoFactorService", () => {
  let service: TwoFactorService;
  let mockUserRepo: UserRepository;
  let mockConfig: TwoFactorConfig;

  beforeEach(() => {
    mockConfig = {
      issuer: "OpenSky",
      window: 1,
    };

    mockUserRepo = {
      getTwoFactorSecret: vi.fn(),
      setTwoFactorSecret: vi.fn(),
      enableTwoFactor: vi.fn(),
      disableTwoFactor: vi.fn(),
      setBackupCodes: vi.fn(),
      getBackupCodes: vi.fn(),
      removeBackupCode: vi.fn(),
    };

    service = new TwoFactorService(mockUserRepo, mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("enableTwoFactor", () => {
    it("should generate secret and QR code", async () => {
      const userId = "user-123";
      const userEmail = "test@example.com";

      const result = await service.enableTwoFactor(userId, userEmail);

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.qrCode).toBe("data:image/png;base64,mockqrcode");
      expect(result.backupCodes).toHaveLength(10);
      expect(mockUserRepo.setTwoFactorSecret).toHaveBeenCalledWith(
        userId,
        result.secret,
      );
      expect(mockUserRepo.setBackupCodes).toHaveBeenCalledWith(
        userId,
        result.backupCodes,
      );
    });

    it("should generate unique backup codes", async () => {
      const result = await service.enableTwoFactor(
        "user-123",
        "test@example.com",
      );

      // Check all codes are unique
      const uniqueCodes = new Set(result.backupCodes);
      expect(uniqueCodes.size).toBe(10);

      // Check each code is 8 characters
      result.backupCodes.forEach((code) => {
        expect(code.length).toBe(8);
        expect(/^[0-9A-F]{8}$/.test(code)).toBe(true);
      });
    });

    it("should store secret but not enable 2FA yet", async () => {
      await service.enableTwoFactor("user-123", "test@example.com");

      expect(mockUserRepo.setTwoFactorSecret).toHaveBeenCalled();
      expect(mockUserRepo.enableTwoFactor).not.toHaveBeenCalled();
    });
  });

  describe("verifyTwoFactorSetup", () => {
    it("should verify valid TOTP code and enable 2FA", async () => {
      const userId = "user-123";
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      await service.verifyTwoFactorSetup(userId, validCode);

      expect(mockUserRepo.enableTwoFactor).toHaveBeenCalledWith(userId);
    });

    it("should throw error for invalid code format", async () => {
      await expect(
        service.verifyTwoFactorSetup("user-123", "12345"), // Only 5 digits
      ).rejects.toThrow("Invalid 2FA code format");

      await expect(
        service.verifyTwoFactorSetup("user-123", "abcdef"), // Not digits
      ).rejects.toThrow("Invalid 2FA code format");
    });

    it("should throw error if setup not initiated", async () => {
      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(null);

      await expect(
        service.verifyTwoFactorSetup("user-123", "123456"),
      ).rejects.toThrow("2FA setup not initiated");
    });

    it("should throw error for invalid TOTP code", async () => {
      const secret = authenticator.generateSecret();
      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      await expect(
        service.verifyTwoFactorSetup("user-123", "000000"), // Invalid code
      ).rejects.toThrow("Invalid verification code");
    });
  });

  describe("verifyTwoFactorCode", () => {
    it("should verify valid TOTP code", async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      const result = await service.verifyTwoFactorCode("user-123", validCode);

      expect(result).toBe(true);
    });

    it("should reject invalid TOTP code", async () => {
      const secret = authenticator.generateSecret();
      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      const result = await service.verifyTwoFactorCode("user-123", "000000");

      expect(result).toBe(false);
    });

    it("should verify valid backup code", async () => {
      const secret = authenticator.generateSecret();
      const backupCode = "ABCD1234";

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);
      (mockUserRepo.getBackupCodes as any).mockResolvedValue([
        backupCode,
        "EFGH5678",
      ]);

      const result = await service.verifyTwoFactorCode("user-123", backupCode);

      expect(result).toBe(true);
      expect(mockUserRepo.removeBackupCode).toHaveBeenCalledWith(
        "user-123",
        backupCode,
      );
    });

    it("should reject invalid backup code", async () => {
      const secret = authenticator.generateSecret();

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);
      (mockUserRepo.getBackupCodes as any).mockResolvedValue([
        "ABCD1234",
        "EFGH5678",
      ]);

      const result = await service.verifyTwoFactorCode("user-123", "INVALID1");

      expect(result).toBe(false);
      expect(mockUserRepo.removeBackupCode).not.toHaveBeenCalled();
    });

    it("should return false for empty code", async () => {
      const result = await service.verifyTwoFactorCode("user-123", "");

      expect(result).toBe(false);
    });

    it("should return false if no secret exists", async () => {
      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(null);

      const result = await service.verifyTwoFactorCode("user-123", "123456");

      expect(result).toBe(false);
    });
  });

  describe("disableTwoFactor", () => {
    it("should disable 2FA with valid code", async () => {
      const userId = "user-123";
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      await service.disableTwoFactor(userId, validCode);

      expect(mockUserRepo.disableTwoFactor).toHaveBeenCalledWith(userId);
      expect(mockUserRepo.setTwoFactorSecret).toHaveBeenCalledWith(userId, "");
      expect(mockUserRepo.setBackupCodes).toHaveBeenCalledWith(userId, []);
    });

    it("should throw error with invalid code", async () => {
      const secret = authenticator.generateSecret();
      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      await expect(
        service.disableTwoFactor("user-123", "000000"),
      ).rejects.toThrow("Invalid 2FA code");
    });

    it("should disable with valid backup code", async () => {
      const userId = "user-123";
      const secret = authenticator.generateSecret();
      const backupCode = "ABCD1234";

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);
      (mockUserRepo.getBackupCodes as any).mockResolvedValue([backupCode]);

      await service.disableTwoFactor(userId, backupCode);

      expect(mockUserRepo.disableTwoFactor).toHaveBeenCalledWith(userId);
    });
  });

  describe("generateBackupCodes", () => {
    it("should generate new backup codes with valid TOTP", async () => {
      const userId = "user-123";
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      const backupCodes = await service.generateBackupCodes(userId, validCode);

      expect(backupCodes).toHaveLength(10);
      expect(mockUserRepo.setBackupCodes).toHaveBeenCalledWith(
        userId,
        backupCodes,
      );

      // Verify format
      backupCodes.forEach((code) => {
        expect(code.length).toBe(8);
        expect(/^[0-9A-F]{8}$/.test(code)).toBe(true);
      });
    });

    it("should throw error with invalid code", async () => {
      const secret = authenticator.generateSecret();
      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);

      await expect(
        service.generateBackupCodes("user-123", "000000"),
      ).rejects.toThrow("Invalid 2FA code");
    });

    it("should generate with valid backup code", async () => {
      const userId = "user-123";
      const secret = authenticator.generateSecret();
      const backupCode = "ABCD1234";

      (mockUserRepo.getTwoFactorSecret as any).mockResolvedValue(secret);
      (mockUserRepo.getBackupCodes as any).mockResolvedValue([backupCode]);

      const newCodes = await service.generateBackupCodes(userId, backupCode);

      expect(newCodes).toHaveLength(10);
      expect(mockUserRepo.setBackupCodes).toHaveBeenCalled();
    });
  });
});
