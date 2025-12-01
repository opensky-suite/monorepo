/**
 * Folder Management Service
 * Issue #149: Folder hierarchy
 * Issue #151: Folder sharing
 */

import { Pool } from "pg";
import { nanoid } from "nanoid";
import type { FolderMetadata, FolderShare, SharePermission } from "./types.js";

export class FolderService {
  constructor(private pool: Pool) {}

  async createFolder(
    ownerId: string,
    name: string,
    parentId?: string,
  ): Promise<FolderMetadata> {
    const folderId = nanoid();

    // Calculate path
    let path = `/${name}`;
    if (parentId) {
      const parent = await this.pool.query<FolderMetadata>(
        `SELECT path FROM folders WHERE id = $1`,
        [parentId],
      );
      if (parent.rows[0]) {
        path = `${parent.rows[0].path}/${name}`;
      }
    }

    const result = await this.pool.query<FolderMetadata>(
      `INSERT INTO folders (id, name, owner_id, parent_id, path)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [folderId, name, ownerId, parentId, path],
    );

    return this.mapFolderRow(result.rows[0]);
  }

  async getFolder(folderId: string): Promise<FolderMetadata> {
    const result = await this.pool.query<FolderMetadata>(
      `SELECT * FROM folders WHERE id = $1 AND deleted_at IS NULL`,
      [folderId],
    );

    if (result.rows.length === 0) {
      throw new Error("Folder not found");
    }

    return this.mapFolderRow(result.rows[0]);
  }

  async listFolders(
    ownerId: string,
    parentId?: string,
  ): Promise<FolderMetadata[]> {
    const result = await this.pool.query<FolderMetadata>(
      `SELECT * FROM folders 
       WHERE owner_id = $1 
         AND parent_id ${parentId ? "= $2" : "IS NULL"}
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      parentId ? [ownerId, parentId] : [ownerId],
    );

    return result.rows.map((row) => this.mapFolderRow(row));
  }

  async deleteFolder(folderId: string, userId: string): Promise<void> {
    const folder = await this.getFolder(folderId);
    if (folder.ownerId !== userId) {
      throw new Error("Permission denied");
    }

    // Soft delete folder and all contents
    await this.pool.query(
      `UPDATE folders SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [folderId],
    );

    // Also delete files in this folder
    await this.pool.query(
      `UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE folder_id = $1`,
      [folderId],
    );
  }

  async shareFolder(
    folderId: string,
    sharedBy: string,
    sharedWith: string | null,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<FolderShare> {
    const folder = await this.getFolder(folderId);
    if (folder.ownerId !== sharedBy) {
      throw new Error("Permission denied");
    }

    const result = await this.pool.query<FolderShare>(
      `INSERT INTO folder_shares (id, folder_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (folder_id, shared_with) DO UPDATE
       SET permission = $5, expires_at = $6
       RETURNING *`,
      [nanoid(), folderId, sharedBy, sharedWith, permission, expiresAt],
    );

    return this.mapFolderShareRow(result.rows[0]);
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

  private mapFolderShareRow(row: any): FolderShare {
    return {
      id: row.id,
      folderId: row.folder_id,
      sharedBy: row.shared_by,
      sharedWith: row.shared_with,
      permission: row.permission,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
