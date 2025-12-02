/**
 * Share Service for SkyDrive
 * Handles file and folder sharing with granular permissions
 */

import { Pool } from "pg";
import { nanoid } from "nanoid";
import type { FileShare, FolderShare, SharePermission } from "./types.js";

export interface ShareLink {
  id: string;
  itemId: string;
  itemType: "file" | "folder";
  token: string;
  permission: SharePermission;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface SharedWithMe {
  id: string;
  name: string;
  type: "file" | "folder";
  permission: SharePermission;
  sharedBy: string;
  sharedByName: string;
  sharedAt: Date;
  expiresAt?: Date;
}

export class ShareService {
  constructor(private pool: Pool) {}

  /**
   * Share a file with a user
   */
  async shareFile(
    fileId: string,
    sharedBy: string,
    sharedWith: string,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<FileShare> {
    // Verify ownership
    await this.verifyFileOwnership(fileId, sharedBy);

    // Cannot share with self
    if (sharedBy === sharedWith) {
      throw new Error("Cannot share with yourself");
    }

    const result = await this.pool.query(
      `INSERT INTO file_shares (id, file_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (file_id, shared_with) WHERE shared_with IS NOT NULL
       DO UPDATE SET permission = $5, expires_at = $6
       RETURNING *`,
      [nanoid(), fileId, sharedBy, sharedWith, permission, expiresAt || null],
    );

    return this.mapFileShareRow(result.rows[0]);
  }

  /**
   * Share a folder with a user (applies to all contents)
   */
  async shareFolder(
    folderId: string,
    sharedBy: string,
    sharedWith: string,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<FolderShare> {
    // Verify ownership
    await this.verifyFolderOwnership(folderId, sharedBy);

    if (sharedBy === sharedWith) {
      throw new Error("Cannot share with yourself");
    }

    const result = await this.pool.query(
      `INSERT INTO folder_shares (id, folder_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (folder_id, shared_with) WHERE shared_with IS NOT NULL
       DO UPDATE SET permission = $5, expires_at = $6
       RETURNING *`,
      [nanoid(), folderId, sharedBy, sharedWith, permission, expiresAt || null],
    );

    return this.mapFolderShareRow(result.rows[0]);
  }

  /**
   * Create a public share link for a file
   */
  async createFileShareLink(
    fileId: string,
    userId: string,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<ShareLink> {
    await this.verifyFileOwnership(fileId, userId);

    const token = nanoid(32);

    const result = await this.pool.query(
      `INSERT INTO file_shares (id, file_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, NULL, $4, $5)
       RETURNING *`,
      [token, fileId, userId, permission, expiresAt || null],
    );

    return {
      id: result.rows[0].id,
      itemId: fileId,
      itemType: "file",
      token,
      permission,
      expiresAt,
      createdBy: userId,
      createdAt: result.rows[0].created_at,
    };
  }

  /**
   * Create a public share link for a folder
   */
  async createFolderShareLink(
    folderId: string,
    userId: string,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<ShareLink> {
    await this.verifyFolderOwnership(folderId, userId);

    const token = nanoid(32);

    const result = await this.pool.query(
      `INSERT INTO folder_shares (id, folder_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, NULL, $4, $5)
       RETURNING *`,
      [token, folderId, userId, permission, expiresAt || null],
    );

    return {
      id: result.rows[0].id,
      itemId: folderId,
      itemType: "folder",
      token,
      permission,
      expiresAt,
      createdBy: userId,
      createdAt: result.rows[0].created_at,
    };
  }

  /**
   * Revoke share for a specific user
   */
  async revokeFileShare(
    fileId: string,
    ownerId: string,
    sharedWith: string,
  ): Promise<void> {
    await this.verifyFileOwnership(fileId, ownerId);

    await this.pool.query(
      `DELETE FROM file_shares WHERE file_id = $1 AND shared_with = $2`,
      [fileId, sharedWith],
    );
  }

  /**
   * Revoke folder share for a specific user
   */
  async revokeFolderShare(
    folderId: string,
    ownerId: string,
    sharedWith: string,
  ): Promise<void> {
    await this.verifyFolderOwnership(folderId, ownerId);

    await this.pool.query(
      `DELETE FROM folder_shares WHERE folder_id = $1 AND shared_with = $2`,
      [folderId, sharedWith],
    );
  }

  /**
   * Revoke all shares for a file
   */
  async revokeAllFileShares(fileId: string, ownerId: string): Promise<void> {
    await this.verifyFileOwnership(fileId, ownerId);

    await this.pool.query(`DELETE FROM file_shares WHERE file_id = $1`, [
      fileId,
    ]);
  }

  /**
   * Revoke all shares for a folder
   */
  async revokeAllFolderShares(
    folderId: string,
    ownerId: string,
  ): Promise<void> {
    await this.verifyFolderOwnership(folderId, ownerId);

    await this.pool.query(`DELETE FROM folder_shares WHERE folder_id = $1`, [
      folderId,
    ]);
  }

  /**
   * Get all shares for a file
   */
  async getFileShares(fileId: string, userId: string): Promise<FileShare[]> {
    // Verify access (owner can see shares)
    await this.verifyFileOwnership(fileId, userId);

    const result = await this.pool.query(
      `SELECT * FROM file_shares
       WHERE file_id = $1
       ORDER BY created_at DESC`,
      [fileId],
    );

    return result.rows.map((row) => this.mapFileShareRow(row));
  }

  /**
   * Get all shares for a folder
   */
  async getFolderShares(
    folderId: string,
    userId: string,
  ): Promise<FolderShare[]> {
    await this.verifyFolderOwnership(folderId, userId);

    const result = await this.pool.query(
      `SELECT * FROM folder_shares
       WHERE folder_id = $1
       ORDER BY created_at DESC`,
      [folderId],
    );

    return result.rows.map((row) => this.mapFolderShareRow(row));
  }

  /**
   * Get all items shared with a user
   */
  async getSharedWithMe(userId: string): Promise<SharedWithMe[]> {
    const fileResult = await this.pool.query(
      `SELECT 
         f.id, f.name, 'file' as type, fs.permission,
         fs.shared_by, u.display_name as shared_by_name,
         fs.created_at as shared_at, fs.expires_at
       FROM file_shares fs
       JOIN files f ON f.id = fs.file_id
       JOIN users u ON u.id = fs.shared_by
       WHERE fs.shared_with = $1
         AND f.deleted_at IS NULL
         AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)`,
      [userId],
    );

    const folderResult = await this.pool.query(
      `SELECT 
         fo.id, fo.name, 'folder' as type, fos.permission,
         fos.shared_by, u.display_name as shared_by_name,
         fos.created_at as shared_at, fos.expires_at
       FROM folder_shares fos
       JOIN folders fo ON fo.id = fos.folder_id
       JOIN users u ON u.id = fos.shared_by
       WHERE fos.shared_with = $1
         AND fo.deleted_at IS NULL
         AND (fos.expires_at IS NULL OR fos.expires_at > CURRENT_TIMESTAMP)`,
      [userId],
    );

    const items = [...fileResult.rows, ...folderResult.rows].map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as "file" | "folder",
      permission: row.permission as SharePermission,
      sharedBy: row.shared_by,
      sharedByName: row.shared_by_name,
      sharedAt: row.shared_at,
      expiresAt: row.expires_at,
    }));

    // Sort by shared date descending
    items.sort((a, b) => b.sharedAt.getTime() - a.sharedAt.getTime());

    return items;
  }

  /**
   * Update share permission
   */
  async updateFileSharePermission(
    fileId: string,
    ownerId: string,
    sharedWith: string,
    newPermission: SharePermission,
  ): Promise<FileShare> {
    await this.verifyFileOwnership(fileId, ownerId);

    const result = await this.pool.query(
      `UPDATE file_shares
       SET permission = $1
       WHERE file_id = $2 AND shared_with = $3
       RETURNING *`,
      [newPermission, fileId, sharedWith],
    );

    if (result.rows.length === 0) {
      throw new Error("Share not found");
    }

    return this.mapFileShareRow(result.rows[0]);
  }

  /**
   * Update folder share permission
   */
  async updateFolderSharePermission(
    folderId: string,
    ownerId: string,
    sharedWith: string,
    newPermission: SharePermission,
  ): Promise<FolderShare> {
    await this.verifyFolderOwnership(folderId, ownerId);

    const result = await this.pool.query(
      `UPDATE folder_shares
       SET permission = $1
       WHERE folder_id = $2 AND shared_with = $3
       RETURNING *`,
      [newPermission, folderId, sharedWith],
    );

    if (result.rows.length === 0) {
      throw new Error("Share not found");
    }

    return this.mapFolderShareRow(result.rows[0]);
  }

  /**
   * Check if user has specific permission on file
   */
  async checkFilePermission(
    fileId: string,
    userId: string,
    requiredPermission: SharePermission,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT f.owner_id, fs.permission
       FROM files f
       LEFT JOIN file_shares fs ON fs.file_id = f.id AND fs.shared_with = $2
         AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
       WHERE f.id = $1 AND f.deleted_at IS NULL`,
      [fileId, userId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { owner_id, permission } = result.rows[0];

    // Owner has all permissions
    if (owner_id === userId) {
      return true;
    }

    if (!permission) {
      return false;
    }

    // Check permission hierarchy
    return this.hasPermission(permission, requiredPermission);
  }

  /**
   * Check if user has specific permission on folder
   */
  async checkFolderPermission(
    folderId: string,
    userId: string,
    requiredPermission: SharePermission,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT fo.owner_id, fos.permission
       FROM folders fo
       LEFT JOIN folder_shares fos ON fos.folder_id = fo.id AND fos.shared_with = $2
         AND (fos.expires_at IS NULL OR fos.expires_at > CURRENT_TIMESTAMP)
       WHERE fo.id = $1 AND fo.deleted_at IS NULL`,
      [folderId, userId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { owner_id, permission } = result.rows[0];

    if (owner_id === userId) {
      return true;
    }

    if (!permission) {
      return false;
    }

    return this.hasPermission(permission, requiredPermission);
  }

  /**
   * Clean up expired shares
   */
  async cleanupExpiredShares(): Promise<number> {
    const fileResult = await this.pool.query(
      `DELETE FROM file_shares
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP`,
    );

    const folderResult = await this.pool.query(
      `DELETE FROM folder_shares
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP`,
    );

    return (fileResult.rowCount || 0) + (folderResult.rowCount || 0);
  }

  // Helper methods

  private async verifyFileOwnership(
    fileId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT owner_id FROM files WHERE id = $1 AND deleted_at IS NULL`,
      [fileId],
    );

    if (result.rows.length === 0) {
      throw new Error("File not found");
    }

    if (result.rows[0].owner_id !== userId) {
      throw new Error("Permission denied: not file owner");
    }
  }

  private async verifyFolderOwnership(
    folderId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT owner_id FROM folders WHERE id = $1 AND deleted_at IS NULL`,
      [folderId],
    );

    if (result.rows.length === 0) {
      throw new Error("Folder not found");
    }

    if (result.rows[0].owner_id !== userId) {
      throw new Error("Permission denied: not folder owner");
    }
  }

  private hasPermission(
    userPermission: string,
    requiredPermission: SharePermission,
  ): boolean {
    const permissionLevel: Record<string, number> = {
      view: 1,
      comment: 2,
      edit: 3,
    };

    return (
      (permissionLevel[userPermission] || 0) >=
      (permissionLevel[requiredPermission] || 0)
    );
  }

  private mapFileShareRow(row: any): FileShare {
    return {
      id: row.id,
      fileId: row.file_id,
      sharedBy: row.shared_by,
      sharedWith: row.shared_with,
      permission: row.permission as SharePermission,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  private mapFolderShareRow(row: any): FolderShare {
    return {
      id: row.id,
      folderId: row.folder_id,
      sharedBy: row.shared_by,
      sharedWith: row.shared_with,
      permission: row.permission as SharePermission,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
