/**
 * Login Service
 * Issue #22: Implement login and JWT authentication
 */

import bcrypt from "bcrypt";
import type { User } from "@opensky/types";
import type { LoginRequest, LoginResponse, AuthConfig } from "../types.js";
import { UnauthorizedError, ValidationError } from "../errors.js";
import { loginSchema } from "../types.js";
import { JwtService } from "./jwt.js";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  updateLastLogin(userId: string): Promise<void>;
}

export class LoginService {
  private jwtService: JwtService;

  constructor(
    private config: AuthConfig,
    private userRepo: UserRepository,
  ) {
    this.jwtService = new JwtService(config);
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    // Validate input
    const validated = loginSchema.safeParse(data);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0].message);
    }

    const { email, password, twoFactorCode } = validated.data;

    // Find user
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      // Don't reveal whether user exists
      throw new UnauthorizedError("Invalid email or password");
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedError(
        "Email not verified. Please check your email for verification link.",
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw new UnauthorizedError("Two-factor authentication code required");
      }

      // Verify 2FA code (implemented in two-factor.ts)
      // For now, throw not implemented
      throw new ValidationError(
        "Two-factor authentication not yet fully implemented",
      );
    }

    // Update last login
    await this.userRepo.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(
      user.id,
      user.email,
    );
    const refreshToken = this.jwtService.generateRefreshToken(
      user.id,
      user.email,
    );

    // Get token expiry
    const expiresIn = this.parseExpiryToSeconds(this.config.jwtAccessExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
      },
    };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Verify refresh token
    const context = this.jwtService.verifyRefreshToken(refreshToken);

    // Generate new access token
    const accessToken = this.jwtService.generateAccessToken(
      context.userId,
      context.email,
    );
    const expiresIn = this.parseExpiryToSeconds(this.config.jwtAccessExpiry);

    return { accessToken, expiresIn };
  }

  async logout(userId: string): Promise<void> {
    // In a full implementation, we'd invalidate all sessions for this user
    // For now, since JWT is stateless, just log the event
    console.log(`User ${userId} logged out`);
  }

  private parseExpiryToSeconds(expiry: string): number {
    // Parse expressions like '15m', '7d', '24h'
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 60);
  }
}
