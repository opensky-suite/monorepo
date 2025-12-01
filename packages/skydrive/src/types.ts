/**
 * SkyDrive Types
 */

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  ownerId: string;
  folderId: string | null;
  path: string;
  storageKey: string;
  version: number;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface FolderMetadata {
  id: string;
  name: string;
  ownerId: string;
  parentId: string | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  size: number;
  storageKey: string;
  checksum: string;
  createdAt: Date;
  createdBy: string;
}

export interface FileShare {
  id: string;
  fileId: string;
  sharedBy: string;
  sharedWith?: string; // null for public shares
  permission: SharePermission;
  expiresAt?: Date;
  createdAt: Date;
}

export interface FolderShare {
  id: string;
  folderId: string;
  sharedBy: string;
  sharedWith?: string;
  permission: SharePermission;
  expiresAt?: Date;
  createdAt: Date;
}

export enum SharePermission {
  VIEW = "view",
  EDIT = "edit",
  COMMENT = "comment",
}

export interface UploadOptions {
  folderId?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface DownloadOptions {
  version?: number;
  expiresIn?: number; // seconds
}

export interface StorageConfig {
  provider: "local" | "s3" | "minio";
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  localPath?: string;
}
