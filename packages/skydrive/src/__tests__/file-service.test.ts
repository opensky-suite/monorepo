/**
 * FileService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileService } from "../file-service.js";
import type { StorageProvider } from "../storage.js";
import type { Pool, QueryResult } from "pg";
import type { FileMetadata, FileShare, SharePermission } from "../types.js";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock-id-123"),
}));

// Mock Storage Provider
class MockStorageProvider implements StorageProvider {
  private storage: Map<string, Buffer> = new Map();

  async upload(key: string, data: Buffer, contentType?: string): Promise<void> {
    this.storage.set(key, data);
  }

  async download(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) {
      throw new Error("File not found in storage");
    }
    return data;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async getDownloadUrl(key: string, expiresIn: number): Promise<string> {
    return `https://storage.example.com/${key}?expires=${expiresIn}`;
  }

  async getUploadUrl(key: string, expiresIn: number): Promise<string> {
    return `https://storage.example.com/upload/${key}?expires=${expiresIn}`;
  }

  // Helper for testing
  clear() {
    this.storage.clear();
  }
}

// Mock Pool
class MockPool {
  public query = vi.fn();

  setQueryMock(mock: any) {
    this.query = mock;
  }

  clearMocks() {
    this.query.mockClear();
  }
}

describe("FileService", () => {
  let fileService: FileService;
  let mockPool: MockPool;
  let mockStorage: MockStorageProvider;

  beforeEach(() => {
    mockPool = new MockPool();
    mockStorage = new MockStorageProvider();
    fileService = new FileService(mockPool as unknown as Pool, mockStorage);
  });

  afterEach(() => {
    mockPool.clearMocks();
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      const fileData = Buffer.from("test file content");
      const ownerId = "user-123";
      const fileName = "test.txt";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "mock-id-123",
              name: fileName,
              mime_type: "text/plain",
              size: fileData.length,
              owner_id: ownerId,
              folder_id: null,
              path: `/${fileName}`,
              storage_key: `files/${ownerId}/mock-id-123/${fileName}`,
              version: 1,
              checksum: "dGVzdCBmaWxlIGNvbnRlbnQ=",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await fileService.uploadFile(ownerId, fileName, fileData);

      expect(result.id).toBe("mock-id-123");
      expect(result.name).toBe(fileName);
      expect(result.mimeType).toBe("text/plain");
      expect(result.size).toBe(fileData.length);
      expect(result.ownerId).toBe(ownerId);
    });

    it("should upload file to specific folder", async () => {
      const fileData = Buffer.from("test file content");
      const ownerId = "user-123";
      const fileName = "test.txt";
      const folderId = "folder-456";

      // Mock folder query
      mockPool.setQueryMock(
        vi
          .fn()
          .mockResolvedValueOnce({
            rows: [{ path: "/Documents" }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: "mock-id-123",
                name: fileName,
                mime_type: "text/plain",
                size: fileData.length,
                owner_id: ownerId,
                folder_id: folderId,
                path: `/Documents/${fileName}`,
                storage_key: `files/${ownerId}/mock-id-123/${fileName}`,
                version: 1,
                checksum: "dGVzdCBmaWxlIGNvbnRlbnQ=",
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }),
      );

      const result = await fileService.uploadFile(ownerId, fileName, fileData, {
        folderId,
      });

      expect(result.path).toBe(`/Documents/${fileName}`);
      expect(result.folderId).toBe(folderId);
    });

    it("should use custom content type", async () => {
      const fileData = Buffer.from("test file content");
      const ownerId = "user-123";
      const fileName = "test.txt";
      const customType = "application/custom";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "mock-id-123",
              name: fileName,
              mime_type: customType,
              size: fileData.length,
              owner_id: ownerId,
              folder_id: null,
              path: `/${fileName}`,
              storage_key: `files/${ownerId}/mock-id-123/${fileName}`,
              version: 1,
              checksum: "dGVzdCBmaWxlIGNvbnRlbnQ=",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await fileService.uploadFile(ownerId, fileName, fileData, {
        contentType: customType,
      });

      expect(result.mimeType).toBe(customType);
    });

    it("should detect MIME type from file extension", async () => {
      const fileData = Buffer.from("test file content");
      const ownerId = "user-123";
      const fileName = "test.pdf";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "mock-id-123",
              name: fileName,
              mime_type: "application/pdf",
              size: fileData.length,
              owner_id: ownerId,
              folder_id: null,
              path: `/${fileName}`,
              storage_key: `files/${ownerId}/mock-id-123/${fileName}`,
              version: 1,
              checksum: "dGVzdCBmaWxlIGNvbnRlbnQ=",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await fileService.uploadFile(ownerId, fileName, fileData);

      expect(result.mimeType).toBe("application/pdf");
    });
  });

  describe("downloadFile", () => {
    it("should download file for owner", async () => {
      const fileId = "file-123";
      const userId = "user-123";
      const fileData = Buffer.from("test file content");

      // Mock file lookup
      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                mime_type: "text/plain",
                size: fileData.length,
                owner_id: userId,
                folder_id: null,
                path: "/test.txt",
                storage_key: "files/user-123/file-123/test.txt",
                version: 1,
                checksum: "abc123",
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          })
          // getFile call in checkFilePermission
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                mime_type: "text/plain",
                size: fileData.length,
                owner_id: userId,
                folder_id: null,
                path: "/test.txt",
                storage_key: "files/user-123/file-123/test.txt",
                version: 1,
                checksum: "abc123",
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }),
      );

      // Upload file to mock storage
      await mockStorage.upload(
        "files/user-123/file-123/test.txt",
        fileData,
        "text/plain",
      );

      const result = await fileService.downloadFile(fileId, userId);

      expect(result).toEqual(fileData);
    });

    it("should download file with view permission", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const userId = "user-456";
      const fileData = Buffer.from("test file content");

      // Mock queries (order matters: checkFilePermission is called first)
      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call in checkFilePermission (first)
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                mime_type: "text/plain",
                size: fileData.length,
                owner_id: ownerId,
                folder_id: null,
                path: "/test.txt",
                storage_key: "files/owner-123/file-123/test.txt",
                version: 1,
                checksum: "abc123",
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          })
          // file_shares query (second, in checkFilePermission)
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                file_id: fileId,
                shared_by: ownerId,
                shared_with: userId,
                permission: "view",
                expires_at: null,
                created_at: new Date(),
              },
            ],
          })
          // getFile call (third, in downloadFile)
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                mime_type: "text/plain",
                size: fileData.length,
                owner_id: ownerId,
                folder_id: null,
                path: "/test.txt",
                storage_key: "files/owner-123/file-123/test.txt",
                version: 1,
                checksum: "abc123",
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }),
      );

      // Upload file to mock storage
      await mockStorage.upload(
        "files/owner-123/file-123/test.txt",
        fileData,
        "text/plain",
      );

      const result = await fileService.downloadFile(fileId, userId);

      expect(result).toEqual(fileData);
    });

    it("should throw error for file not found", async () => {
      const fileId = "nonexistent-file";
      const userId = "user-123";

      mockPool.setQueryMock(vi.fn().mockResolvedValue({ rows: [] }));

      await expect(fileService.downloadFile(fileId, userId)).rejects.toThrow(
        "File not found",
      );
    });

    it("should throw error for permission denied", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const userId = "user-456";

      // Mock queries
      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call in checkFilePermission
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                owner_id: ownerId,
                storage_key: "files/owner-123/file-123/test.txt",
              },
            ],
          })
          // file_shares query (no shares found)
          .mockResolvedValueOnce({
            rows: [],
          }),
      );

      await expect(fileService.downloadFile(fileId, userId)).rejects.toThrow(
        "Permission denied",
      );
    });

    it("should download specific version", async () => {
      const fileId = "file-123";
      const userId = "user-123";
      const fileData = Buffer.from("old version content");

      // Mock queries
      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call in checkFilePermission
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: userId,
                storage_key: "files/user-123/file-123/test.txt",
              },
            ],
          })
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                mime_type: "text/plain",
                size: fileData.length,
                owner_id: userId,
                folder_id: null,
                path: "/test.txt",
                storage_key: "files/user-123/file-123/test.txt",
                version: 2,
                checksum: "abc123",
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          })
          // file_versions query
          .mockResolvedValueOnce({
            rows: [
              {
                storage_key: "files/user-123/file-123/test.txt.v1",
              },
            ],
          }),
      );

      // Upload old version to mock storage
      await mockStorage.upload(
        "files/user-123/file-123/test.txt.v1",
        fileData,
        "text/plain",
      );

      const result = await fileService.downloadFile(fileId, userId, {
        version: 1,
      });

      expect(result).toEqual(fileData);
    });
  });

  describe("getFile", () => {
    it("should get file metadata", async () => {
      const fileId = "file-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: fileId,
              name: "test.txt",
              mime_type: "text/plain",
              size: 1024,
              owner_id: "user-123",
              folder_id: null,
              path: "/test.txt",
              storage_key: "files/user-123/file-123/test.txt",
              version: 1,
              checksum: "abc123",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await fileService.getFile(fileId);

      expect(result.id).toBe(fileId);
      expect(result.name).toBe("test.txt");
    });

    it("should throw error for non-existent file", async () => {
      mockPool.setQueryMock(vi.fn().mockResolvedValue({ rows: [] }));

      await expect(fileService.getFile("nonexistent")).rejects.toThrow(
        "File not found",
      );
    });
  });

  describe("listFiles", () => {
    it("should list all files for owner", async () => {
      const ownerId = "user-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "file-1",
              name: "file1.txt",
              mime_type: "text/plain",
              size: 1024,
              owner_id: ownerId,
              folder_id: null,
              path: "/file1.txt",
              storage_key: "files/user-123/file-1/file1.txt",
              version: 1,
              checksum: "abc123",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            {
              id: "file-2",
              name: "file2.txt",
              mime_type: "text/plain",
              size: 2048,
              owner_id: ownerId,
              folder_id: null,
              path: "/file2.txt",
              storage_key: "files/user-123/file-2/file2.txt",
              version: 1,
              checksum: "def456",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await fileService.listFiles(ownerId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("file1.txt");
      expect(result[1].name).toBe("file2.txt");
    });

    it("should list files in specific folder", async () => {
      const ownerId = "user-123";
      const folderId = "folder-456";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "file-1",
              name: "file1.txt",
              mime_type: "text/plain",
              size: 1024,
              owner_id: ownerId,
              folder_id: folderId,
              path: "/Documents/file1.txt",
              storage_key: "files/user-123/file-1/file1.txt",
              version: 1,
              checksum: "abc123",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await fileService.listFiles(ownerId, folderId);

      expect(result).toHaveLength(1);
      expect(result[0].folderId).toBe(folderId);
    });
  });

  describe("deleteFile", () => {
    it("should soft delete file", async () => {
      const fileId = "file-123";
      const userId = "user-123";

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                owner_id: userId,
                storage_key: "files/user-123/file-123/test.txt",
              },
            ],
          })
          // DELETE query
          .mockResolvedValueOnce({ rows: [] }),
      );

      await fileService.deleteFile(fileId, userId);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it("should throw error if not owner", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const userId = "user-456";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: fileId,
              name: "test.txt",
              owner_id: ownerId,
              storage_key: "files/owner-123/file-123/test.txt",
            },
          ],
        }),
      );

      await expect(fileService.deleteFile(fileId, userId)).rejects.toThrow(
        "Permission denied",
      );
    });
  });

  describe("shareFile", () => {
    it("should share file with specific user", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const sharedWith = "user-456";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                name: "test.txt",
                owner_id: ownerId,
                storage_key: "files/owner-123/file-123/test.txt",
              },
            ],
          })
          // INSERT INTO file_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                file_id: fileId,
                shared_by: ownerId,
                shared_with: sharedWith,
                permission,
                expires_at: null,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await fileService.shareFile(
        fileId,
        ownerId,
        sharedWith,
        permission,
      );

      expect(result.fileId).toBe(fileId);
      expect(result.sharedWith).toBe(sharedWith);
      expect(result.permission).toBe(permission);
    });

    it("should create public share", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: ownerId,
              },
            ],
          })
          // INSERT INTO file_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                file_id: fileId,
                shared_by: ownerId,
                shared_with: null,
                permission,
                expires_at: null,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await fileService.shareFile(
        fileId,
        ownerId,
        null,
        permission,
      );

      expect(result.sharedWith).toBeNull();
    });

    it("should set expiration date", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const sharedWith = "user-456";
      const permission = "view" as SharePermission;
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call
          .mockResolvedValueOnce({
            rows: [{ id: fileId, owner_id: ownerId }],
          })
          // INSERT INTO file_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                file_id: fileId,
                shared_by: ownerId,
                shared_with: sharedWith,
                permission,
                expires_at: expiresAt,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await fileService.shareFile(
        fileId,
        ownerId,
        sharedWith,
        permission,
        expiresAt,
      );

      expect(result.expiresAt).toEqual(expiresAt);
    });

    it("should throw error if not owner", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const userId = "user-456";
      const sharedWith = "user-789";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [{ id: fileId, owner_id: ownerId }],
        }),
      );

      await expect(
        fileService.shareFile(fileId, userId, sharedWith, permission),
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("getDownloadUrl", () => {
    it("should generate download URL for owner", async () => {
      const fileId = "file-123";
      const userId = "user-123";

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call in checkFilePermission
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: userId,
                storage_key: "files/user-123/file-123/test.txt",
              },
            ],
          })
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: userId,
                storage_key: "files/user-123/file-123/test.txt",
              },
            ],
          }),
      );

      const result = await fileService.getDownloadUrl(fileId, userId);

      expect(result).toContain("storage.example.com");
      expect(result).toContain("files/user-123/file-123/test.txt");
    });

    it("should respect custom expiration time", async () => {
      const fileId = "file-123";
      const userId = "user-123";
      const expiresIn = 7200; // 2 hours

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call in checkFilePermission
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: userId,
                storage_key: "files/user-123/file-123/test.txt",
              },
            ],
          })
          // getFile call
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: userId,
                storage_key: "files/user-123/file-123/test.txt",
              },
            ],
          }),
      );

      const result = await fileService.getDownloadUrl(
        fileId,
        userId,
        expiresIn,
      );

      expect(result).toContain(`expires=${expiresIn}`);
    });

    it("should throw error for permission denied", async () => {
      const fileId = "file-123";
      const ownerId = "owner-123";
      const userId = "user-456";

      mockPool.setQueryMock(
        vi
          .fn()
          // getFile call in checkFilePermission
          .mockResolvedValueOnce({
            rows: [
              {
                id: fileId,
                owner_id: ownerId,
                storage_key: "files/owner-123/file-123/test.txt",
              },
            ],
          })
          // file_shares query (no shares)
          .mockResolvedValueOnce({ rows: [] }),
      );

      await expect(fileService.getDownloadUrl(fileId, userId)).rejects.toThrow(
        "Permission denied",
      );
    });
  });
});
