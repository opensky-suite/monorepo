/**
 * Common cryptographic utilities
 */
import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * Generate a secure random token (hex string)
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a secure random API key (format: sky_xxxxxxxx...)
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomPart = randomBytes(24).toString('hex'); // 48 chars
  const key = `sky_${randomPart}`;
  const prefix = key.substring(0, 12); // sky_xxxxxxxx
  const hash = hashApiKey(key);
  
  return { key, prefix, hash };
}

/**
 * Hash an API key for storage (SHA-256)
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a secure random password reset token
 */
export function generateResetToken(): string {
  return generateToken(32);
}

/**
 * Generate a secure random email verification token
 */
export function generateVerificationToken(): string {
  return generateToken(32);
}

/**
 * Generate a secure random session ID
 */
export function generateSessionId(): string {
  return generateToken(32);
}

/**
 * Hash a password using bcrypt
 * Note: bcrypt is async and should be used for password hashing
 * This is a placeholder - actual implementation will use bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  // This is a temporary implementation
  // In production, use bcrypt: const bcrypt = require('bcrypt'); return bcrypt.hash(password, 12);
  const hash = createHash('sha256').update(password).digest('hex');
  return `temp_${hash}`; // Prefix to indicate this is temporary
}

/**
 * Verify a password against a hash
 * Note: This is a placeholder - actual implementation will use bcrypt.compare
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // This is a temporary implementation
  // In production, use bcrypt: const bcrypt = require('bcrypt'); return bcrypt.compare(password, hash);
  const tempHash = `temp_${createHash('sha256').update(password).digest('hex')}`;
  return tempHash === hash;
}

/**
 * Timing-safe string comparison
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Hash data using SHA-256
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Hash data using SHA-512
 */
export function sha512(data: string): string {
  return createHash('sha512').update(data).digest('hex');
}

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
  return randomBytes(16)
    .toString('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

/**
 * Mask sensitive data (show first/last N chars)
 */
export function maskString(str: string, visibleStart = 4, visibleEnd = 4): string {
  if (str.length <= visibleStart + visibleEnd) {
    return '*'.repeat(str.length);
  }
  
  const start = str.substring(0, visibleStart);
  const end = str.substring(str.length - visibleEnd);
  const middle = '*'.repeat(str.length - visibleStart - visibleEnd);
  
  return `${start}${middle}${end}`;
}

/**
 * Generate a secure random OTP (one-time password)
 */
export function generateOTP(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes(1)[0] % digits.length;
    otp += digits[randomIndex];
  }
  
  return otp;
}
