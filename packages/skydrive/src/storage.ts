/**
 * Storage Provider Abstraction
 * Supports S3, MinIO, and local file storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { join } from "path";
import type { StorageConfig } from "./types.js";

export interface StorageProvider {
  upload(
    key: string,
    data: Buffer | ReadableStream,
    contentType?: string,
  ): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getDownloadUrl(key: string, expiresIn: number): Promise<string>;
  getUploadUrl(key: string, expiresIn: number): Promise<string>;
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket || "opensky-files";

    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
      forcePathStyle: !!config.endpoint, // Required for MinIO
    });
  }

  async upload(
    key: string,
    data: Buffer | ReadableStream,
    contentType?: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body:
        data instanceof Buffer ? data : await this.streamToBuffer(data as any),
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    return await this.streamToBuffer(response.Body as any);
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async getUploadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(config: StorageConfig) {
    this.basePath = config.localPath || "./storage";
  }

  async upload(key: string, data: Buffer | ReadableStream): Promise<void> {
    const filePath = join(this.basePath, key);

    // Ensure directory exists
    await fs.mkdir(join(this.basePath, ...key.split("/").slice(0, -1)), {
      recursive: true,
    });

    if (data instanceof Buffer) {
      await fs.writeFile(filePath, data);
    } else {
      const writeStream = createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        (data as any).pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    }
  }

  async download(key: string): Promise<Buffer> {
    const filePath = join(this.basePath, key);
    return await fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    await fs.unlink(filePath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = join(this.basePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getDownloadUrl(key: string, expiresIn: number): Promise<string> {
    // For local storage, return a relative path
    // In production, this would be a signed URL through the API
    return `/api/files/download/${key}`;
  }

  async getUploadUrl(key: string, expiresIn: number): Promise<string> {
    return `/api/files/upload/${key}`;
  }
}

/**
 * Factory function to create storage provider based on config
 */
export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case "s3":
    case "minio":
      return new S3StorageProvider(config);
    case "local":
      return new LocalStorageProvider(config);
    default:
      throw new Error(`Unsupported storage provider: ${config.provider}`);
  }
}
