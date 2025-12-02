/**
 * Version Service for SkyDrive
 * Handles file version history, restore, and comparison
 *
 * Features:
 * - Create version snapshots on file update
 * - List version history
 * - Restore previous versions
 * - Compare version metadata
 * - Delete specific versions
 */

import { Pool } from "pg";
import { createHash } from "crypto";
import type { FileVersion, FileMetadata } from "./types.js";
import type { StorageProvider } from "./storage.js";

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  sizeChange: number;
  checksumMatch: boolean;
}

export class VersionService {
  constructor(
    private pool: Pool,
    private storage: StorageProvider,
  ) {}

  /**
   * Create a new version of a file
   * Called automatically when file content is updated
   */
  async createVersion(
    fileId: string,
    userId: string,
    newData: Buffer,
  ): Promise<FileVersion> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Get current file
      const fileResult = await client.query(
        `SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL`,
        [fileId],
      );

      if (fileResult.rows.length === 0) {
        throw new Error("File not found");
      }

      const file = fileResult.rows[0];

      // Verify ownership
      if (file.owner_id !== userId) {
        throw new Error("Permission denied");
      }

      const newVersion = file.version + 1;
      const newSize = newData.length;
      const newChecksum = this.calculateChecksum(newData);
      const newStorageKey = `files/${file.owner_id}/${fileId}/v${newVersion}/${file.name}`;

      // Save current version to history
      await client.query(
        `INSERT INTO file_versions (file_id, version, size, storage_key, checksum, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          fileId,
          file.version,
          file.size,
          file.storage_key,
          file.checksum,
          userId,
        ],
      );

      // Upload new version to storage
      await this.storage.upload(newStorageKey, newData, file.mime_type);

      // Update file with new version
      const updateResult = await client.query(
        `UPDATE files
         SET version = $1, size = $2, storage_key = $3, checksum = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [newVersion, newSize, newStorageKey, newChecksum, fileId],
      );

      await client.query("COMMIT");

