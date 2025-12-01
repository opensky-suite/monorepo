/**
 * SkyMail - Email System
 *
 * Gmail-inspired email platform with:
 * - SMTP server for receiving emails
 * - SMTP client for sending emails
 * - Email threading and conversations
 * - Labels and filters
 * - Full-text search
 * - Attachment handling
 * - Spam filtering
 */

export * from "./types";
export * from "./smtp-server";
export * from "./smtp-client";
export * from "./email-threading";
export * from "./email-search";
export * from "./attachment-service";
export * from "./imap-server";

// Re-export commonly used types
export type {
  Email,
  EmailThread,
  EmailLabel,
  EmailAttachment,
  EmailFilter,
  EmailContact,
  EmailAddress,
  CreateEmailInput,
  SendEmailInput,
  UpdateEmailInput,
  SearchEmailsInput,
} from "./types";
