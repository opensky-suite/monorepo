/**
 * Passport OAuth Strategies Configuration
 * Google and GitHub OAuth2 implementations
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import type { OAuthProfile } from "./oauth.js";

export interface OAuthConfig {
  google?: {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  };
  github?: {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  };
}

export interface OAuthStrategyCallback {
  (profile: OAuthProfile): Promise<void>;
}

/**
 * Configure Passport OAuth strategies
 */
export function configureOAuthStrategies(
  config: OAuthConfig,
  callback: OAuthStrategyCallback,
): void {
  // Google OAuth Strategy
  if (config.google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientID,
          clientSecret: config.google.clientSecret,
          callbackURL: config.google.callbackURL,
          scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const oauthProfile: OAuthProfile = {
              provider: "google",
              providerId: profile.id,
              email: profile.emails?.[0]?.value || "",
              firstName: profile.name?.givenName || "",
              lastName: profile.name?.familyName || "",
              displayName: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            };

            await callback(oauthProfile);
            done(null, profile);
          } catch (error) {
            done(error as Error);
          }
        },
      ),
    );
  }

  // GitHub OAuth Strategy
  if (config.github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.github.clientID,
          clientSecret: config.github.clientSecret,
          callbackURL: config.github.callbackURL,
          scope: ["user:email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // GitHub profile structure
            const email = profile.emails?.[0]?.value || "";
            const name = profile.displayName || profile.username || "";
            const [firstName = "", ...lastNameParts] = name.split(" ");
            const lastName = lastNameParts.join(" ");

            const oauthProfile: OAuthProfile = {
              provider: "github",
              providerId: profile.id,
              email,
              firstName,
              lastName,
              displayName: name,
              avatarUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            };

            await callback(oauthProfile);
            done(null, profile);
          } catch (error) {
            done(error as Error);
          }
        },
      ),
    );
  }
}

/**
 * Serialize user for session
 */
export function configurePassportSerialization(): void {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id: string, done) => {
    // In production, fetch user from database
    done(null, { id });
  });
}
