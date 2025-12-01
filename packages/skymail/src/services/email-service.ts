/**
 * SkyMail Email Service
 *
 * High-level email operations orchestrating:
 * - Repositories (Email, Thread, Label)
 * - Threading logic
 * - Spam filtering
 * - Email sending via SMTP
 * - Filter processing
 */

import type { Pool } from "pg";
import type {
  Email,
  EmailThread,
  CreateEmailInput,
  UpdateEmailInput,
  SearchEmailsInput,
} from "../types";
import { EmailRepository } from "../repositories/email-repository";
import { ThreadRepository } from "../repositories/thread-repository";
import { LabelRepository } from "../repositories/label-repository";
import { EmailThreader } from "../email-threading";
import { SpamFilter } from "../spam-filter";
import { SkyMailSMTPClient } from "../smtp-client";

export interface EmailServiceConfig {
  pool: Pool;
  smtpClient?: SkyMailSMTPClient;
  spamFilter?: SpamFilter;
}

export class EmailService {
  private emailRepo: EmailRepository;
  private threadRepo: ThreadRepository;
  private labelRepo: LabelRepository;
  private threader: EmailThreader;
  private spamFilter?: SpamFilter;
  private smtpClient?: SkyMailSMTPClient;

  constructor(config: EmailServiceConfig) {
    this.emailRepo = new EmailRepository(config.pool);
    this.threadRepo = new ThreadRepository(config.pool);
    this.labelRepo = new LabelRepository(config.pool);
    this.threader = new EmailThreader();
    this.spamFilter = config.spamFilter;
    this.smtpClient = config.smtpClient;
  }

  /**
   * Create a new email (draft or to send)
   */
  async createEmail(input: CreateEmailInput): Promise<Email> {
    // Create email
    const email = await this.emailRepo.create(input);

    // Run spam filter if enabled
    if (this.spamFilter && !input.isDraft) {
      const spamResult = await this.spamFilter.calculateSpamScore(email);

      if (spamResult.isSpam) {
        await this.emailRepo.update(email.id, input.userId, {
          isSpam: true,
        });
      }
    }

    // Find or create thread
    await this.assignToThread(email);

    // Auto-apply labels (Inbox for received, Sent for sent, Drafts for drafts)
    await this.autoApplyLabels(email);

    return email;
  }

  /**
   * Get email by ID
   */
  async getEmail(emailId: string, userId: string): Promise<Email | null> {
    return await this.emailRepo.findById(emailId, userId);
  }

  /**
   * List emails with filtering
   */
  async listEmails(
    userId: string,
    filters: SearchEmailsInput,
  ): Promise<{ emails: Email[]; total: number }> {
    return await this.emailRepo.find(filters);
  }

  /**
   * Update email (flags, labels, etc.)
   */
  async updateEmail(
    emailId: string,
    userId: string,
    updates: UpdateEmailInput,
  ): Promise<Email> {
    const email = await this.emailRepo.update(emailId, userId, updates);

    // Update thread statistics if email state changed
    if (email.threadId) {
      await this.threadRepo.updateStatistics(email.threadId, userId);
    }

    return email;
  }

  /**
   * Delete email (permanent)
   */
  async deleteEmail(emailId: string, userId: string): Promise<void> {
    const email = await this.emailRepo.findById(emailId, userId);

    if (!email) {
      throw new Error("Email not found");
    }

    await this.emailRepo.delete(emailId, userId);

    // Update thread statistics
    if (email.threadId) {
      await this.threadRepo.updateStatistics(email.threadId, userId);
    }
  }

  /**
   * Send email via SMTP
   */
  async sendEmail(emailId: string): Promise<void> {
    if (!this.smtpClient) {
      throw new Error("SMTP client not configured");
    }

    const email = await this.emailRepo.findById(emailId, email.userId);

    if (!email) {
      throw new Error("Email not found");
    }

    if (email.isSent) {
      throw new Error("Email already sent");
    }

    // Send via SMTP
    await this.smtpClient.send({
      from: { address: email.fromAddress, name: email.fromName },
      to: email.toAddresses,
      cc: email.ccAddresses,
      bcc: email.bccAddresses,
      subject: email.subject,
      text: email.bodyText,
      html: email.bodyHtml,
      inReplyTo: email.inReplyTo,
      references: email.references,
    });

    // Mark as sent
    await this.emailRepo.update(emailId, email.userId, {
      // @ts-ignore - isSent not in UpdateEmailInput but exists in Email
      isSent: true,
    });
  }

