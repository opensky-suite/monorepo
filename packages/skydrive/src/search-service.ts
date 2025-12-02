/**
 * Search Service for SkyDrive
 * Full-text search on files and folders with filters
 */

import { Pool } from "pg";
import type { FileMetadata, FolderMetadata } from "./types.js";

export interface SearchOptions {
  query: string;
  fileTypes?: string[]; // MIME type prefixes: "image/", "video/", "application/pdf"
  minSize?: number;
  maxSize?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  ownedByMe?: boolean;
  sharedWithMe?: boolean;
  inFolder?: string; // Folder ID
  includeTrash?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  files: FileMetadata[];
  folders: FolderMetadata[];
  totalFiles: number;
  totalFolders: number;
}

export interface RecentItem {
  id: string;
  name: string;
  type: "file" | "folder";
  mimeType?: string;
  path: string;
  accessedAt: Date;
}

export interface StarredItem {
  id: string;
  itemId: string;
  itemType: "file" | "folder";
  userId: string;
  createdAt: Date;
}

export class SearchService {
  constructor(private pool: Pool) {}

  /**
   * Search files and folders
   */
  async search(userId: string, options: SearchOptions): Promise<SearchResult> {
    const fileConditions: string[] = ["f.deleted_at IS NULL"];
    const folderConditions: string[] = ["fo.deleted_at IS NULL"];
    const fileValues: any[] = [];
    const folderValues: any[] = [];
    let fileParamIndex = 1;
    let folderParamIndex = 1;

    // Query filter (name search)
    if (options.query) {
      fileConditions.push(`f.name ILIKE $${fileParamIndex++}`);
      fileValues.push(`%${options.query}%`);
      folderConditions.push(`fo.name ILIKE $${folderParamIndex++}`);
      folderValues.push(`%${options.query}%`);
    }

    // File type filter (files only)
    if (options.fileTypes && options.fileTypes.length > 0) {
      const typeConditions = options.fileTypes.map(
        () => `f.mime_type LIKE $${fileParamIndex++}`,
      );
      fileConditions.push(`(${typeConditions.join(" OR ")})`);
      options.fileTypes.forEach((t) => fileValues.push(`${t}%`));
    }

    // Size filters (files only)
    if (options.minSize !== undefined) {
      fileConditions.push(`f.size >= $${fileParamIndex++}`);
      fileValues.push(options.minSize);
    }
    if (options.maxSize !== undefined) {
      fileConditions.push(`f.size <= $${fileParamIndex++}`);
      fileValues.push(options.maxSize);
    }

    // Date filters
    if (options.createdAfter) {
      fileConditions.push(`f.created_at >= $${fileParamIndex++}`);
      fileValues.push(options.createdAfter);
      folderConditions.push(`fo.created_at >= $${folderParamIndex++}`);
      folderValues.push(options.createdAfter);
    }
    if (options.createdBefore) {
      fileConditions.push(`f.created_at <= $${fileParamIndex++}`);
      fileValues.push(options.createdBefore);
      folderConditions.push(`fo.created_at <= $${folderParamIndex++}`);
      folderValues.push(options.createdBefore);
    }
    if (options.modifiedAfter) {
      fileConditions.push(`f.updated_at >= $${fileParamIndex++}`);
      fileValues.push(options.modifiedAfter);
      folderConditions.push(`fo.updated_at >= $${folderParamIndex++}`);
      folderValues.push(options.modifiedAfter);
    }
    if (options.modifiedBefore) {
      fileConditions.push(`f.updated_at <= $${fileParamIndex++}`);
      fileValues.push(options.modifiedBefore);
      folderConditions.push(`fo.updated_at <= $${folderParamIndex++}`);
      folderValues.push(options.modifiedBefore);
    }

    // Folder filter
    if (options.inFolder) {
      fileConditions.push(`f.folder_id = $${fileParamIndex++}`);
      fileValues.push(options.inFolder);
      folderConditions.push(`fo.parent_id = $${folderParamIndex++}`);
      folderValues.push(options.inFolder);
    }

    // Ownership/sharing filters
    if (options.ownedByMe) {
      fileConditions.push(`f.owner_id = $${fileParamIndex++}`);
      fileValues.push(userId);
      folderConditions.push(`fo.owner_id = $${folderParamIndex++}`);
      folderValues.push(userId);
    } else if (options.sharedWithMe) {
      fileConditions.push(`EXISTS (
        SELECT 1 FROM file_shares fs
        WHERE fs.file_id = f.id AND fs.shared_with = $${fileParamIndex}
        AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
      )`);
      fileValues.push(userId);
      fileParamIndex++;

      folderConditions.push(`EXISTS (
        SELECT 1 FROM folder_shares fos
        WHERE fos.folder_id = fo.id AND fos.shared_with = $${folderParamIndex}
        AND (fos.expires_at IS NULL OR fos.expires_at > CURRENT_TIMESTAMP)
      )`);
      folderValues.push(userId);
      folderParamIndex++;
    } else {
      // Default: accessible files (owned or shared)
      fileConditions.push(`(
        f.owner_id = $${fileParamIndex}
        OR EXISTS (
          SELECT 1 FROM file_shares fs
          WHERE fs.file_id = f.id AND fs.shared_with = $${fileParamIndex}
          AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
        )
      )`);
      fileValues.push(userId);
      fileParamIndex++;

      folderConditions.push(`(
        fo.owner_id = $${folderParamIndex}
        OR EXISTS (
          SELECT 1 FROM folder_shares fos
          WHERE fos.folder_id = fo.id AND fos.shared_with = $${folderParamIndex}
          AND (fos.expires_at IS NULL OR fos.expires_at > CURRENT_TIMESTAMP)
        )
      )`);
      folderValues.push(userId);
      folderParamIndex++;
    }

    // Include trash filter
    if (!options.includeTrash) {
      // Already handled by deleted_at IS NULL
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Search files
    const fileQuery = `
      SELECT f.*, COUNT(*) OVER() as total_count
      FROM files f
      WHERE ${fileConditions.join(" AND ")}
      ORDER BY f.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const fileResult = await this.pool.query(fileQuery, fileValues);

    // Search folders
    const folderQuery = `
      SELECT fo.*, COUNT(*) OVER() as total_count
      FROM folders fo
      WHERE ${folderConditions.join(" AND ")}
      ORDER BY fo.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const folderResult = await this.pool.query(folderQuery, folderValues);

    return {
      files: fileResult.rows.map((row) => this.mapFileRow(row)),
      folders: folderResult.rows.map((row) => this.mapFolderRow(row)),
      totalFiles:
        fileResult.rows.length > 0
          ? parseInt(fileResult.rows[0].total_count, 10)
          : 0,
      totalFolders:
        folderResult.rows.length > 0
          ? parseInt(folderResult.rows[0].total_count, 10)
          : 0,
    };
  }

  /**
   * Get recently accessed files
   */
  async getRecentFiles(
    userId: string,
    limit: number = 20,
  ): Promise<FileMetadata[]> {
    const result = await this.pool.query(
      `SELECT f.* FROM files f
       WHERE f.owner_id = $1 AND f.deleted_at IS NULL
       ORDER BY f.updated_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return result.rows.map((row) => this.mapFileRow(row));
  }

  /**
   * Get files by type
   */
  async getFilesByType(
    userId: string,
    typePrefix: string,
    limit: number = 50,
  ): Promise<FileMetadata[]> {
    const result = await this.pool.query(
      `SELECT f.* FROM files f
       WHERE f.mime_type LIKE $1
       AND f.deleted_at IS NULL
       AND (
         f.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM file_shares fs
           WHERE fs.file_id = f.id AND fs.shared_with = $2
           AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
         )
       )
       ORDER BY f.updated_at DESC
       LIMIT $3`,
      [`${typePrefix}%`, userId, limit],
    );

    return result.rows.map((row) => this.mapFileRow(row));
  }

  /**
   * Quick search suggestions (for autocomplete)
   */
  async getSuggestions(
    userId: string,
    query: string,
    limit: number = 10,
  ): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT name FROM (
        SELECT name FROM files 
        WHERE name ILIKE $1 AND owner_id = $2 AND deleted_at IS NULL
        UNION
        SELECT name FROM folders
        WHERE name ILIKE $1 AND owner_id = $2 AND deleted_at IS NULL
      ) items
      ORDER BY name
      LIMIT $3`,
      [`${query}%`, userId, limit],
    );

    return result.rows.map((row) => row.name);
  }

