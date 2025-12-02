import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  uuidSchema,
  urlSchema,
  phoneSchema,
  slugSchema,
  paginationSchema,
  apiKeySchema,
  sanitizeHtml,
  sanitizeSql,
  parsePagination,
  safeParse,
} from './index.js';

describe('Validation Utils', () => {
  describe('emailSchema', () => {
    it('should validate valid emails', () => {
      expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
      expect(emailSchema.parse('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid')).toThrow();
      expect(() => emailSchema.parse('invalid@')).toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('should validate strong passwords', () => {
      expect(passwordSchema.parse('Strong123!')).toBe('Strong123!');
      expect(passwordSchema.parse('MyP@ssw0rd')).toBe('MyP@ssw0rd');
    });

    it('should reject weak passwords', () => {
      expect(() => passwordSchema.parse('short')).toThrow();
      expect(() => passwordSchema.parse('noupper123!')).toThrow();
      expect(() => passwordSchema.parse('NOLOWER123!')).toThrow();
      expect(() => passwordSchema.parse('NoNumber!')).toThrow();
      expect(() => passwordSchema.parse('NoSpecial123')).toThrow();
    });
  });

  describe('uuidSchema', () => {
    it('should validate UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(uuidSchema.parse(uuid)).toBe(uuid);
    });

    it('should reject invalid UUIDs', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
    });
  });

  describe('urlSchema', () => {
    it('should validate URLs', () => {
      expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
      expect(urlSchema.parse('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('should reject invalid URLs', () => {
      expect(() => urlSchema.parse('not-a-url')).toThrow();
    });
  });

  describe('phoneSchema', () => {
    it('should validate E.164 phone numbers', () => {
      expect(phoneSchema.parse('+12345678901')).toBe('+12345678901');
      expect(phoneSchema.parse('+447911123456')).toBe('+447911123456');
    });

    it('should reject invalid phone numbers', () => {
      expect(() => phoneSchema.parse('1234567890')).toThrow();
      expect(() => phoneSchema.parse('+1')).toThrow();
    });
  });

  describe('slugSchema', () => {
    it('should validate slugs', () => {
      expect(slugSchema.parse('my-slug')).toBe('my-slug');
      expect(slugSchema.parse('slug123')).toBe('slug123');
    });

    it('should reject invalid slugs', () => {
      expect(() => slugSchema.parse('My-Slug')).toThrow();
      expect(() => slugSchema.parse('slug_with_underscore')).toThrow();
      expect(() => slugSchema.parse('slug with spaces')).toThrow();
    });
  });

  describe('paginationSchema', () => {
    it('should parse valid pagination params', () => {
      expect(paginationSchema.parse({ page: 1, limit: 20 })).toEqual({ page: 1, limit: 20 });
      expect(paginationSchema.parse({ page: '2', limit: '50' })).toEqual({ page: 2, limit: 50 });
    });

    it('should use default values', () => {
      expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    });

    it('should reject invalid pagination', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
      expect(() => paginationSchema.parse({ page: -1 })).toThrow();
      expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe('apiKeySchema', () => {
    it('should validate API keys', () => {
      const apiKey = 'a'.repeat(32);
      expect(apiKeySchema.parse(apiKey)).toBe(apiKey);
    });

    it('should reject invalid API keys', () => {
      expect(() => apiKeySchema.parse('too-short')).toThrow();
      expect(() => apiKeySchema.parse('A'.repeat(32))).toThrow();
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeHtml('<p>Hello</p>')).toBe('Hello');
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeHtml('No tags here')).toBe('No tags here');
    });
  });

  describe('sanitizeSql', () => {
    it('should escape single quotes', () => {
      expect(sanitizeSql("O'Reilly")).toBe("O''Reilly");
      expect(sanitizeSql("It's working")).toBe("It''s working");
    });
  });

  describe('parsePagination', () => {
    it('should parse pagination params', () => {
      expect(parsePagination({ page: '2', limit: '50' })).toEqual({ page: 2, limit: 50 });
    });
  });

  describe('safeParse', () => {
    it('should return success result for valid data', () => {
      const result = safeParse(emailSchema, 'test@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should return error result for invalid data', () => {
      const result = safeParse(emailSchema, 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Invalid email');
      }
    });
  });
});
