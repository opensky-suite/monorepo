/**
 * Document Service
 * Core CRUD operations for collaborative documents
 *
 * Note: Fails fast with NotImplementedError for features not yet built
 */

import { Pool } from "pg";
import { nanoid } from "nanoid";
import type {
  Document,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  ListDocumentsOptions,
  DocumentContent,
  DocumentVisibility,
  DocumentStatus,
  SharePermission,
} from "./types.js";

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`NOT IMPLEMENTED: ${feature}`);
    this.name = "NotImplementedError";
  }
}

export class DocumentService {
  constructor(private pool: Pool) {}

  /**
   * Create a new document
   */
  async createDocument(
    userId: string,
    request: CreateDocumentRequest,
  ): Promise<Document> {
    const defaultContent: DocumentContent = {
      format: "prosemirror",
      data: { type: "doc", content: [] },
    };

    const content = request.content || defaultContent;

    const result = await this.pool.query<any>(
      `INSERT INTO documents (
        title, content, owner_id, folder_id, visibility, status, last_edited_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        request.title,
        JSON.stringify(content),
        userId,
        request.folderId || null,
        request.visibility || "private",
        request.status || "draft",
        userId,
      ],
    );

    return this.mapDocumentRow(result.rows[0]);
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string, userId: string): Promise<Document> {
    const result = await this.pool.query<any>(
      `SELECT d.* FROM documents d
       WHERE d.id = $1
         AND d.deleted_at IS NULL
         AND (
           d.owner_id = $2
           OR EXISTS (
             SELECT 1 FROM document_shares ds
             WHERE ds.document_id = d.id
               AND ds.shared_with = $2
               AND ds.permission IN ('view', 'comment', 'edit', 'owner')
               AND (ds.expires_at IS NULL OR ds.expires_at > CURRENT_TIMESTAMP)
           )
           OR d.visibility = 'public'
         )`,
      [documentId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("Document not found or access denied");
    }

    return this.mapDocumentRow(result.rows[0]);
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    userId: string,
    request: UpdateDocumentRequest,
  ): Promise<Document> {
    // Verify edit permission
    await this.verifyDocumentPermission(documentId, userId, "edit");

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(request.title);
    }
    if (request.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(JSON.stringify(request.content));
      // Increment version on content change
      updates.push(`version = version + 1`);
    }
    if (request.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      values.push(request.visibility);
    }
    if (request.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(request.status);
    }

    if (updates.length === 0) {
      return this.getDocument(documentId, userId);
    }

    // Always update last_edited_by
    updates.push(`last_edited_by = $${paramIndex++}`);
    values.push(userId);

    values.push(documentId);

    const result = await this.pool.query<any>(
      `UPDATE documents 
       SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error("Document not found");
    }

    return this.mapDocumentRow(result.rows[0]);
  }