  /**
   * Get thread with all emails
   */
  async getThread(
    threadId: string,
    userId: string,
  ): Promise<{
    thread: EmailThread;
    emails: Email[];
  }> {
    const thread = await this.threadRepo.findById(threadId, userId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    const emailRows = await this.threadRepo.getThreadEmails(threadId, userId);
    const emails = emailRows.map((row) => this.emailRepo["mapRowToEmail"](row));

    return { thread, emails };
  }

  /**
   * List threads
   */
  async listThreads(
    userId: string,
    options: {
      isArchived?: boolean;
      isTrashed?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ threads: EmailThread[]; total: number }> {
    return await this.threadRepo.findAll(userId, options);
  }

  /**
   * Search emails (full-text)
   */
  async searchEmails(
    userId: string,
    query: string,
    limit?: number,
  ): Promise<Email[]> {
    return await this.emailRepo.search(userId, query, limit);
  }

  /**
   * Add label to email
   */
  async addLabelToEmail(
    emailId: string,
    labelId: string,
    userId: string,
  ): Promise<void> {
    // Verify email belongs to user
    const email = await this.emailRepo.findById(emailId, userId);
    if (!email) {
      throw new Error("Email not found");
    }

    // Verify label belongs to user
    const label = await this.labelRepo.findById(labelId, userId);
    if (!label) {
      throw new Error("Label not found");
    }

    await this.labelRepo.addToEmail(emailId, labelId);
  }

  /**
   * Remove label from email
   */
  async removeLabelFromEmail(
    emailId: string,
    labelId: string,
    userId: string,
  ): Promise<void> {
    await this.labelRepo.removeFromEmail(emailId, labelId);
  }

  /**
   * Get labels for email
   */
  async getEmailLabels(emailId: string): Promise<any[]> {
    return await this.labelRepo.getEmailLabels(emailId);
  }

  /**
   * Bulk update emails
   */
  async bulkUpdateEmails(
    emailIds: string[],
    userId: string,
    updates: UpdateEmailInput,
  ): Promise<void> {
    await this.emailRepo.bulkUpdate(emailIds, userId, updates);

    // Update thread statistics for affected threads
    const threads = new Set<string>();

    for (const id of emailIds) {
      const email = await this.emailRepo.findById(id, userId);
      if (email?.threadId) {
        threads.add(email.threadId);
      }
    }

    for (const threadId of threads) {
      await this.threadRepo.updateStatistics(threadId, userId);
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.emailRepo.getUnreadCount(userId);
  }

  /**
   * Mark email as read
   */
  async markAsRead(emailId: string, userId: string): Promise<void> {
    await this.updateEmail(emailId, userId, { isRead: true });
  }

  /**
   * Mark email as starred
   */
  async markAsStarred(emailId: string, userId: string): Promise<void> {
    await this.updateEmail(emailId, userId, { isStarred: true });
  }

  /**
   * Archive email
   */
  async archiveEmail(emailId: string, userId: string): Promise<void> {
    await this.updateEmail(emailId, userId, { isArchived: true });
  }

  /**
   * Trash email
   */
  async trashEmail(emailId: string, userId: string): Promise<void> {
    await this.updateEmail(emailId, userId, { isTrashed: true });
  }

  /**
   * Mark as spam
   */
  async markAsSpam(emailId: string, userId: string): Promise<void> {
    const email = await this.emailRepo.findById(emailId, userId);

    if (email && this.spamFilter) {
      // Train spam filter
      this.spamFilter.trainSpam(email);
    }

    await this.updateEmail(emailId, userId, { isSpam: true });
  }

  /**
   * Mark as not spam
   */
  async markAsNotSpam(emailId: string, userId: string): Promise<void> {
    const email = await this.emailRepo.findById(emailId, userId);

    if (email && this.spamFilter) {
      // Untrain spam filter and train as ham
      this.spamFilter.untrainSpam(email);
      this.spamFilter.trainHam(email);
    }

    await this.updateEmail(emailId, userId, { isSpam: false });
  }

  /**
   * Assign email to thread (or create new thread)
   */
  private async assignToThread(email: Email): Promise<void> {
    // Get user's existing emails for threading
    const existingEmails = await this.emailRepo.find({
      userId: email.userId,
      limit: 100, // Last 100 emails for threading context
    });

    // Find matching thread
    const threadId = await this.threader.findThreadForEmail(
      email,
      existingEmails.emails,
    );

    if (threadId) {
      // Update email with thread ID
      await this.emailRepo.update(email.id, email.userId, {
        // @ts-ignore - threadId not in UpdateEmailInput
        threadId,
      });

      // Update thread statistics
      await this.threadRepo.updateStatistics(threadId, email.userId);
    } else {
      // Create new thread
      const thread = await this.threadRepo.create({
        userId: email.userId,
        subject: this.threader.normalizeSubject(email.subject),
        snippet: this.threader.generateThreadSnippet(email),
      });

      // Update email with new thread ID
      await this.emailRepo.update(email.id, email.userId, {
        // @ts-ignore
        threadId: thread.id,
      });

      // Update thread statistics
      await this.threadRepo.updateStatistics(thread.id, email.userId);
    }
  }

  /**
   * Auto-apply system labels to email
   */
  private async autoApplyLabels(email: Email): Promise<void> {
    let labelName: string;

    if (email.isDraft) {
      labelName = "Drafts";
    } else if (email.isSent) {
      labelName = "Sent";
    } else {
      labelName = "Inbox";
    }

    const label = await this.labelRepo.findByName(labelName, email.userId);

    if (label) {
      await this.labelRepo.addToEmail(email.id, label.id);
    }
  }
}

/**
 * Create email service instance
 */
export function createEmailService(config: EmailServiceConfig): EmailService {
  return new EmailService(config);
}
