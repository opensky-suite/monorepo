/**
 * JWT Authentication
 * Issue #22: Implement login and JWT authentication
 */

import jwt from "jsonwebtoken";
import type { JwtPayload } from "@opensky/types";
import type { AuthConfig, AuthContext } from "../types.js";
import { UnauthorizedError } from "../errors.js";

export class JwtService {
  constructor(private config: AuthConfig) {}

  generateAccessToken(userId: string, email: string): string {
    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: userId,
      email,
      type: "access",
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtAccessExpiry,
    });
  }

  generateRefreshToken(userId: string, email: string): string {
    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: userId,
      email,
      type: "refresh",
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtRefreshExpiry,
    });
  }

  verifyAccessToken(token: string): AuthContext {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as JwtPayload;

      if (payload.type !== "access") {
        throw new UnauthorizedError("Invalid token type");
      }

      return {
        userId: payload.sub,
        email: payload.email,
        type: "jwt",
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError("Invalid token");
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token expired");
      }
      throw error;
    }
  }

  verifyRefreshToken(token: string): AuthContext {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as JwtPayload;

      if (payload.type !== "refresh") {
        throw new UnauthorizedError("Invalid token type");
      }

      return {
        userId: payload.sub,
        email: payload.email,
        type: "jwt",
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError("Invalid refresh token");
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Refresh token expired");
      }
      throw error;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  getTokenExpiry(token: string): Date | null {
    const decoded = this.decodeToken(token);
    return decoded ? new Date(decoded.exp * 1000) : null;
  }
}
