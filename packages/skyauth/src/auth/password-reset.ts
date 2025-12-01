/**
 * Password Reset Flow
 * Issue #23: Implement password reset flow
 */

import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import type { User, PasswordReset } from "@opensky/types";
import type {
  PasswordResetRequest,
  PasswordResetConfirm,
  AuthConfig,
} from "../types.js";
import { ValidationError, NotFoundError } from "../errors.js";
import { passwordResetRequestSchema, passwordResetSchema } from "../types.js";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

export interface PasswordResetRepository {
  create(data: Omit<PasswordReset, "id" | "createdAt">): Promise<PasswordReset>;
  findByToken(token: string): Promise<PasswordReset | null>;
  markAsUsed(id: string): Promise<void>;
}

export interface EmailService {
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

export class PasswordResetService {
  constructor(
    private config: AuthConfig,
    private userRepo: UserRepository,
    private passwordResetRepo: PasswordResetRepository,
    private emailService: EmailService,
  ) {}

  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    // Validate input
    const validated = passwordResetRequestSchema.safeParse(data);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0].message);
    }

    const { email } = validated.data;

    // Find user
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists - security best practice
      return;
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const expiresAt = new Date(Date.now() + this.config.passwordResetExpiry);

    await this.passwordResetRepo.create({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // Send reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(data: PasswordResetConfirm): Promise<void> {
    // Validate input
    const validated = passwordResetSchema.safeParse(data);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0].message);
    }

    const { token, newPassword } = validated.data;

    // Find reset request
    const resetRequest = await this.passwordResetRepo.findByToken(token);
    if (!resetRequest) {
      throw new ValidationError("Invalid reset token");
    }

    // Check if already used
    if (resetRequest.usedAt) {
      throw new ValidationError("Reset token has already been used");
    }

    // Check expiry
    if (resetRequest.expiresAt < new Date()) {
      throw new ValidationError("Reset token has expired");
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(
      newPassword,
      this.config.passwordSaltRounds,
    );

    // Update password
    await this.userRepo.updatePassword(resetRequest.userId, passwordHash);

    // Mark reset token as used
    await this.passwordResetRepo.markAsUsed(resetRequest.id);
  }
}
