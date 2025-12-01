/**
 * User Registration with Email Verification
 * Issue #21: Implement user registration and email verification
 */

import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import type { User, EmailVerification } from "@opensky/types";
import type {
  RegisterRequest,
  RegisterResponse,
  AuthConfig,
} from "../types.js";
import { ValidationError, ConflictError } from "../errors.js";
import { registerSchema } from "../types.js";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
}

export interface EmailVerificationRepository {
  create(
    data: Omit<EmailVerification, "id" | "createdAt">,
  ): Promise<EmailVerification>;
  findByToken(token: string): Promise<EmailVerification | null>;
  markAsVerified(id: string): Promise<void>;
}

export interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
}

export class RegistrationService {
  constructor(
    private config: AuthConfig,
    private userRepo: UserRepository,
    private emailVerificationRepo: EmailVerificationRepository,
    private emailService: EmailService,
  ) {}

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    // Validate input
    const validated = registerSchema.safeParse(data);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0].message);
    }

    const { email, password, firstName, lastName } = validated.data;

    // Check if user already exists
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      this.config.passwordSaltRounds,
    );

    // Create user
    const user = await this.userRepo.create({
      email,
      emailVerified: false,
      passwordHash,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      twoFactorEnabled: false,
    });

    // Create email verification token
    const verificationToken = nanoid(32);
    const expiresAt = new Date(
      Date.now() + this.config.emailVerificationExpiry,
    );

    await this.emailVerificationRepo.create({
      userId: user.id,
      email: user.email,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email (async, don't wait)
    this.emailService
      .sendVerificationEmail(user.email, verificationToken)
      .catch((err) => console.error("Failed to send verification email:", err));

    return {
      userId: user.id,
      email: user.email,
      message:
        "Registration successful. Please check your email to verify your account.",
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = await this.emailVerificationRepo.findByToken(token);

    if (!verification) {
      throw new ValidationError("Invalid verification token");
    }

    if (verification.verifiedAt) {
      throw new ValidationError("Email already verified");
    }

    if (verification.expiresAt < new Date()) {
      throw new ValidationError("Verification token has expired");
    }

    await this.emailVerificationRepo.markAsVerified(verification.id);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists - security best practice
      return;
    }

    if (user.emailVerified) {
      throw new ValidationError("Email already verified");
    }

    // Create new verification token
    const verificationToken = nanoid(32);
    const expiresAt = new Date(
      Date.now() + this.config.emailVerificationExpiry,
    );

    await this.emailVerificationRepo.create({
      userId: user.id,
      email: user.email,
      token: verificationToken,
      expiresAt,
    });

    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
    );
  }
}
