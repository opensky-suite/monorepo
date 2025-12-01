/**
 * SkyMail Email API Controller
 *
 * RESTful API endpoints for email operations:
 * - GET /emails - List emails
 * - GET /emails/:id - Get email by ID
 * - POST /emails - Send email
 * - PUT /emails/:id - Update email (flags, labels)
 * - DELETE /emails/:id - Delete email
 * - POST /emails/:id/reply - Reply to email
 * - POST /emails/:id/forward - Forward email
 */

import type {
  Email,
  CreateEmailInput,
  UpdateEmailInput,
  SearchEmailsInput,
} from "../types";

export interface APIRequest {
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  user?: { id: string; email: string };
}

export interface APIResponse {
  status: number;
  data?: any;
  error?: string;
}

export interface EmailService {
  listEmails(
    userId: string,
    filters: SearchEmailsInput,
  ): Promise<{ emails: Email[]; total: number }>;
  getEmail(emailId: string, userId: string): Promise<Email | null>;
  createEmail(input: CreateEmailInput): Promise<Email>;
  updateEmail(
    emailId: string,
    userId: string,
    updates: UpdateEmailInput,
  ): Promise<Email>;
  deleteEmail(emailId: string, userId: string): Promise<void>;
  sendEmail(emailId: string): Promise<void>;
}

/**
 * Email API Controller
 */
export class EmailController {
  constructor(private emailService: EmailService) {}

