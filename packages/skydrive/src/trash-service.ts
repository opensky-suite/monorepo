/**
 * Trash Service for SkyDrive
 * Handles soft-deleted files and folders with recovery
 *
 * Features:
 * - List trashed items
 * - Restore files/folders
 * - Permanent delete
 * - Auto-cleanup after 30 days
 */

import { Pool } from "pg";
import type { FileMetadata, FolderMetadata } from "./types.js";

export interface TrashedItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size?: number; // For files
  deletedAt: Date;
  originalPath: string;
  ownerId: string;
}

export class TrashService {
  constructor(private pool: Pool) {}

  /**
   * List all trashed items for a user
   */
  async listTrashed(userId: string): Promise<TrashedItem[]> {
    const result = await this.pool.query(
      `SELECT 
         'file' as type,
         id,
         name,
         size,
         deleted_at,
         path as original_path,
         owner_id
       FROM files
       WHERE owner_id = $1 AND deleted_at IS NOT NULL
       UNION ALL
       SELECT 
         'folder' as type,
         id,
         name,
         NULL as size,
         deleted_at,
         path as original_path,
         owner_id
       FROM folders
       WHERE owner_id = $1 AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as "file" | "folder",
      size: row.size,
      deletedAt: row.deleted_at,
      originalPath: row.original_path,
      ownerId: row.owner_id,
    }));
  }

  /**
   * Restore a file from trash
   */
  async restoreFile(fileId: string, userId: string): Promise<FileMetadata> {
    // Verify ownership
    const file = await this.pool.query(
      `SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL`,
      [fileId, userId],
    );

    if (file.rows.length === 0) {
      throw new Error("File not found in trash or access denied");
    }

    // Check if parent folder exists (if any)
    const fileData = file.rows[0];
    if (fileData.folder_id) {
      const folder = await this.pool.query(
        `SELECT deleted_at FROM folders WHERE id = $1`,
        [fileData.folder_id],
      );

      if (folder.rows.length === 0 || folder.rows[0].deleted_at !== null) {
        throw new Error(
          "Cannot restore: parent folder is deleted or doesn't exist",
        );
      }
    }

    // Restore file
    const result = await this.pool.query(
      `UPDATE files 
       SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [fileId],
    );

    return this.mapFileRow(result.rows[0]);
  }

