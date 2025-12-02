/**
 * Shared Validation Utilities
 *
 * Common validation helpers for all OpenSky products
 */

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL validation
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * UUID validation
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Password strength validation
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain lowercase letters");
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain uppercase letters");
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain numbers");
  } else {
    score += 1;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain special characters");
  } else {
    score += 1;
  }

  return {
    valid: errors.length === 0,
    errors,
    score,
  };
}

/**
 * Phone number validation (international)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s()-]/g, ""));
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input.trim();

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  if (maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[],
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      data[field] === ""
    ) {
      missing.push(String(field));
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate object against schema
 */
export interface ValidationSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "array" | "object";
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
    message?: string;
  };
}

export function validateSchema(
  data: any,
  schema: ValidationSchema,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Check required
    if (
      rules.required &&
      (value === undefined || value === null || value === "")
    ) {
      errors[field] = rules.message || `${field} is required`;
      continue;
    }

    // Skip validation if not required and empty
    if (
      !rules.required &&
      (value === undefined || value === null || value === "")
    ) {
      continue;
    }

    // Check type
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rules.type) {
      errors[field] = rules.message || `${field} must be a ${rules.type}`;
      continue;
    }

    // Check min/max for strings and arrays
    if ((rules.type === "string" || rules.type === "array") && value) {
      if (rules.min !== undefined && value.length < rules.min) {
        errors[field] =
          rules.message || `${field} must be at least ${rules.min} characters`;
        continue;
      }
      if (rules.max !== undefined && value.length > rules.max) {
        errors[field] =
          rules.message || `${field} must be at most ${rules.max} characters`;
        continue;
      }
    }

    // Check min/max for numbers
    if (rules.type === "number" && typeof value === "number") {
      if (rules.min !== undefined && value < rules.min) {
        errors[field] =
          rules.message || `${field} must be at least ${rules.min}`;
        continue;
      }
      if (rules.max !== undefined && value > rules.max) {
        errors[field] =
          rules.message || `${field} must be at most ${rules.max}`;
        continue;
      }
    }

    // Check pattern for strings
    if (rules.type === "string" && rules.pattern && typeof value === "string") {
      if (!rules.pattern.test(value)) {
        errors[field] = rules.message || `${field} has invalid format`;
        continue;
      }
    }

    // Custom validation
    if (rules.custom && !rules.custom(value)) {
      errors[field] = rules.message || `${field} failed custom validation`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate file upload
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  },
): { valid: boolean; error?: string } {
  // Check file size
  if (options.maxSize && file.size > options.maxSize) {
    const sizeMB = (options.maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds maximum of ${sizeMB}MB`,
    };
  }

  // Check MIME type
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  // Check file extension
  if (options.allowedExtensions) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!options.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension ${ext} is not allowed`,
      };
    }
  }

  return { valid: true };
}