  /**
   * Delete a document (soft delete)
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    // Only owner can delete
    const doc = await this.getDocument(documentId, userId);
    if (doc.ownerId !== userId) {
      throw new Error("Only document owner can delete");
    }

    await this.pool.query(
      `UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [documentId],
    );
  }

  /**
   * List documents for a user
   */
  async listDocuments(
    userId: string,
    options: ListDocumentsOptions = {},
  ): Promise<Document[]> {
    const conditions: string[] = ["d.deleted_at IS NULL"];
    const values: any[] = [];
    let paramIndex = 1;

    // Folder filter
    if (options.folderId !== undefined) {
      if (options.folderId === null) {
        conditions.push("d.folder_id IS NULL");
      } else {
        conditions.push(`d.folder_id = $${paramIndex++}`);
        values.push(options.folderId);
      }
    }

    // Visibility filter
    if (options.visibility) {
      conditions.push(`d.visibility = $${paramIndex++}`);
      values.push(options.visibility);
    }

    // Status filter
    if (options.status) {
      conditions.push(`d.status = $${paramIndex++}`);
      values.push(options.status);
    }

    // Ownership filters
    if (options.ownedByMe) {
      conditions.push(`d.owner_id = $${paramIndex++}`);
      values.push(userId);
    } else if (options.sharedWithMe) {
      conditions.push(`EXISTS (
        SELECT 1 FROM document_shares ds
        WHERE ds.document_id = d.id
          AND ds.shared_with = $${paramIndex}
          AND (ds.expires_at IS NULL OR ds.expires_at > CURRENT_TIMESTAMP)
      )`);
      values.push(userId);
      paramIndex++;
    } else {
      // Default: show accessible documents
      conditions.push(`(
        d.owner_id = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM document_shares ds
          WHERE ds.document_id = d.id
            AND ds.shared_with = $${paramIndex}
            AND (ds.expires_at IS NULL OR ds.expires_at > CURRENT_TIMESTAMP)
        )
        OR d.visibility = 'public'
      )`);
      values.push(userId);
      paramIndex++;
    }

    // Search query (simple title search for now)
    if (options.searchQuery) {
      conditions.push(`d.title ILIKE $${paramIndex++}`);
      values.push(`%${options.searchQuery}%`);
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await this.pool.query<any>(
      `SELECT d.* FROM documents d
       WHERE ${conditions.join(" AND ")}
       ORDER BY d.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );

    return result.rows.map((row) => this.mapDocumentRow(row));
  }

  /**
   * Share a document with a user
   */
  async shareDocument(
    documentId: string,
    sharedBy: string,
    sharedWith: string | null,
    permission: SharePermission,
    expiresAt?: Date,
  ): Promise<void> {
    // Verify owner or existing share permission to re-share
    const doc = await this.getDocument(documentId, sharedBy);
    if (doc.ownerId !== sharedBy) {
      await this.verifyDocumentPermission(documentId, sharedBy, "owner");
    }

    await this.pool.query(
      `INSERT INTO document_shares (id, document_id, shared_by, shared_with, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (document_id, shared_with) 
       WHERE shared_with IS NOT NULL
       DO UPDATE SET permission = $5, expires_at = $6`,
      [
        nanoid(),
        documentId,
        sharedBy,
        sharedWith,
        permission,
        expiresAt || null,
      ],
    );
  }

  /**
   * Create a new version snapshot
   */
  async createVersion(
    documentId: string,
    userId: string,
    changeDescription?: string,
  ): Promise<void> {
    const doc = await this.getDocument(documentId, userId);

    await this.pool.query(
      `INSERT INTO document_versions (document_id, version, title, content, change_description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        documentId,
        doc.version,
        doc.title,
        JSON.stringify(doc.content),
        changeDescription || null,
        userId,
      ],
    );
  }

  /**
   * Get version history for a document
   */
  async getVersionHistory(documentId: string, userId: string): Promise<any[]> {
    // Verify access
    await this.getDocument(documentId, userId);

    const result = await this.pool.query(
      `SELECT * FROM document_versions
       WHERE document_id = $1
       ORDER BY version DESC`,
      [documentId],
    );

    return result.rows;
  }

  /**
   * Restore a specific version
   */
  async restoreVersion(
    documentId: string,
    versionNumber: number,
    userId: string,
  ): Promise<Document> {
    // Verify edit permission
    await this.verifyDocumentPermission(documentId, userId, "edit");

    // Get the version
    const versionResult = await this.pool.query(
      `SELECT * FROM document_versions WHERE document_id = $1 AND version = $2`,
      [documentId, versionNumber],
    );

    if (versionResult.rows.length === 0) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    const version = versionResult.rows[0];

    // Update document with version content
    return this.updateDocument(documentId, userId, {
      title: version.title,
      content: version.content,
    });
  }

  // NOT IMPLEMENTED - Fail fast features

  async addComment(): Promise<never> {
    throw new NotImplementedError(
      "Comments - use CommentService when implemented",
    );
  }

  async createSuggestion(): Promise<never> {
    throw new NotImplementedError(
      "Suggestions - use SuggestionService when implemented",
    );
  }

  async exportDocument(): Promise<never> {
    throw new NotImplementedError(
      "Document export (PDF/DOCX/MD) - needs renderer integration",
    );
  }

  async importDocument(): Promise<never> {
    throw new NotImplementedError(
      "Document import - needs parser for DOCX/MD/HTML",
    );
  }

  async getCollaborators(): Promise<never> {
    throw new NotImplementedError(
      "Real-time collaboration - needs WebSocket/operational transform",
    );
  }

  // Helper methods

  private async verifyDocumentPermission(
    documentId: string,
    userId: string,
    requiredPermission: "view" | "comment" | "edit" | "owner",
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT d.owner_id, ds.permission
       FROM documents d
       LEFT JOIN document_shares ds ON ds.document_id = d.id AND ds.shared_with = $1
       WHERE d.id = $2 AND d.deleted_at IS NULL`,
      [userId, documentId],
    );

    if (result.rows.length === 0) {
      throw new Error("Document not found");
    }

    const { owner_id, permission } = result.rows[0];

    // Owner has all permissions
    if (owner_id === userId) {
      return;
    }

    // Check shared permission
    if (!permission) {
      throw new Error("Access denied");
    }

    const permissionLevels = ["view", "comment", "edit", "owner"];
    const requiredLevel = permissionLevels.indexOf(requiredPermission);
    const userLevel = permissionLevels.indexOf(permission);

    if (userLevel < requiredLevel) {
      throw new Error(`${requiredPermission} permission required`);
    }
  }

  private mapDocumentRow(row: any): Document {
    return {
      id: row.id,
      title: row.title,
      content:
        typeof row.content === "string" ? JSON.parse(row.content) : row.content,
      ownerId: row.owner_id,
      folderId: row.folder_id,
      visibility: row.visibility as DocumentVisibility,
      status: row.status as DocumentStatus,
      version: row.version,
      lastEditedBy: row.last_edited_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