  /**
   * Star a file or folder
   */
  async starItem(
    userId: string,
    itemId: string,
    itemType: "file" | "folder",
  ): Promise<void> {
    // Verify access first
    if (itemType === "file") {
      await this.verifyFileAccess(itemId, userId);
    } else {
      await this.verifyFolderAccess(itemId, userId);
    }

    await this.pool.query(
      `INSERT INTO starred_items (user_id, item_id, item_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id, item_type) DO NOTHING`,
      [userId, itemId, itemType],
    );
  }

  /**
   * Unstar a file or folder
   */
  async unstarItem(
    userId: string,
    itemId: string,
    itemType: "file" | "folder",
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM starred_items
       WHERE user_id = $1 AND item_id = $2 AND item_type = $3`,
      [userId, itemId, itemType],
    );
  }

  /**
   * Get starred items
   */
  async getStarredItems(
    userId: string,
  ): Promise<(FileMetadata | FolderMetadata)[]> {
    const result = await this.pool.query(
      `SELECT s.item_id, s.item_type
       FROM starred_items s
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId],
    );

    const items: (FileMetadata | FolderMetadata)[] = [];

    for (const row of result.rows) {
      if (row.item_type === "file") {
        const fileResult = await this.pool.query(
          `SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL`,
          [row.item_id],
        );
        if (fileResult.rows.length > 0) {
          items.push(this.mapFileRow(fileResult.rows[0]));
        }
      } else {
        const folderResult = await this.pool.query(
          `SELECT * FROM folders WHERE id = $1 AND deleted_at IS NULL`,
          [row.item_id],
        );
        if (folderResult.rows.length > 0) {
          items.push(this.mapFolderRow(folderResult.rows[0]));
        }
      }
    }

    return items;
  }

  /**
   * Check if item is starred
   */
  async isStarred(
    userId: string,
    itemId: string,
    itemType: "file" | "folder",
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM starred_items
       WHERE user_id = $1 AND item_id = $2 AND item_type = $3`,
      [userId, itemId, itemType],
    );
    return result.rows.length > 0;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(userId: string): Promise<{
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const statsResult = await this.pool.query(
      `SELECT
         COUNT(*) as total_files,
         COALESCE(SUM(size), 0) as total_size
       FROM files
       WHERE owner_id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    const folderResult = await this.pool.query(
      `SELECT COUNT(*) as total_folders
       FROM folders
       WHERE owner_id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    const typeResult = await this.pool.query(
      `SELECT
         CASE
           WHEN mime_type LIKE 'image/%' THEN 'images'
           WHEN mime_type LIKE 'video/%' THEN 'videos'
           WHEN mime_type LIKE 'audio/%' THEN 'audio'
           WHEN mime_type LIKE 'application/pdf' THEN 'documents'
           WHEN mime_type LIKE 'text/%' THEN 'documents'
           WHEN mime_type LIKE 'application/msword%' THEN 'documents'
           WHEN mime_type LIKE 'application/vnd.openxmlformats%' THEN 'documents'
           ELSE 'other'
         END as category,
         COUNT(*) as count,
         COALESCE(SUM(size), 0) as size
       FROM files
       WHERE owner_id = $1 AND deleted_at IS NULL
       GROUP BY category`,
      [userId],
    );

    const byType: Record<string, { count: number; size: number }> = {};
    for (const row of typeResult.rows) {
      byType[row.category] = {
        count: parseInt(row.count, 10),
        size: parseInt(row.size, 10),
      };
    }

    return {
      totalFiles: parseInt(statsResult.rows[0].total_files, 10),
      totalFolders: parseInt(folderResult.rows[0].total_folders, 10),
      totalSize: parseInt(statsResult.rows[0].total_size, 10),
      byType,
    };
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
           WHERE fs.file_id = f.id AND fs.shared_with = $2
           AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
         )
       )`,
      [fileId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("File not found or access denied");
    }
  }

  private async verifyFolderAccess(
    folderId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM folders fo
       WHERE fo.id = $1 AND fo.deleted_at IS NULL
       AND (
         fo.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM folder_shares fos
           WHERE fos.folder_id = fo.id AND fos.shared_with = $2
           AND (fos.expires_at IS NULL OR fos.expires_at > CURRENT_TIMESTAMP)
         )
       )`,
      [folderId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("Folder not found or access denied");
    }
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
