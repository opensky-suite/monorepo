/**
 * Two-Factor Authentication (2FA)
 * Issue #27: Implement Two-Factor Authentication (2FA)
 *
 * Implements TOTP (Time-based One-Time Password) authentication
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */

import { authenticator } from "otplib";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { UnauthorizedError, ValidationError } from "../errors.js";

export interface UserRepository {
  getTwoFactorSecret(userId: string): Promise<string | null>;
  setTwoFactorSecret(userId: string, secret: string): Promise<void>;
  enableTwoFactor(userId: string): Promise<void>;
  disableTwoFactor(userId: string): Promise<void>;
  setBackupCodes(userId: string, codes: string[]): Promise<void>;
  getBackupCodes(userId: string): Promise<string[]>;
  removeBackupCode(userId: string, code: string): Promise<void>;
}

export interface TwoFactorConfig {
  issuer: string; // App name shown in authenticator (e.g., "OpenSky")
  window?: number; // Time window for code validation (default: 1 = ±30 seconds)
}

export class TwoFactorService {
  constructor(
    private userRepo: UserRepository,
    private config: TwoFactorConfig,
  ) {
    // Configure TOTP settings
    authenticator.options = {
      window: config.window || 1, // Allow ±30 seconds time drift
    };
  }

  /**
   * Enable 2FA for a user
   * Returns secret and QR code for user to scan with authenticator app
   */
  async enableTwoFactor(
    userId: string,
    userEmail: string,
  ): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    // Generate a new secret
    const secret = authenticator.generateSecret();

    // Create otpauth URL for QR code
    const otpauthUrl = authenticator.keyuri(
      userEmail,
      this.config.issuer,
      secret,
    );

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Generate backup codes
    const backupCodes = this.generateBackupCodesInternal();

    // Store secret (but don't enable 2FA yet - wait for verification)
    await this.userRepo.setTwoFactorSecret(userId, secret);
    await this.userRepo.setBackupCodes(userId, backupCodes);

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify 2FA setup by checking the user's first code
   * This confirms they've successfully set up their authenticator app
   */
  async verifyTwoFactorSetup(userId: string, code: string): Promise<void> {
    // Validate code format
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new ValidationError("Invalid 2FA code format. Must be 6 digits.");
    }

    // Get the secret
    const secret = await this.userRepo.getTwoFactorSecret(userId);
    if (!secret) {
      throw new ValidationError("2FA setup not initiated. Please start over.");
    }

    // Verify the code
    const isValid = authenticator.verify({
      token: code,
      secret,
    });

    if (!isValid) {
      throw new UnauthorizedError(
        "Invalid verification code. Please check your authenticator app.",
      );
    }

    // Enable 2FA for the user
    await this.userRepo.enableTwoFactor(userId);
  }

  /**
   * Verify a 2FA code during login
   * Returns true if code is valid (either TOTP or backup code)
   */
  async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
    // Validate code format
    if (!code || code.length === 0) {
      return false;
    }

    // Get the secret
    const secret = await this.userRepo.getTwoFactorSecret(userId);
    if (!secret) {
      return false;
    }

    // Check if it's a 6-digit TOTP code
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      return authenticator.verify({
        token: code,
        secret,
      });
    }

    // Check if it's a backup code (longer, alphanumeric)
    if (code.length >= 8) {
      const backupCodes = await this.userRepo.getBackupCodes(userId);
      const hasBackupCode = backupCodes.includes(code);

      if (hasBackupCode) {
        // Remove used backup code
        await this.userRepo.removeBackupCode(userId, code);
        return true;
      }
    }

    return false;
  }

  /**
   * Disable 2FA for a user
   * Requires a valid 2FA code to prevent unauthorized disabling
   */
  async disableTwoFactor(userId: string, code: string): Promise<void> {
    // Verify the code before disabling
    const isValid = await this.verifyTwoFactorCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedError(
        "Invalid 2FA code. Cannot disable two-factor authentication.",
      );
    }

    // Disable 2FA and clear secret
    await this.userRepo.disableTwoFactor(userId);
    await this.userRepo.setTwoFactorSecret(userId, "");
    await this.userRepo.setBackupCodes(userId, []);
  }

  /**
   * Generate new backup codes
   * Useful if user loses their backup codes
   * Requires valid 2FA code to prevent unauthorized generation
   */
  async generateBackupCodes(userId: string, code: string): Promise<string[]> {
    // Verify the code before generating new backup codes
    const isValid = await this.verifyTwoFactorCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedError(
        "Invalid 2FA code. Cannot generate backup codes.",
      );
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodesInternal();
    await this.userRepo.setBackupCodes(userId, backupCodes);

    return backupCodes;
  }

  /**
   * Internal method to generate backup codes
   * Generates 10 random 8-character alphanumeric codes
   */
  private generateBackupCodesInternal(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8 random bytes and convert to hex (16 chars), then take first 8
      const code = randomBytes(4).toString("hex").toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