      // Return the version record
      return {
        id: crypto.randomUUID(),
        fileId,
        version: newVersion,
        size: newSize,
        storageKey: newStorageKey,
        checksum: newChecksum,
        createdBy: userId,
        createdAt: new Date(),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get version history for a file
   */
  async getVersionHistory(
    fileId: string,
    userId: string,
  ): Promise<FileVersion[]> {
    // Verify access
    await this.verifyFileAccess(fileId, userId);

    // Get all versions including current
    const result = await this.pool.query(
      `SELECT id, file_id, version, size, storage_key, checksum, created_by, created_at
       FROM file_versions
       WHERE file_id = $1
       ORDER BY version DESC`,
      [fileId],
    );

    return result.rows.map((row) => this.mapVersionRow(row));
  }

  /**
   * Get a specific version
   */
  async getVersion(
    fileId: string,
    versionNumber: number,
    userId: string,
  ): Promise<FileVersion> {
    await this.verifyFileAccess(fileId, userId);

    const result = await this.pool.query(
      `SELECT * FROM file_versions WHERE file_id = $1 AND version = $2`,
      [fileId, versionNumber],
    );

    if (result.rows.length === 0) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    return this.mapVersionRow(result.rows[0]);
  }

  /**
   * Download a specific version
   */
  async downloadVersion(
    fileId: string,
    versionNumber: number,
    userId: string,
  ): Promise<Buffer> {
    const version = await this.getVersion(fileId, versionNumber, userId);
    return this.storage.download(version.storageKey);
  }

  /**
   * Restore a previous version (makes it the current version)
   */
  async restoreVersion(
    fileId: string,
    versionNumber: number,
    userId: string,
  ): Promise<FileMetadata> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Verify ownership
      const fileResult = await client.query(
        `SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
        [fileId, userId],
      );

      if (fileResult.rows.length === 0) {
        throw new Error("File not found or access denied");
      }

      const file = fileResult.rows[0];

      // Get the version to restore
      const versionResult = await client.query(
        `SELECT * FROM file_versions WHERE file_id = $1 AND version = $2`,
        [fileId, versionNumber],
      );

      if (versionResult.rows.length === 0) {
        throw new Error(`Version ${versionNumber} not found`);
      }

      const versionToRestore = versionResult.rows[0];

      // Save current version to history first
      await client.query(
        `INSERT INTO file_versions (file_id, version, size, storage_key, checksum, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          fileId,
          file.version,
          file.size,
          file.storage_key,
          file.checksum,
          userId,
        ],
      );

      const newVersion = file.version + 1;

      // Update file with restored version's content
      const updateResult = await client.query(
        `UPDATE files
         SET version = $1, size = $2, storage_key = $3, checksum = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [
          newVersion,
          versionToRestore.size,
          versionToRestore.storage_key,
          versionToRestore.checksum,
          fileId,
        ],
      );

      await client.query("COMMIT");
      return this.mapFileRow(updateResult.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a specific version (cannot delete current version)
   */
  async deleteVersion(
    fileId: string,
    versionNumber: number,
    userId: string,
  ): Promise<void> {
    // Verify ownership
    const fileResult = await this.pool.query(
      `SELECT version, owner_id FROM files WHERE id = $1 AND deleted_at IS NULL`,
      [fileId],
    );

    if (fileResult.rows.length === 0) {
      throw new Error("File not found");
    }

    const file = fileResult.rows[0];

    if (file.owner_id !== userId) {
      throw new Error("Permission denied");
    }

    if (file.version === versionNumber) {
      throw new Error("Cannot delete current version");
    }

    // Get version to delete (for storage cleanup)
    const versionResult = await this.pool.query(
      `SELECT storage_key FROM file_versions WHERE file_id = $1 AND version = $2`,
      [fileId, versionNumber],
    );

    if (versionResult.rows.length === 0) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    const version = versionResult.rows[0];

    // Delete from database
    await this.pool.query(
      `DELETE FROM file_versions WHERE file_id = $1 AND version = $2`,
      [fileId, versionNumber],
    );

    // Delete from storage
    try {
      await this.storage.delete(version.storage_key);
    } catch (error) {
      // Log but don't fail - DB is source of truth
      console.error(
        `Failed to delete storage for version ${versionNumber}:`,
        error,
      );
    }
  }

  /**
   * Compare two versions (metadata only)
   */
  async compareVersions(
    fileId: string,
    fromVersion: number,
    toVersion: number,
    userId: string,
  ): Promise<VersionDiff> {
    await this.verifyFileAccess(fileId, userId);

    const result = await this.pool.query(
      `SELECT version, size, checksum FROM file_versions 
       WHERE file_id = $1 AND version IN ($2, $3)
       UNION
       SELECT version, size, checksum FROM files
       WHERE id = $1 AND version IN ($2, $3)`,
      [fileId, fromVersion, toVersion],
    );

    const versions = new Map(result.rows.map((r) => [r.version, r]));
    const from = versions.get(fromVersion);
    const to = versions.get(toVersion);

    if (!from || !to) {
      throw new Error("One or both versions not found");
    }

    return {
      fromVersion,
      toVersion,
      sizeChange: to.size - from.size,
      checksumMatch: from.checksum === to.checksum,
    };
  }

  /**
   * Get total storage used by all versions
   */
  async getVersionStorageUsage(
    fileId: string,
    userId: string,
  ): Promise<number> {
    await this.verifyFileAccess(fileId, userId);

    const result = await this.pool.query(
      `SELECT COALESCE(SUM(size), 0) as total FROM file_versions WHERE file_id = $1`,
      [fileId],
    );

    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Prune old versions, keeping only the N most recent
   */
  async pruneVersions(
    fileId: string,
    userId: string,
    keepCount: number,
  ): Promise<number> {
    // Verify ownership
    const fileResult = await this.pool.query(
      `SELECT owner_id FROM files WHERE id = $1 AND deleted_at IS NULL`,
      [fileId],
    );

    if (
      fileResult.rows.length === 0 ||
      fileResult.rows[0].owner_id !== userId
    ) {
      throw new Error("File not found or access denied");
    }

    // Get versions to delete
    const versionsResult = await this.pool.query(
      `SELECT id, storage_key FROM file_versions
       WHERE file_id = $1
       ORDER BY version DESC
       OFFSET $2`,
      [fileId, keepCount],
    );

    let deletedCount = 0;

    for (const version of versionsResult.rows) {
      await this.pool.query(`DELETE FROM file_versions WHERE id = $1`, [
        version.id,
      ]);

      try {
        await this.storage.delete(version.storage_key);
      } catch (error) {
        console.error(`Failed to delete storage:`, error);
      }

      deletedCount++;
    }

    return deletedCount;
  }

  // Helper methods

  private async verifyFileAccess(
    fileId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM files f
       WHERE f.id = $1 AND f.deleted_at IS NULL
       AND (
         f.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM file_shares fs
           WHERE fs.file_id = f.id
           AND fs.shared_with = $2
           AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
         )
       )`,
      [fileId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("File not found or access denied");
    }
  }

  private calculateChecksum(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }

  private mapVersionRow(row: any): FileVersion {
    return {
      id: row.id,
      fileId: row.file_id,
      version: row.version,
      size: parseInt(row.size, 10),
      storageKey: row.storage_key,
      checksum: row.checksum,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private mapFileRow(row: any): FileMetadata {
    return {
      id: row.id,
      name: row.name,
      mimeType: row.mime_type,
      size: parseInt(row.size, 10),
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
}
