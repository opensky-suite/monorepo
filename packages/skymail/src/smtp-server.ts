/**
 * SkyMail SMTP Server
 *
 * Receives incoming emails via SMTP protocol
 * - Supports authentication
 * - Parses email content
 * - Stores in database
 * - Runs spam filtering
 * - Applies user filters
 */

import { SMTPServer } from "smtp-server";
import { simpleParser, ParsedMail, AddressObject } from "mailparser";
import { EventEmitter } from "events";
import type { SMTPServerConfig, ParsedEmail, EmailAddress } from "./types";

export interface SMTPServerOptions extends SMTPServerConfig {
  onAuthenticate?: (username: string, password: string) => Promise<boolean>;
  onEmailReceived?: (email: ParsedEmail, recipient: string) => Promise<void>;
  onError?: (error: Error) => void;
}

export class SkyMailSMTPServer extends EventEmitter {
  private server: SMTPServer;
  private config: SMTPServerOptions;

  constructor(config: SMTPServerOptions) {
    super();
    this.config = config;

    this.server = new SMTPServer({
      secure: config.secure,
      authOptional: !config.authRequired,
      size: config.maxMessageSize || 25 * 1024 * 1024, // 25MB default

      // Authentication handler
      onAuth: async (auth, session, callback) => {
        if (!config.authRequired) {
          return callback(null, { user: "anonymous" });
        }

        try {
          if (!config.onAuthenticate) {
            return callback(new Error("Authentication not configured"));
          }

          const isValid = await config.onAuthenticate(
            auth.username,
            auth.password,
          );

          if (isValid) {
            callback(null, { user: auth.username });
          } else {
            callback(new Error("Invalid username or password"));
          }
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },

      // Stream handler for incoming email
      onData: async (stream, session, callback) => {
        try {
          // Parse the email
          const parsed = await simpleParser(stream);

          // Convert to our format
          const email = this.convertParsedMail(parsed);

          // Extract recipient from session
          const recipient = session.envelope.rcptTo[0]?.address || "";

          // Emit event for processing
          if (this.config.onEmailReceived) {
            await this.config.onEmailReceived(email, recipient);
          }

          this.emit("email", { email, recipient });

          callback(null, "Message accepted");
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          if (this.config.onError) {
            this.config.onError(err);
          }

          this.emit("error", err);
          callback(err);
        }
      },

      // Error handler
      onError: (error) => {
        if (this.config.onError) {
          this.config.onError(error);
        }
        this.emit("error", error);
      },
    });
  }

  /**
   * Convert mailparser output to our EmailAddress format
   */
  private parseAddresses(
    addresses: AddressObject | AddressObject[] | undefined,
  ): EmailAddress[] {
    if (!addresses) return [];

    const addressArray = Array.isArray(addresses) ? addresses : [addresses];

    return addressArray.flatMap((addr) =>
      addr.value.map((v) => ({
        address: v.address || "",
        name: v.name,
      })),
    );
  }

  /**
   * Convert ParsedMail to our ParsedEmail format
   */
  private convertParsedMail(parsed: ParsedMail): ParsedEmail {
    return {
      messageId: parsed.messageId || this.generateMessageId(),
      inReplyTo: parsed.inReplyTo,
      references: parsed.references
        ? Array.isArray(parsed.references)
          ? parsed.references
          : [parsed.references]
        : undefined,
      from: this.parseAddresses(parsed.from),
      to: this.parseAddresses(parsed.to),
      cc: this.parseAddresses(parsed.cc),
      bcc: this.parseAddresses(parsed.bcc),
      subject: parsed.subject || "(no subject)",
      text: parsed.text,
      html: parsed.html ? String(parsed.html) : undefined,
      attachments: (parsed.attachments || []).map((att) => ({
        filename: att.filename || "unnamed",
        contentType: att.contentType,
        size: att.size,
        content: att.content,
        contentId: att.contentId,
        inline: att.contentDisposition === "inline",
      })),
      date: parsed.date || new Date(),
      headers: parsed.headers,
    };
  }

  /**
   * Generate a unique Message-ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const hostname = this.config.host || "skymail.local";
    return `<${timestamp}.${random}@${hostname}>`;
  }

  /**
   * Start the SMTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          this.emit("ready", {
            host: this.config.host,
            port: this.config.port,
          });
          resolve();
        }
      });
    });
  }

  /**
   * Stop the SMTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.emit("close");
        resolve();
      });
    });
  }

  /**
   * Get server connection count
   */
  getConnectionCount(): number {
    // @ts-ignore - accessing private property
    return this.server.connections?.size || 0;
  }
}

/**
 * Create and start an SMTP server
 */
export async function createSMTPServer(
  config: SMTPServerOptions,
): Promise<SkyMailSMTPServer> {
  const server = new SkyMailSMTPServer(config);
  await server.start();
  return server;
}
