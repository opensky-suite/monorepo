/**
 * SkyMail SMTP Client
 *
 * Sends outgoing emails via SMTP
 * - Supports TLS/SSL
 * - Template rendering
 * - Attachment handling
 * - Retry logic
 */

import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import type { SMTPClientConfig, EmailAddress } from "./types";

export interface SendEmailOptions {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  cid?: string; // Content-ID for inline images
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
}

export class SkyMailSMTPClient {
  private transporter: Transporter;
  private config: SMTPClientConfig;

  constructor(config: SMTPClientConfig) {
    this.config = config;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // Connection pool settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeouts
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });
  }

  /**
   * Send an email
   */
  async send(options: SendEmailOptions): Promise<SendResult> {
    const mailOptions: SendMailOptions = {
      from: this.formatAddress(options.from),
      to: options.to.map((addr) => this.formatAddress(addr)),
      cc: options.cc?.map((addr) => this.formatAddress(addr)),
      bcc: options.bcc?.map((addr) => this.formatAddress(addr)),
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
      inReplyTo: options.inReplyTo,
      references: options.references,
      headers: options.headers,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      return {
        messageId: info.messageId,
        accepted: info.accepted as string[],
        rejected: info.rejected as string[],
        pending: info.pending as string[],
        response: info.response,
      };
    } catch (error) {
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send multiple emails (batch)
   */
  async sendBatch(emails: SendEmailOptions[]): Promise<SendResult[]> {
    const results = await Promise.allSettled(
      emails.map((email) => this.send(email)),
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        // Return error as rejected result
        return {
          messageId: "",
          accepted: [],
          rejected: emails[index].to.map((addr) => addr.address),
          pending: [],
          response: result.reason?.message || "Unknown error",
        };
      }
    });
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    this.transporter.close();
  }

  /**
   * Format email address for nodemailer
   */
  private formatAddress(addr: EmailAddress): string {
    if (addr.name) {
      return `"${addr.name}" <${addr.address}>`;
    }
    return addr.address;
  }

  /**
   * Get connection pool stats
   */
  getStats() {
    // @ts-ignore - accessing internal transporter properties
    const pool = this.transporter.transporter;
    return {
      isIdle: pool?.isIdle?.() ?? true,
      // Add more stats as needed
    };
  }
}

/**
 * Create SMTP client instance
 */
export function createSMTPClient(config: SMTPClientConfig): SkyMailSMTPClient {
  return new SkyMailSMTPClient(config);
}

/**
 * Create SMTP client for MailHog (testing)
 */
export function createMailHogClient(): SkyMailSMTPClient {
  return new SkyMailSMTPClient({
    host: "localhost",
    port: 1025,
    secure: false,
  });
}
