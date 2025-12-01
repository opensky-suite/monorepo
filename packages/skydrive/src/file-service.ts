/**
 * File Management Service
 * Issues: #147 (upload), #148 (download), #150 (sharing)
 */

import { Pool } from "pg";
import { nanoid } from "nanoid";
import { lookup } from "mime-types";
import type {
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  FileVersion,
  FileShare,
  SharePermission,
} from "./types.js";
import type { StorageProvider } from "./storage.js";

export class FileService {
  constructor(
    private pool: Pool,
    private storage: StorageProvider,
  ) {}

  async uploadFile(
    ownerId: string,
    fileName: string,
    data: Buffer,
    options: UploadOptions = {},
  ): Promise<FileMetadata> {
    const fileId = nanoid();
    const storageKey = `files/${ownerId}/${fileId}/${fileName}`;
    const mimeType =
      options.contentType || lookup(fileName) || "application/octet-stream";
    const size = data.length;

    // Upload to storage
    await this.storage.upload(storageKey, data, mimeType);

    // Calculate checksum (simple for now)
    const checksum = Buffer.from(data).toString("base64").substring(0, 32);

    // Get folder path
    let path = `/${fileName}`;
    if (options.folderId) {
      const folder = await this.pool.query(
        `SELECT path FROM folders WHERE id = $1`,
        [options.folderId],
      );
      if (folder.rows[0]) {
        path = `${folder.rows[0].path}/${fileName}`;
      }
    }

    // Save metadata to database
    const result = await this.pool.query<FileMetadata>(
      `INSERT INTO files (
        id, name, mime_type, size, owner_id, folder_id,
        path, storage_key, version, checksum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        fileId,
        fileName,
        mimeType,
        size,
        ownerId,
        options.folderId,
        path,
        storageKey,
        1,
        checksum,
      ],
    );

    return this.mapFileRow(result.rows[0]);
  }

  async downloadFile(
    fileId: string,
    userId: string,
    options: DownloadOptions = {},
  ): Promise<Buffer> {
    // Check permissions
    await this.checkFilePermission(fileId, userId, "view");

    // Get file metadata
    const file = await this.getFile(fileId);

    // Get storage key (for specific version if requested)
    let storageKey = file.storageKey;
    if (options.version && options.version !== file.version) {
      const versionResult = await this.pool.query<FileVersion>(
        `SELECT storage_key FROM file_versions WHERE file_id = $1 AND version = $2`,
        [fileId, options.version],
      );
      if (versionResult.rows[0]) {
        storageKey = versionResult.rows[0].storage_key;
      }
    }

    // Download from storage
    return await this.storage.download(storageKey);
  }

  async getFile(fileId: string): Promise<FileMetadata> {
    const result = await this.pool.query<FileMetadata>(
      `SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL`,
      [fileId],
    );

    if (result.rows.length === 0) {
      throw new Error("File not found");
    }

    return this.mapFileRow(result.rows[0]);
  }

  async listFiles(ownerId: string, folderId?: string): Promise<FileMetadata[]> {
    const result = await this.pool.query<FileMetadata>(
      `SELECT * FROM files 
       WHERE owner_id = $1 
         AND folder_id ${folderId ? "= $2" : "IS NULL"}
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      folderId ? [ownerId, folderId] : [ownerId],
    );

    return result.rows.map((row) => this.mapFileRow(row));
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    // Check ownership
    const file = await this.getFile(fileId);
    if (file.ownerId !== userId) {
      throw new Error("Permission denied");
    }

    // Soft delete
    await this.pool.query(
      `UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fileId],
    );
  }

  async shareFile(
    fileId: string,
    sharedBy: string,
    sharedWith: string | null,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<FileShare> {
    // Check ownership
    const file = await this.getFile(fileId);
    if (file.ownerId !== sharedBy) {
      throw new Error("Permission denied");
    }

    const result = await this.pool.query<FileShare>(
      `INSERT INTO file_shares (id, file_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (file_id, shared_with) DO UPDATE
       SET permission = $5, expires_at = $6
       RETURNING *`,
      [nanoid(), fileId, sharedBy, sharedWith, permission, expiresAt],
    );

    return this.mapFileShareRow(result.rows[0]);
  }

  async getDownloadUrl(
    fileId: string,
    userId: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    await this.checkFilePermission(fileId, userId, "view");
    const file = await this.getFile(fileId);
    return await this.storage.getDownloadUrl(file.storageKey, expiresIn);
  }

  private async checkFilePermission(
    fileId: string,
    userId: string,
    permission: "view" | "edit",
  ): Promise<void> {
    const file = await this.getFile(fileId);

    // Owner has all permissions
    if (file.ownerId === userId) {
      return;
    }

    // Check if file is shared with user
    const share = await this.pool.query<FileShare>(
      `SELECT * FROM file_shares 
       WHERE file_id = $1 
         AND (shared_with = $2 OR shared_with IS NULL)
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [fileId, userId],
    );

    if (share.rows.length === 0) {
      throw new Error("Permission denied");
    }

    const sharePermission = share.rows[0].permission;
    if (permission === "edit" && sharePermission === "view") {
      throw new Error("Permission denied");
    }
  }

  private mapFileRow(row: any): FileMetadata {
    return {
      id: row.id,
      name: row.name,
      mimeType: row.mime_type,
      size: row.size,
      ownerId: row.owner_id,
      folderId: row.folder_id,
      path: row.path,
      storageKey: row.storage_key,
      version: row.version,
      checksum: row.checksum,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private mapFileShareRow(row: any): FileShare {
    return {
      id: row.id,
      fileId: row.file_id,
      sharedBy: row.shared_by,
      sharedWith: row.shared_with,
      permission: row.permission,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