  /**
   * Restore a folder from trash (and optionally all contents)
   */
  async restoreFolder(
    folderId: string,
    userId: string,
    restoreContents: boolean = true,
  ): Promise<FolderMetadata> {
    // Verify ownership
    const folder = await this.pool.query(
      `SELECT * FROM folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL`,
      [folderId, userId],
    );

    if (folder.rows.length === 0) {
      throw new Error("Folder not found in trash or access denied");
    }

    const folderData = folder.rows[0];

    // Check if parent folder exists (if any)
    if (folderData.parent_id) {
      const parent = await this.pool.query(
        `SELECT deleted_at FROM folders WHERE id = $1`,
        [folderData.parent_id],
      );

      if (parent.rows.length === 0 || parent.rows[0].deleted_at !== null) {
        throw new Error(
          "Cannot restore: parent folder is deleted or doesn't exist",
        );
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Restore folder
      const result = await client.query(
        `UPDATE folders 
         SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [folderId],
      );

      if (restoreContents) {
        // Restore all files in this folder
        await client.query(
          `UPDATE files
           SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE folder_id = $1 AND deleted_at IS NOT NULL`,
          [folderId],
        );

        // Restore all subfolders recursively
        await this.restoreSubfoldersRecursive(client, folderId);
      }

      await client.query("COMMIT");
      return this.mapFolderRow(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Permanently delete a file (cannot be recovered)
   */
  async permanentlyDeleteFile(fileId: string, userId: string): Promise<void> {
    // Verify ownership and that it's in trash
    const file = await this.pool.query(
      `SELECT storage_key FROM files 
       WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL`,
      [fileId, userId],
    );

    if (file.rows.length === 0) {
      throw new Error("File not found in trash or access denied");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Delete file versions
      await client.query(`DELETE FROM file_versions WHERE file_id = $1`, [
        fileId,
      ]);

      // Delete file shares
      await client.query(`DELETE FROM file_shares WHERE file_id = $1`, [
        fileId,
      ]);

      // Delete file record
      await client.query(`DELETE FROM files WHERE id = $1`, [fileId]);

      await client.query("COMMIT");

      // NOTE: Actual storage deletion should happen here
      // For now, we just delete the database record
      // In production, integrate with StorageProvider to delete file.storage_key
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Permanently delete a folder and all contents (cannot be recovered)
   */
  async permanentlyDeleteFolder(
    folderId: string,
    userId: string,
  ): Promise<void> {
    // Verify ownership and that it's in trash
    const folder = await this.pool.query(
      `SELECT * FROM folders 
       WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL`,
      [folderId, userId],
    );

    if (folder.rows.length === 0) {
      throw new Error("Folder not found in trash or access denied");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Get all files in this folder (recursively via path prefix)
      const folderPath = folder.rows[0].path;
      const files = await client.query(
        `SELECT id FROM files WHERE path LIKE $1 AND deleted_at IS NOT NULL`,
        [`${folderPath}%`],
      );

      // Permanently delete all files
      for (const file of files.rows) {
        await client.query(`DELETE FROM file_versions WHERE file_id = $1`, [
          file.id,
        ]);
        await client.query(`DELETE FROM file_shares WHERE file_id = $1`, [
          file.id,
        ]);
        await client.query(`DELETE FROM files WHERE id = $1`, [file.id]);
      }

      // Get all subfolders
      const subfolders = await client.query(
        `SELECT id FROM folders WHERE path LIKE $1 AND deleted_at IS NOT NULL`,
        [`${folderPath}%`],
      );

      // Delete folder shares for all subfolders
      for (const subfolder of subfolders.rows) {
        await client.query(`DELETE FROM folder_shares WHERE folder_id = $1`, [
          subfolder.id,
        ]);
      }

      // Delete all subfolders
      await client.query(
        `DELETE FROM folders WHERE path LIKE $1 AND deleted_at IS NOT NULL`,
        [`${folderPath}%`],
      );

      // Delete the folder itself
      await client.query(`DELETE FROM folder_shares WHERE folder_id = $1`, [
        folderId,
      ]);
      await client.query(`DELETE FROM folders WHERE id = $1`, [folderId]);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Empty entire trash for a user
   */
  async emptyTrash(userId: string): Promise<void> {
    const trashed = await this.listTrashed(userId);

    for (const item of trashed) {
      if (item.type === "file") {
        await this.permanentlyDeleteFile(item.id, userId);
      } else {
        await this.permanentlyDeleteFolder(item.id, userId);
      }
    }
  }

  /**
   * Auto-cleanup: Delete items older than 30 days
   * Should be run as a scheduled job
   */
  async autoCleanup(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Get old files
      const oldFiles = await client.query(
        `SELECT id, owner_id FROM files 
         WHERE deleted_at < $1`,
        [thirtyDaysAgo],
      );

      let deletedCount = 0;

      // Permanently delete each file
      for (const file of oldFiles.rows) {
        try {
          await this.permanentlyDeleteFile(file.id, file.owner_id);
          deletedCount++;
        } catch (error) {
          // Log error but continue with other files
          console.error(`Failed to delete file ${file.id}:`, error);
        }
      }

      // Get old folders
      const oldFolders = await client.query(
        `SELECT id, owner_id FROM folders 
         WHERE deleted_at < $1`,
        [thirtyDaysAgo],
      );

      // Permanently delete each folder
      for (const folder of oldFolders.rows) {
        try {
          await this.permanentlyDeleteFolder(folder.id, folder.owner_id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete folder ${folder.id}:`, error);
        }
      }

      await client.query("COMMIT");
      return deletedCount;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get trash statistics for a user
   */
  async getTrashStats(userId: string): Promise<{
    fileCount: number;
    folderCount: number;
    totalSize: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
         COUNT(CASE WHEN type = 'file' THEN 1 END) as file_count,
         COUNT(CASE WHEN type = 'folder' THEN 1 END) as folder_count,
         COALESCE(SUM(CASE WHEN type = 'file' THEN size ELSE 0 END), 0) as total_size
       FROM (
         SELECT 'file' as type, size FROM files 
         WHERE owner_id = $1 AND deleted_at IS NOT NULL
         UNION ALL
         SELECT 'folder' as type, 0 as size FROM folders 
         WHERE owner_id = $1 AND deleted_at IS NOT NULL
       ) items`,
      [userId],
    );

    return {
      fileCount: parseInt(result.rows[0].file_count, 10),
      folderCount: parseInt(result.rows[0].folder_count, 10),
      totalSize: parseInt(result.rows[0].total_size, 10),
    };
  }

  // Helper methods

  private async restoreSubfoldersRecursive(
    client: any,
    parentId: string,
  ): Promise<void> {
    // Get immediate children
    const subfolders = await client.query(
      `SELECT id FROM folders 
       WHERE parent_id = $1 AND deleted_at IS NOT NULL`,
      [parentId],
    );

    for (const folder of subfolders.rows) {
      // Restore subfolder
      await client.query(
        `UPDATE folders 
         SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [folder.id],
      );

      // Restore files in subfolder
      await client.query(
        `UPDATE files
         SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE folder_id = $1 AND deleted_at IS NOT NULL`,
        [folder.id],
      );

      // Recursively restore children
      await this.restoreSubfoldersRecursive(client, folder.id);
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

  private mapFolderRow(row: any): FolderMetadata {
    return {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      parentId: row.parent_id,
      path: row.path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