  /**
   * GET /api/emails
   * List emails with optional filtering
   */
  async listEmails(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const filters: SearchEmailsInput = {
        userId: req.user.id,
        query: req.query.q,
        labelIds: req.query.labels ? req.query.labels.split(",") : undefined,
        isRead:
          req.query.read !== undefined ? req.query.read === "true" : undefined,
        isStarred: req.query.starred === "true",
        hasAttachment: req.query.hasAttachment === "true",
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await this.emailService.listEmails(req.user.id, filters);

      return {
        status: 200,
        data: {
          emails: result.emails,
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
        },
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * GET /api/emails/:id
   * Get email by ID
   */
  async getEmail(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const email = await this.emailService.getEmail(
        req.params.id,
        req.user.id,
      );

      if (!email) {
        return { status: 404, error: "Email not found" };
      }

      return {
        status: 200,
        data: email,
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * POST /api/emails
   * Create and optionally send email
   */
  async createEmail(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      // Validate request body
      const validation = this.validateEmailInput(req.body);
      if (!validation.valid) {
        return { status: 400, error: validation.error };
      }

      const input: CreateEmailInput = {
        userId: req.user.id,
        fromAddress: req.body.from || req.user.email,
        fromName: req.body.fromName,
        toAddresses: req.body.to,
        ccAddresses: req.body.cc || [],
        bccAddresses: req.body.bcc || [],
        subject: req.body.subject,
        bodyText: req.body.text,
        bodyHtml: req.body.html,
        isDraft: req.body.draft !== false,
        inReplyTo: req.body.inReplyTo,
        references: req.body.references,
      };

      const email = await this.emailService.createEmail(input);

      // Send if requested
      if (req.body.send === true) {
        await this.emailService.sendEmail(email.id);
      }

      return {
        status: 201,
        data: email,
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * PUT /api/emails/:id
   * Update email (flags, labels)
   */
  async updateEmail(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const updates: UpdateEmailInput = {};

      if (req.body.isRead !== undefined) updates.isRead = req.body.isRead;
      if (req.body.isStarred !== undefined)
        updates.isStarred = req.body.isStarred;
      if (req.body.isImportant !== undefined)
        updates.isImportant = req.body.isImportant;
      if (req.body.isArchived !== undefined)
        updates.isArchived = req.body.isArchived;
      if (req.body.isTrashed !== undefined)
        updates.isTrashed = req.body.isTrashed;
      if (req.body.isSpam !== undefined) updates.isSpam = req.body.isSpam;
      if (req.body.snoozedUntil !== undefined) {
        updates.snoozedUntil = req.body.snoozedUntil
          ? new Date(req.body.snoozedUntil)
          : null;
      }

      const email = await this.emailService.updateEmail(
        req.params.id,
        req.user.id,
        updates,
      );

      return {
        status: 200,
        data: email,
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * DELETE /api/emails/:id
   * Delete email (move to trash or permanent delete)
   */
  async deleteEmail(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const permanent = req.query.permanent === "true";

      if (permanent) {
        await this.emailService.deleteEmail(req.params.id, req.user.id);
      } else {
        // Move to trash
        await this.emailService.updateEmail(req.params.id, req.user.id, {
          isTrashed: true,
        });
      }

      return {
        status: 204,
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * POST /api/emails/:id/reply
   * Reply to email
   */
  async replyToEmail(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const originalEmail = await this.emailService.getEmail(
        req.params.id,
        req.user.id,
      );
      if (!originalEmail) {
        return { status: 404, error: "Email not found" };
      }

      // Build reply
      const replyInput: CreateEmailInput = {
        userId: req.user.id,
        fromAddress: req.user.email,
        toAddresses: [
          { address: originalEmail.fromAddress, name: originalEmail.fromName },
        ],
        ccAddresses: req.body.replyAll ? originalEmail.ccAddresses : [],
        subject: `Re: ${originalEmail.subject}`,
        bodyText: req.body.text,
        bodyHtml: req.body.html,
        inReplyTo: originalEmail.messageId,
        references: this.buildReferences(originalEmail),
        isDraft: req.body.draft !== false,
      };

      const email = await this.emailService.createEmail(replyInput);

      if (req.body.send === true) {
        await this.emailService.sendEmail(email.id);
      }

      return {
        status: 201,
        data: email,
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * POST /api/emails/:id/forward
   * Forward email
   */
  async forwardEmail(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const originalEmail = await this.emailService.getEmail(
        req.params.id,
        req.user.id,
      );
      if (!originalEmail) {
        return { status: 404, error: "Email not found" };
      }

      if (!req.body.to || req.body.to.length === 0) {
        return { status: 400, error: "Recipients required" };
      }

      // Build forward
      const forwardInput: CreateEmailInput = {
        userId: req.user.id,
        fromAddress: req.user.email,
        toAddresses: req.body.to,
        ccAddresses: req.body.cc || [],
        subject: `Fwd: ${originalEmail.subject}`,
        bodyText: this.buildForwardBody(originalEmail, req.body.text),
        bodyHtml: this.buildForwardBodyHtml(originalEmail, req.body.html),
        isDraft: req.body.draft !== false,
      };

      const email = await this.emailService.createEmail(forwardInput);

      if (req.body.send === true) {
        await this.emailService.sendEmail(email.id);
      }

      return {
        status: 201,
        data: email,
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * POST /api/emails/search
   * Advanced email search
   */
  async searchEmails(req: APIRequest): Promise<APIResponse> {
    try {
      if (!req.user) {
        return { status: 401, error: "Unauthorized" };
      }

      const filters: SearchEmailsInput = {
        userId: req.user.id,
        query: req.body.query,
        fromAddress: req.body.from,
        toAddress: req.body.to,
        dateFrom: req.body.dateFrom ? new Date(req.body.dateFrom) : undefined,
        dateTo: req.body.dateTo ? new Date(req.body.dateTo) : undefined,
        labelIds: req.body.labels,
        isRead: req.body.isRead,
        isStarred: req.body.isStarred,
        hasAttachment: req.body.hasAttachment,
        limit: req.body.limit || 50,
        offset: req.body.offset || 0,
      };

      const result = await this.emailService.listEmails(req.user.id, filters);

      return {
        status: 200,
        data: {
          emails: result.emails,
          total: result.total,
        },
      };
    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  }

  /**
   * Validate email input
   */
  private validateEmailInput(body: any): { valid: boolean; error?: string } {
    if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
      return { valid: false, error: "Recipients (to) required" };
    }

    if (!body.subject || typeof body.subject !== "string") {
      return { valid: false, error: "Subject required" };
    }

    if (!body.text && !body.html) {
      return { valid: false, error: "Email body (text or html) required" };
    }

    return { valid: true };
  }

  /**
   * Build References header for reply
   */
  private buildReferences(original: Email): string {
    const refs = [original.messageId];
    if (original.references) {
      refs.unshift(original.references);
    }
    return refs.join(" ");
  }

  /**
   * Build forward body (plain text)
   */
  private buildForwardBody(original: Email, newText?: string): string {
    const header = `\n\n---------- Forwarded message ----------\nFrom: ${original.fromName || original.fromAddress}\nDate: ${original.receivedAt.toLocaleString()}\nSubject: ${original.subject}\nTo: ${original.toAddresses.map((a) => a.address).join(", ")}\n\n`;
    return (newText || "") + header + (original.bodyText || "");
  }

  /**
   * Build forward body (HTML)
   */
  private buildForwardBodyHtml(
    original: Email,
    newHtml?: string,
  ): string | undefined {
    if (!original.bodyHtml) return undefined;

    const header = `<br><br><div class="forwarded-message"><p><b>---------- Forwarded message ----------</b></p><p><b>From:</b> ${original.fromName || original.fromAddress}<br><b>Date:</b> ${original.receivedAt.toLocaleString()}<br><b>Subject:</b> ${original.subject}<br><b>To:</b> ${original.toAddresses.map((a) => a.address).join(", ")}</p></div>`;
    return (newHtml || "") + header + original.bodyHtml;
  }
}

/**
 * Create email controller instance
 */
export function createEmailController(
  emailService: EmailService,
): EmailController {
  return new EmailController(emailService);
}
