/**
 * SkyChat Types
 * Slack-inspired team messaging and collaboration
 */

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  organizationId?: string;
  createdBy: string;
  isArchived: boolean;
  isGeneral: boolean; // Default channel for organization
  createdAt: Date;
  updatedAt: Date;
}

export enum ChannelType {
  PUBLIC = "public", // Anyone in org can join
  PRIVATE = "private", // Invite-only
  DIRECT = "direct", // 1:1 DM
  GROUP = "group", // Group DM (multiple users)
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  role: ChannelRole;
  joinedAt: Date;
  lastReadAt?: Date; // For unread tracking
  notificationLevel: NotificationLevel;
}

export enum ChannelRole {
  MEMBER = "member",
  ADMIN = "admin",
  OWNER = "owner",
}

export enum NotificationLevel {
  ALL = "all", // All messages
  MENTIONS = "mentions", // Only @mentions
  NONE = "none", // Muted
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  threadId?: string; // Parent message for threaded replies
  replyCount: number;
  lastReplyAt?: Date;
  isPinned: boolean;
  isEdited: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  fileId: string; // References SkyDrive file
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface Mention {
  id: string;
  messageId: string;
  userId: string; // Who was mentioned
  mentionedBy: string; // Who mentioned them
  isRead: boolean;
  createdAt: Date;
}

export interface PresenceStatus {
  userId: string;
  status: UserStatus;
  statusText?: string;
  lastActiveAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ONLINE = "online",
  AWAY = "away",
  DND = "dnd", // Do Not Disturb
  OFFLINE = "offline",
}

// Request/Response DTOs

export interface CreateChannelRequest {
  name: string;
  description?: string;
  type: ChannelType;
  organizationId?: string;
  isPrivate?: boolean;
  memberIds?: string[]; // Initial members
}

export interface UpdateChannelRequest {
  name?: string;
  description?: string;
  isArchived?: boolean;
}

export interface SendMessageRequest {
  content: string;
  threadId?: string; // Reply to thread
  attachments?: string[]; // File IDs
}

export interface UpdateMessageRequest {
  content: string;
}

export interface ListMessagesOptions {
  channelId: string;
  threadId?: string; // Get thread replies
  limit?: number;
  before?: string; // Message ID for pagination
  after?: string;
  includeDeleted?: boolean;
}

export interface SearchMessagesOptions {
  query: string;
  channelIds?: string[];
  userId?: string; // From specific user
  hasAttachments?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface CreateDirectMessageRequest {
  recipientId: string;
  content: string;
}

// Thread and reply types

export interface Thread {
  id: string; // Message ID of parent
  channelId: string;
  userId: string;
  content: string;
  replyCount: number;
  participants: string[]; // User IDs who replied
  lastReplyAt: Date;
  createdAt: Date;
}

export interface ThreadReply {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

// Unread tracking

export interface UnreadCount {
  channelId: string;
  count: number;
  mentionCount: number;
  lastMessageAt?: Date;
}

// Export for integrations

export interface Webhook {
  id: string;
  channelId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export enum WebhookEvent {
  MESSAGE_SENT = "message.sent",
  MESSAGE_DELETED = "message.deleted",
  CHANNEL_CREATED = "channel.created",
  MEMBER_JOINED = "member.joined",
  MEMBER_LEFT = "member.left",
}
