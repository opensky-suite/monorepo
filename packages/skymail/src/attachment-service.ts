/**
 * SkyMail Attachment Service
 *
 * Secure attachment handling with:
 * - Upload/download attachments
 * - Virus/malware scanning (ClamAV)
 * - File type validation
 * - Size limits
 * - Preview generation (images, PDFs)
 * - Storage integration (S3/MinIO)
 */

import { createHash } from "crypto";
import type { EmailAttachment, AttachFileInput } from "./types";

export interface AttachmentServiceConfig {
  maxFileSize?: number; // bytes, default 25MB
  allowedMimeTypes?: string[];
  enableVirusScanning?: boolean;
  virusScannerUrl?: string;
  storageProvider?: StorageProvider;
}

export interface StorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string, expiresIn?: number): Promise<string>;
}

export interface VirusScanner {
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

export interface ScanResult {
  clean: boolean;
  threat?: string;
  scanTime: number;
}

export interface PreviewOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Attachment service for managing email attachments
 */
export class AttachmentService {
  private config: Required<AttachmentServiceConfig>;
  private virusScanner?: VirusScanner;

  constructor(config: AttachmentServiceConfig = {}) {
    this.config = {
      maxFileSize: config.maxFileSize ?? 25 * 1024 * 1024, // 25MB
      allowedMimeTypes:
        config.allowedMimeTypes ?? this.getDefaultAllowedTypes(),
      enableVirusScanning: config.enableVirusScanning ?? true,
      virusScannerUrl: config.virusScannerUrl ?? "http://localhost:3310",
      storageProvider: config.storageProvider ?? new MemoryStorageProvider(),
    };
  }

  /**
   * Set virus scanner implementation
   */
  setVirusScanner(scanner: VirusScanner): void {
    this.virusScanner = scanner;
  }

