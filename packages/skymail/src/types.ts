/**
 * SkyMail - TypeScript Types
 * Gmail-inspired email system
 */

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface Email {
  id: string;
  userId: string;

  // Headers
  messageId: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;

  // From/To/Cc/Bcc
  fromAddress: string;
  fromName?: string;
  toAddresses: EmailAddress[];
  ccAddresses: EmailAddress[];
  bccAddresses: EmailAddress[];

  // Content
  subject: string;
  bodyText?: string;
  bodyHtml?: string;

  // State
  isDraft: boolean;
  isSent: boolean;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  isSpam: boolean;

  // Metadata
  spamScore?: number;
  sizeBytes: number;
  hasAttachments: boolean;

  // Timestamps
  receivedAt: Date;
  sentAt?: Date;
  readAt?: Date;
  trashedAt?: Date;
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailThread {
  id: string;
  userId: string;
  subject: string;
  snippet?: string;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLabel {
  id: string;
  userId: string;
  name: string;
  color?: string;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailAttachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  contentId?: string;
  isInline: boolean;
  virusScanned: boolean;
  virusDetected: boolean;
  createdAt: Date;
}

export interface EmailFilter {
  id: string;
  userId: string;
  name: string;
  isEnabled: boolean;
  conditions: FilterCondition[];
  actions: FilterAction[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterCondition {
  field: "from" | "to" | "subject" | "body" | "hasAttachment" | "size";
  operator:
    | "contains"
    | "notContains"
    | "equals"
    | "notEquals"
    | "greaterThan"
    | "lessThan";
  value: string | number | boolean;
}

export interface FilterAction {
  action:
    | "addLabel"
    | "removeLabel"
    | "markAsRead"
    | "markAsStarred"
    | "archive"
    | "trash"
    | "markAsSpam";
  value?: string;
}

export interface EmailContact {
  id: string;
  userId: string;
  emailAddress: string;
  name?: string;
  avatarUrl?: string;
  emailCount: number;
  lastEmailedAt?: Date;
  phone?: string;
  notes?: string;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailSendQueue {
  id: string;
  emailId: string;
  scheduledAt: Date;
  attempts: number;
  lastError?: string;
  status: "pending" | "sending" | "sent" | "failed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

// Service method inputs
export interface CreateEmailInput {
  userId: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: EmailAddress[];
  ccAddresses?: EmailAddress[];
  bccAddresses?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  isDraft?: boolean;
  inReplyTo?: string;
  references?: string;
}

export interface SendEmailInput {
  emailId: string;
  scheduledAt?: Date;
}

export interface UpdateEmailInput {
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  isArchived?: boolean;
  isTrashed?: boolean;
  isSpam?: boolean;
  snoozedUntil?: Date | null;
}

export interface SearchEmailsInput {
  userId: string;
  query?: string;
  labelIds?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  hasAttachment?: boolean;
  fromAddress?: string;
  toAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AttachFileInput {
  emailId: string;
  filename: string;
  contentType: string;
  fileBuffer: Buffer;
  isInline?: boolean;
  contentId?: string;
}

// SMTP/IMAP types
export interface SMTPServerConfig {
  host: string;
  port: number;
  secure: boolean;
  authRequired: boolean;
  maxMessageSize?: number;
}

export interface IMAPServerConfig {
  host: string;
  port: number;
  secure: boolean;
}

export interface SMTPClientConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface ParsedEmail {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments: ParsedAttachment[];
  date: Date;
  headers: Map<string, string | string[]>;
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId?: string;
  inline: boolean;
}
