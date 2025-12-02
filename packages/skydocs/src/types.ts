/**
 * SkyDocs Types
 * Complete type definitions for collaborative document editing
 */

export interface Document {
  id: string;
  title: string;
  content: DocumentContent;
  ownerId: string;
  folderId?: string; // SkyDrive integration
  visibility: DocumentVisibility;
  status: DocumentStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastEditedBy?: string;
  deletedAt?: Date;
}

export enum DocumentVisibility {
  PRIVATE = "private",
  SHARED = "shared",
  PUBLIC = "public",
}

export enum DocumentStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export interface DocumentContent {
  format: "prosemirror" | "markdown" | "html" | "plain";
  data: any; // Format-specific content structure
  checksum?: string; // For integrity verification
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  title: string;
  content: DocumentContent;
  createdBy: string;
  createdAt: Date;
  changeDescription?: string;
}

export enum SharePermission {
  VIEW = "view", // Read-only
  COMMENT = "comment", // Can add comments/suggestions
  EDIT = "edit", // Can edit content
  OWNER = "owner", // Full control
}

export interface DocumentShare {
  id: string;
  documentId: string;
  sharedBy: string;
  sharedWith?: string; // null for public shares
  permission: SharePermission;
  expiresAt?: Date;
  createdAt: Date;
}

export interface Comment {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  position?: CommentPosition; // Where in the document
  resolved: boolean;
  parentId?: string; // For threaded comments
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CommentPosition {
  from: number; // Character position start
  to: number; // Character position end
  version: number; // Document version when comment was created
}

export interface Suggestion {
  id: string;
  documentId: string;
  userId: string;
  type: SuggestionType;
  position: SuggestionPosition;
  originalContent?: string;
  suggestedContent?: string;
  status: SuggestionStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum SuggestionType {
  INSERT = "insert",
  DELETE = "delete",
  REPLACE = "replace",
  FORMAT = "format",
}

export interface SuggestionPosition {
  from: number;
  to: number;
  version: number;
}

export enum SuggestionStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export interface CollaborationSession {
  id: string;
  documentId: string;
  userId: string;
  cursorPosition?: number;
  selectionStart?: number;
  selectionEnd?: number;
  lastActivityAt: Date;
  expiresAt: Date;
}

// Request/Response DTOs

export interface CreateDocumentRequest {
  title: string;
  content?: DocumentContent;
  folderId?: string;
  visibility?: DocumentVisibility;
  status?: DocumentStatus;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: DocumentContent;
  visibility?: DocumentVisibility;
  status?: DocumentStatus;
}

export interface ListDocumentsOptions {
  folderId?: string;
  visibility?: DocumentVisibility;
  status?: DocumentStatus;
  ownedByMe?: boolean;
  sharedWithMe?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCommentRequest {
  content: string;
  position?: CommentPosition;
  parentId?: string;
}

export interface CreateSuggestionRequest {
  type: SuggestionType;
  position: SuggestionPosition;
  originalContent?: string;
  suggestedContent?: string;
}

export interface AcceptSuggestionRequest {
  suggestionId: string;
}

export interface RejectSuggestionRequest {
  suggestionId: string;
  reason?: string;
}

// Export/Import formats

export interface ExportOptions {
  format: "pdf" | "docx" | "markdown" | "html" | "plain";
  includeComments?: boolean;
  includeSuggestions?: boolean;
}

export interface ImportOptions {
  format: "docx" | "markdown" | "html" | "plain";
  preserveFormatting?: boolean;
}

// Real-time collaboration types

export interface Operation {
  type: "insert" | "delete" | "retain";
  position?: number;
  length?: number;
  text?: string;
  attributes?: Record<string, any>;
  userId: string;
  timestamp: number;
}

export interface OperationTransform {
  operation: Operation;
  baseVersion: number;
  resultVersion: number;
}

// Template types

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  content: DocumentContent;
  thumbnail?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

export enum TemplateCategory {
  BLANK = "blank",
  BUSINESS = "business",
  EDUCATION = "education",
  PERSONAL = "personal",
  LEGAL = "legal",
  CREATIVE = "creative",
}