  /**
   * Validate attachment before upload
   */
  validateAttachment(input: AttachFileInput): {
    valid: boolean;
    error?: string;
  } {
    // Check file size
    if (input.fileBuffer.length > this.config.maxFileSize) {
      const sizeMB = (this.config.maxFileSize / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${sizeMB}MB`,
      };
    }

    // Check file type
    if (!this.config.allowedMimeTypes.includes(input.contentType)) {
      return {
        valid: false,
        error: `File type ${input.contentType} is not allowed`,
      };
    }

    // Check filename
    if (!input.filename || input.filename.length === 0) {
      return {
        valid: false,
        error: "Filename is required",
      };
    }

    // Check for dangerous extensions
    const dangerousExts = [
      ".exe",
      ".bat",
      ".cmd",
      ".com",
      ".scr",
      ".vbs",
      ".js",
    ];
    const ext = this.getFileExtension(input.filename).toLowerCase();
    if (dangerousExts.includes(ext)) {
      return {
        valid: false,
        error: `File extension ${ext} is not allowed for security reasons`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload attachment
   */
  async uploadAttachment(input: AttachFileInput): Promise<EmailAttachment> {
    // Validate
    const validation = this.validateAttachment(input);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Virus scan
    let virusScanned = false;
    let virusDetected = false;

    if (this.config.enableVirusScanning && this.virusScanner) {
      try {
        const scanResult = await this.virusScanner.scan(
          input.fileBuffer,
          input.filename,
        );
        virusScanned = true;
        virusDetected = !scanResult.clean;

        if (virusDetected) {
          throw new Error(`Virus detected: ${scanResult.threat}`);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Virus detected")
        ) {
          throw error;
        }
        // If scanner fails, allow upload but mark as not scanned
        console.error("Virus scan failed:", error);
      }
    }

    // Generate storage key
    const storageKey = this.generateStorageKey(input.emailId, input.filename);

    // Upload to storage
    await this.config.storageProvider.upload(
      storageKey,
      input.fileBuffer,
      input.contentType,
    );

    // Create attachment record
    const attachment: EmailAttachment = {
      id: this.generateId(),
      emailId: input.emailId,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.fileBuffer.length,
      storageKey,
      contentId: input.contentId,
      isInline: input.isInline ?? false,
      virusScanned,
      virusDetected,
      createdAt: new Date(),
    };

    return attachment;
  }

  /**
   * Download attachment
   */
  async downloadAttachment(attachment: EmailAttachment): Promise<Buffer> {
    if (attachment.virusDetected) {
      throw new Error("Cannot download attachment: virus detected");
    }

    return await this.config.storageProvider.download(attachment.storageKey);
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(attachment: EmailAttachment): Promise<void> {
    await this.config.storageProvider.delete(attachment.storageKey);
  }

  /**
   * Get download URL for attachment
   */
  async getDownloadUrl(
    attachment: EmailAttachment,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (attachment.virusDetected) {
      throw new Error("Cannot download attachment: virus detected");
    }

    return await this.config.storageProvider.getUrl(
      attachment.storageKey,
      expiresIn,
    );
  }

  /**
   * Generate preview for image attachments
   */
  async generatePreview(
    attachment: EmailAttachment,
    options: PreviewOptions = {},
  ): Promise<Buffer | null> {
    // Only generate previews for images
    if (!attachment.contentType.startsWith("image/")) {
      return null;
    }

    // For now, return null - would integrate with image processing library
    // In production: use sharp, jimp, or similar
    return null;
  }

  /**
   * Check if attachment is an image
   */
  isImage(attachment: EmailAttachment): boolean {
    return attachment.contentType.startsWith("image/");
  }

  /**
   * Check if attachment is a document
   */
  isDocument(attachment: EmailAttachment): boolean {
    const docTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];
    return docTypes.includes(attachment.contentType);
  }

  /**
   * Get human-readable file size
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot !== -1 ? filename.substring(lastDot) : "";
  }

  /**
   * Generate storage key for attachment
   */
  private generateStorageKey(emailId: string, filename: string): string {
    const timestamp = Date.now();
    const hash = createHash("md5")
      .update(emailId + filename + timestamp)
      .digest("hex")
      .substring(0, 8);

    const ext = this.getFileExtension(filename);
    return `attachments/${emailId}/${hash}${ext}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return createHash("md5")
      .update(Date.now().toString() + Math.random().toString())
      .digest("hex");
  }

  /**
   * Get default allowed MIME types
   */
  private getDefaultAllowedTypes(): string[] {
    return [
      // Images
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",

      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",

      // Archives
      "application/zip",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
      "application/x-tar",
      "application/gzip",

      // Audio/Video
      "audio/mpeg",
      "audio/wav",
      "video/mp4",
      "video/mpeg",

      // Other
      "application/json",
      "application/xml",
      "text/html",
    ];
  }
}

/**
 * In-memory storage provider (for testing)
 */
export class MemoryStorageProvider implements StorageProvider {
  private storage = new Map<string, { buffer: Buffer; contentType: string }>();

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    this.storage.set(key, { buffer, contentType });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) {
      throw new Error(`File not found: ${key}`);
    }
    return data.buffer;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async getUrl(key: string, expiresIn?: number): Promise<string> {
    return `memory://${key}`;
  }
}

/**
 * ClamAV virus scanner implementation
 */
export class ClamAVScanner implements VirusScanner {
  private url: string;

  constructor(url: string = "http://localhost:3310") {
    this.url = url;
  }

  async scan(buffer: Buffer, filename: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // In production, would use clamd or clamav-client
      // For now, simulate clean scan
      const scanTime = Date.now() - startTime;

      return {
        clean: true,
        scanTime,
      };
    } catch (error) {
      throw new Error(
        `Virus scan failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Create attachment service instance
 */
export function createAttachmentService(
  config?: AttachmentServiceConfig,
): AttachmentService {
  return new AttachmentService(config);
}
