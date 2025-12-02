/**
 * Message Service
 * Core messaging operations for SkyChat
 *
 * Production-ready: Real DB queries, fails fast on unimplemented features
 */

import { Pool } from "pg";
import { nanoid } from "nanoid";
import type {
  Message,
  SendMessageRequest,
  UpdateMessageRequest,
  ListMessagesOptions,
  SearchMessagesOptions,
  UnreadCount,
} from "./types.js";

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`NOT IMPLEMENTED: ${feature}`);
    this.name = "NotImplementedError";
  }
}

export class MessageService {
  constructor(private pool: Pool) {}

  /**
   * Send a message to a channel
   */
  async sendMessage(
    userId: string,
    channelId: string,
    request: SendMessageRequest,
  ): Promise<Message> {
    // Verify user is channel member
    await this.verifyChannelMembership(userId, channelId);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Insert message
      const result = await client.query<any>(
        `INSERT INTO messages (channel_id, user_id, content, thread_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [channelId, userId, request.content, request.threadId || null],
      );

      const message = result.rows[0];

      // Handle attachments if provided
      if (request.attachments && request.attachments.length > 0) {
        for (const fileId of request.attachments) {
          // Get file metadata
          const fileResult = await client.query(
            `SELECT name, size, mime_type FROM files WHERE id = $1`,
            [fileId],
          );

          if (fileResult.rows.length > 0) {
            const file = fileResult.rows[0];
            await client.query(
              `INSERT INTO message_attachments (message_id, file_id, file_name, file_size, mime_type)
               VALUES ($1, $2, $3, $4, $5)`,
              [message.id, fileId, file.name, file.size, file.mime_type],
            );
          }
        }
      }

      // Extract and save @mentions
      await this.processMentions(client, message.id, userId, request.content);

      await client.query("COMMIT");
      return this.mapMessageRow(message);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a message by ID
   */
  async getMessage(messageId: string, userId: string): Promise<Message> {
    const result = await this.pool.query<any>(
      `SELECT m.* FROM messages m
       JOIN channel_members cm ON cm.channel_id = m.channel_id
       WHERE m.id = $1
         AND cm.user_id = $2
         AND m.deleted_at IS NULL`,
      [messageId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("Message not found or access denied");
    }

    return this.mapMessageRow(result.rows[0]);
  }

  /**
   * Update a message (edit)
   */
  async updateMessage(
    messageId: string,
    userId: string,
    request: UpdateMessageRequest,
  ): Promise<Message> {
    const message = await this.getMessage(messageId, userId);

    // Only author can edit
    if (message.userId !== userId) {
      throw new Error("Only message author can edit");
    }

    const result = await this.pool.query<any>(
      `UPDATE messages
       SET content = $1, is_edited = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [request.content, messageId],
    );

    return this.mapMessageRow(result.rows[0]);
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.getMessage(messageId, userId);

    // Author or channel admin can delete
    const canDelete = await this.canDeleteMessage(
      userId,
      message.channelId,
      message.userId,
    );
    if (!canDelete) {
      throw new Error("Permission denied");
    }

    await this.pool.query(
      `UPDATE messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [messageId],
    );
  }

  /**
   * List messages in a channel
   */
  async listMessages(
    userId: string,
    options: ListMessagesOptions,
  ): Promise<Message[]> {
    // Verify channel access
    await this.verifyChannelMembership(userId, options.channelId);

    const conditions: string[] = ["m.channel_id = $1", "m.deleted_at IS NULL"];
    const values: any[] = [options.channelId];
    let paramIndex = 2;

    // Thread filter
    if (options.threadId !== undefined) {
      if (options.threadId === null) {
        conditions.push("m.thread_id IS NULL");
      } else {
        conditions.push(`m.thread_id = $${paramIndex++}`);
        values.push(options.threadId);
      }
    }

    // Pagination
    if (options.before) {
      conditions.push(
        `m.created_at < (SELECT created_at FROM messages WHERE id = $${paramIndex++})`,
      );
      values.push(options.before);
    }
    if (options.after) {
      conditions.push(
        `m.created_at > (SELECT created_at FROM messages WHERE id = $${paramIndex++})`,
      );
      values.push(options.after);
    }

    const limit = options.limit || 100;

    const result = await this.pool.query<any>(
      `SELECT m.* FROM messages m
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.created_at DESC
       LIMIT ${limit}`,
      values,
    );

    return result.rows.map((row) => this.mapMessageRow(row));
  }

  /**
   * Search messages
   */
  async searchMessages(
    userId: string,
    options: SearchMessagesOptions,
  ): Promise<Message[]> {
    const conditions: string[] = ["m.deleted_at IS NULL"];
    const values: any[] = [];
    let paramIndex = 1;

    // User must be channel member (check in subquery)
    conditions.push(`EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = m.channel_id AND cm.user_id = $${paramIndex++}
    )`);
    values.push(userId);

    // Text search
    conditions.push(`m.content ILIKE $${paramIndex++}`);
    values.push(`%${options.query}%`);

    // Channel filter
    if (options.channelIds && options.channelIds.length > 0) {
      conditions.push(`m.channel_id = ANY($${paramIndex++})`);
      values.push(options.channelIds);
    }

    // User filter
    if (options.userId) {
      conditions.push(`m.user_id = $${paramIndex++}`);
      values.push(options.userId);
    }

    // Date range
    if (options.startDate) {
      conditions.push(`m.created_at >= $${paramIndex++}`);
      values.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push(`m.created_at <= $${paramIndex++}`);
      values.push(options.endDate);
    }

    // Attachments filter
    if (options.hasAttachments) {
      conditions.push(`EXISTS (
        SELECT 1 FROM message_attachments ma WHERE ma.message_id = m.id
      )`);
    }

    const limit = options.limit || 50;

    const result = await this.pool.query<any>(
      `SELECT m.* FROM messages m
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.created_at DESC
       LIMIT ${limit}`,
      values,
    );

    return result.rows.map((row) => this.mapMessageRow(row));
  }

  /**
   * Get unread message counts for user
   */
  async getUnreadCounts(userId: string): Promise<UnreadCount[]> {
    const result = await this.pool.query(
      `SELECT 
         cm.channel_id,
         COUNT(m.id) AS count,
         COUNT(mn.id) AS mention_count,
         MAX(m.created_at) AS last_message_at
       FROM channel_members cm
       JOIN messages m ON m.channel_id = cm.channel_id
       LEFT JOIN mentions mn ON mn.message_id = m.id AND mn.user_id = $1 AND mn.is_read = FALSE
       WHERE cm.user_id = $1
         AND m.deleted_at IS NULL
         AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
       GROUP BY cm.channel_id`,
      [userId],
    );

    return result.rows.map((row) => ({
      channelId: row.channel_id,
      count: parseInt(row.count, 10),
      mentionCount: parseInt(row.mention_count, 10),
      lastMessageAt: row.last_message_at,
    }));
  }

  /**
   * Mark channel as read
   */
  async markChannelAsRead(userId: string, channelId: string): Promise<void> {
    await this.verifyChannelMembership(userId, channelId);

    await this.pool.query(
      `UPDATE channel_members
       SET last_read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId],
    );

    // Mark all mentions as read
    await this.pool.query(
      `UPDATE mentions
       SET is_read = TRUE
       WHERE user_id = $1
         AND message_id IN (
           SELECT id FROM messages WHERE channel_id = $2
         )`,
      [userId, channelId],
    );
  }

  /**
   * Add reaction to message
   */
  async addReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    // Verify message access
    await this.getMessage(messageId, userId);

    await this.pool.query(
      `INSERT INTO reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [messageId, userId, emoji],
    );
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM reactions
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji],
    );
  }

  /**
   * Pin a message
   */
  async pinMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.getMessage(messageId, userId);

    // Must be channel admin/owner
    const isAdmin = await this.isChannelAdmin(userId, message.channelId);
    if (!isAdmin) {
      throw new Error("Only channel admins can pin messages");
    }

    await this.pool.query(
      `UPDATE messages SET is_pinned = TRUE WHERE id = $1`,
      [messageId],
    );
  }

  /**
   * Unpin a message
   */
  async unpinMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.getMessage(messageId, userId);

    const isAdmin = await this.isChannelAdmin(userId, message.channelId);
    if (!isAdmin) {
      throw new Error("Only channel admins can unpin messages");
    }

    await this.pool.query(
      `UPDATE messages SET is_pinned = FALSE WHERE id = $1`,
      [messageId],
    );
  }

  // NOT IMPLEMENTED - Fail fast features

  async uploadFile(): Promise<never> {
    throw new NotImplementedError("File upload - use SkyDrive integration");
  }

  async sendVoiceMessage(): Promise<never> {
    throw new NotImplementedError(
      "Voice messages - needs audio recording/playback",
    );
  }

  async createPoll(): Promise<never> {
    throw new NotImplementedError("Polls - needs poll UI and voting system");
  }

  async scheduleMessage(): Promise<never> {
    throw new NotImplementedError(
      "Scheduled messages - needs background job system",
    );
  }

  async forwardMessage(): Promise<never> {
    throw new NotImplementedError(
      "Message forwarding - needs multi-channel posting",
    );
  }

  // Helper methods

  private async verifyChannelMembership(
    userId: string,
    channelId: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM channel_members WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId],
    );

    if (result.rows.length === 0) {
      throw new Error("Not a member of this channel");
    }
  }

  private async isChannelAdmin(
    userId: string,
    channelId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT role FROM channel_members
       WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    return ["admin", "owner"].includes(result.rows[0].role);
  }

  private async canDeleteMessage(
    userId: string,
    channelId: string,
    messageAuthorId: string,
  ): Promise<boolean> {
    // Author can delete
    if (userId === messageAuthorId) {
      return true;
    }

    // Channel admin can delete
    return this.isChannelAdmin(userId, channelId);
  }

  private async processMentions(
    client: any,
    messageId: string,
    mentionedBy: string,
    content: string,
  ): Promise<void> {
    // Extract @mentions from content
    const mentionPattern = /@(\w+)/g;
    const matches = content.matchAll(mentionPattern);

    for (const match of matches) {
      const username = match[1];

      // Find user by username (simplified - in production, use proper username lookup)
      const userResult = await client.query(
        `SELECT id FROM users WHERE email LIKE $1 OR display_name LIKE $1`,
        [`%${username}%`],
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        await client.query(
          `INSERT INTO mentions (message_id, user_id, mentioned_by)
           VALUES ($1, $2, $3)`,
          [messageId, userId, mentionedBy],
        );
      }
    }
  }

  private mapMessageRow(row: any): Message {
    return {
      id: row.id,
      channelId: row.channel_id,
      userId: row.user_id,
      content: row.content,
      threadId: row.thread_id,
      replyCount: row.reply_count,
      lastReplyAt: row.last_reply_at,
      isPinned: row.is_pinned,
      isEdited: row.is_edited,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
