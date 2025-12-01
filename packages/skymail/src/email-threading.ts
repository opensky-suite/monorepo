/**
 * SkyMail Email Threading
 *
 * Groups related emails into conversations (threads)
 * Following Gmail's threading algorithm:
 * 1. Same subject (ignoring Re:, Fwd:, etc.)
 * 2. In-Reply-To header matches
 * 3. References header matches
 * 4. Within reasonable time window
 */

import type { Email, EmailThread } from "./types";

export interface ThreadingOptions {
  /**
   * Maximum time between messages to be considered same thread (days)
   * Default: 30 days
   */
  maxThreadAge?: number;

  /**
   * Ignore subject prefixes like Re:, Fwd:, etc.
   * Default: true
   */
  normalizeSubjects?: boolean;
}

/**
 * Email threading service
 */
export class EmailThreader {
  private options: Required<ThreadingOptions>;

  constructor(options: ThreadingOptions = {}) {
    this.options = {
      maxThreadAge: options.maxThreadAge ?? 30,
      normalizeSubjects: options.normalizeSubjects ?? true,
    };
  }

  /**
   * Normalize email subject for threading
   * Removes Re:, Fwd:, Fw:, etc. prefixes
   */
  normalizeSubject(subject: string): string {
    if (!this.options.normalizeSubjects) {
      return subject;
    }

    // Remove common reply/forward prefixes (case-insensitive)
    let normalized = subject.trim();

    const prefixes = [
      /^re:\s*/i,
      /^fwd:\s*/i,
      /^fw:\s*/i,
      /^forward:\s*/i,
      /^\[fwd:\s*\]/i,
      /^\[fw:\s*\]/i,
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of prefixes) {
        const before = normalized;
        normalized = normalized.replace(prefix, "");
        if (normalized !== before) {
          changed = true;
          break;
        }
      }
      normalized = normalized.trim();
    }

    return normalized;
  }

  /**
   * Extract message IDs from References header
   */
  parseReferences(references?: string): string[] {
    if (!references) return [];

    // References is a space-separated list of Message-IDs
    // Each Message-ID is in angle brackets: <id@domain>
    const matches = references.match(/<[^>]+>/g);
    return matches || [];
  }

  /**
   * Find thread ID for an email
   * Returns existing thread ID or undefined if new thread needed
   */
  async findThreadForEmail(
    email: Email,
    existingEmails: Email[],
  ): Promise<string | undefined> {
    // 1. Check In-Reply-To header
    if (email.inReplyTo) {
      const parent = existingEmails.find(
        (e) => e.messageId === email.inReplyTo,
      );
      if (parent?.threadId) {
        return parent.threadId;
      }
    }

    // 2. Check References header
    if (email.references) {
      const refs = this.parseReferences(email.references);
      for (const ref of refs) {
        const referenced = existingEmails.find((e) => e.messageId === ref);
        if (referenced?.threadId) {
          return referenced.threadId;
        }
      }
    }

    // 3. Match by subject (within time window)
    const normalizedSubject = this.normalizeSubject(email.subject);
    const maxAge = this.options.maxThreadAge * 24 * 60 * 60 * 1000; // days to ms

    for (const existing of existingEmails) {
      // Check if subjects match
      if (this.normalizeSubject(existing.subject) !== normalizedSubject) {
        continue;
      }

      // Check time window
      const timeDiff = Math.abs(
        email.receivedAt.getTime() - existing.receivedAt.getTime(),
      );
      if (timeDiff > maxAge) {
        continue;
      }

      // Check if participants overlap
      if (this.hasOverlappingParticipants(email, existing)) {
        return existing.threadId;
      }
    }

    return undefined;
  }

  /**
   * Check if two emails have overlapping participants
   */
  private hasOverlappingParticipants(email1: Email, email2: Email): boolean {
    const participants1 = new Set([
      email1.fromAddress,
      ...email1.toAddresses.map((a) => a.address),
      ...email1.ccAddresses.map((a) => a.address),
    ]);

    const participants2 = new Set([
      email2.fromAddress,
      ...email2.toAddresses.map((a) => a.address),
      ...email2.ccAddresses.map((a) => a.address),
    ]);

    // Check if at least 2 participants overlap
    let overlapCount = 0;
    for (const p1 of participants1) {
      if (participants2.has(p1)) {
        overlapCount++;
        if (overlapCount >= 2) return true;
      }
    }

    return false;
  }

  /**
   * Generate thread snippet from latest email
   */
  generateThreadSnippet(email: Email, maxLength: number = 500): string {
    const text = email.bodyText || email.bodyHtml || "";

    // Remove HTML tags if present
    const plainText = text.replace(/<[^>]+>/g, "").trim();

    // Take first line or maxLength chars
    const firstLine = plainText.split("\n")[0] || "";

    if (firstLine.length <= maxLength) {
      return firstLine;
    }

    return firstLine.substring(0, maxLength - 3) + "...";
  }

  /**
   * Build thread data from emails
   */
  buildThreadData(emails: Email[]): Partial<EmailThread> {
    if (emails.length === 0) {
      throw new Error("Cannot build thread from empty email list");
    }

    // Sort by received date
    const sorted = [...emails].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
    );

    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];

    return {
      subject: this.normalizeSubject(earliest.subject),
      snippet: this.generateThreadSnippet(latest),
      messageCount: emails.length,
      unreadCount: emails.filter((e) => !e.isRead).length,
      hasAttachments: emails.some((e) => e.hasAttachments),
      isStarred: emails.some((e) => e.isStarred),
      isImportant: emails.some((e) => e.isImportant),
      isArchived: emails.every((e) => e.isArchived),
      isTrashed: emails.every((e) => e.isTrashed),
      lastMessageAt: latest.receivedAt,
    };
  }

  /**
   * Group emails into threads
   * Returns Map of threadId -> emails
   */
  groupEmailsIntoThreads(emails: Email[]): Map<string, Email[]> {
    const threads = new Map<string, Email[]>();

    for (const email of emails) {
      const threadId = email.threadId || email.id;

      if (!threads.has(threadId)) {
        threads.set(threadId, []);
      }

      threads.get(threadId)!.push(email);
    }

    return threads;
  }

  /**
   * Sort threads by latest message date (descending)
   */
  sortThreads(threads: EmailThread[]): EmailThread[] {
    return threads.sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
    );
  }

  /**
   * Sort emails within a thread (ascending by date)
   */
  sortThreadEmails(emails: Email[]): Email[] {
    return emails.sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
    );
  }
}

/**
 * Create default email threader instance
 */
export function createEmailThreader(options?: ThreadingOptions): EmailThreader {
  return new EmailThreader(options);
}
