/**
 * FolderService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FolderService } from "../folder-service.js";
import type { Pool, QueryResult } from "pg";
import type { FolderMetadata, FolderShare, SharePermission } from "../types.js";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock-folder-id"),
}));

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

describe("FolderService", () => {
  let folderService: FolderService;
  let mockPool: MockPool;

  beforeEach(() => {
    mockPool = new MockPool();
    folderService = new FolderService(mockPool as unknown as Pool);
  });

  afterEach(() => {
    mockPool.clearMocks();
    vi.clearAllMocks();
  });

  describe("createFolder", () => {
    it("should create root folder", async () => {
      const ownerId = "user-123";
      const folderName = "Documents";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "mock-folder-id",
              name: folderName,
              owner_id: ownerId,
              parent_id: null,
              path: `/${folderName}`,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await folderService.createFolder(ownerId, folderName);

      expect(result.id).toBe("mock-folder-id");
      expect(result.name).toBe(folderName);
      expect(result.ownerId).toBe(ownerId);
      expect(result.parentId).toBeNull();
      expect(result.path).toBe(`/${folderName}`);
    });

    it("should create nested folder", async () => {
      const ownerId = "user-123";
      const folderName = "Work";
      const parentId = "parent-folder-id";

      mockPool.setQueryMock(
        vi
          .fn()
          // Parent folder query
          .mockResolvedValueOnce({
            rows: [
              {
                path: "/Documents",
              },
            ],
          })
          // INSERT folder query
          .mockResolvedValueOnce({
            rows: [
              {
                id: "mock-folder-id",
                name: folderName,
                owner_id: ownerId,
                parent_id: parentId,
                path: `/Documents/${folderName}`,
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }),
      );

      const result = await folderService.createFolder(
        ownerId,
        folderName,
        parentId,
      );

      expect(result.path).toBe(`/Documents/${folderName}`);
      expect(result.parentId).toBe(parentId);
    });

    it("should handle missing parent gracefully", async () => {
      const ownerId = "user-123";
      const folderName = "Orphan";
      const parentId = "nonexistent-parent";

      mockPool.setQueryMock(
        vi
          .fn()
          // Parent folder query (not found)
          .mockResolvedValueOnce({
            rows: [],
          })
          // INSERT folder query
          .mockResolvedValueOnce({
            rows: [
              {
                id: "mock-folder-id",
                name: folderName,
                owner_id: ownerId,
                parent_id: parentId,
                path: `/${folderName}`, // Falls back to root path
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }),
      );

      const result = await folderService.createFolder(
        ownerId,
        folderName,
        parentId,
      );

      expect(result.path).toBe(`/${folderName}`);
    });

    it("should create deeply nested folder", async () => {
      const ownerId = "user-123";
      const folderName = "2024";
      const parentId = "parent-folder-id";

      mockPool.setQueryMock(
        vi
          .fn()
          // Parent folder query
          .mockResolvedValueOnce({
            rows: [
              {
                path: "/Documents/Work/Projects",
              },
            ],
          })
          // INSERT folder query
          .mockResolvedValueOnce({
            rows: [
              {
                id: "mock-folder-id",
                name: folderName,
                owner_id: ownerId,
                parent_id: parentId,
                path: `/Documents/Work/Projects/${folderName}`,
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }),
      );

      const result = await folderService.createFolder(
        ownerId,
        folderName,
        parentId,
      );

      expect(result.path).toBe(`/Documents/Work/Projects/${folderName}`);
    });
  });

  describe("getFolder", () => {
    it("should get folder by id", async () => {
      const folderId = "folder-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: folderId,
              name: "Documents",
              owner_id: "user-123",
              parent_id: null,
              path: "/Documents",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await folderService.getFolder(folderId);

      expect(result.id).toBe(folderId);
      expect(result.name).toBe("Documents");
    });

    it("should throw error for non-existent folder", async () => {
      const folderId = "nonexistent-folder";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [],
        }),
      );

      await expect(folderService.getFolder(folderId)).rejects.toThrow(
        "Folder not found",
      );
    });

    it("should not return deleted folders", async () => {
      const folderId = "deleted-folder";

      // Deleted folders are filtered by SQL WHERE clause
      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [],
        }),
      );

      await expect(folderService.getFolder(folderId)).rejects.toThrow(
        "Folder not found",
      );
    });
  });

  describe("listFolders", () => {
    it("should list root folders for owner", async () => {
      const ownerId = "user-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "folder-1",
              name: "Documents",
              owner_id: ownerId,
              parent_id: null,
              path: "/Documents",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            {
              id: "folder-2",
              name: "Photos",
              owner_id: ownerId,
              parent_id: null,
              path: "/Photos",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await folderService.listFolders(ownerId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Documents");
      expect(result[1].name).toBe("Photos");
      expect(result[0].parentId).toBeNull();
      expect(result[1].parentId).toBeNull();
    });

    it("should list subfolders in specific folder", async () => {
      const ownerId = "user-123";
      const parentId = "folder-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "subfolder-1",
              name: "Work",
              owner_id: ownerId,
              parent_id: parentId,
              path: "/Documents/Work",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            {
              id: "subfolder-2",
              name: "Personal",
              owner_id: ownerId,
              parent_id: parentId,
              path: "/Documents/Personal",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await folderService.listFolders(ownerId, parentId);

      expect(result).toHaveLength(2);
      expect(result[0].parentId).toBe(parentId);
      expect(result[1].parentId).toBe(parentId);
    });

    it("should return empty array when no folders", async () => {
      const ownerId = "user-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [],
        }),
      );

      const result = await folderService.listFolders(ownerId);

      expect(result).toHaveLength(0);
    });

    it("should not return deleted folders", async () => {
      const ownerId = "user-123";

      // Deleted folders are filtered by SQL WHERE clause
      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: "folder-1",
              name: "Active",
              owner_id: ownerId,
              parent_id: null,
              path: "/Active",
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }),
      );

      const result = await folderService.listFolders(ownerId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Active");
    });
  });

  describe("deleteFolder", () => {
    it("should soft delete folder", async () => {
      const folderId = "folder-123";
      const userId = "user-123";

      mockPool.setQueryMock(
        vi
          .fn()
          // getFolder call
          .mockResolvedValueOnce({
            rows: [
              {
                id: folderId,
                name: "Documents",
                owner_id: userId,
                parent_id: null,
                path: "/Documents",
              },
            ],
          })
          // UPDATE folders
          .mockResolvedValueOnce({ rows: [] })
          // UPDATE files
          .mockResolvedValueOnce({ rows: [] }),
      );

      await folderService.deleteFolder(folderId, userId);

      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it("should delete files in folder", async () => {
      const folderId = "folder-123";
      const userId = "user-123";

      const updateFilesMock = vi.fn().mockResolvedValue({ rows: [] });

      mockPool.setQueryMock(
        vi
          .fn()
          // getFolder call
          .mockResolvedValueOnce({
            rows: [
              {
                id: folderId,
                owner_id: userId,
              },
            ],
          })
          // UPDATE folders
          .mockResolvedValueOnce({ rows: [] })
          // UPDATE files
          .mockImplementationOnce(updateFilesMock),
      );

      await folderService.deleteFolder(folderId, userId);

      // Verify files were deleted
      expect(updateFilesMock).toHaveBeenCalled();
    });

    it("should throw error if not owner", async () => {
      const folderId = "folder-123";
      const ownerId = "owner-123";
      const userId = "user-456";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [
            {
              id: folderId,
              name: "Documents",
              owner_id: ownerId,
              parent_id: null,
              path: "/Documents",
            },
          ],
        }),
      );

      await expect(
        folderService.deleteFolder(folderId, userId),
      ).rejects.toThrow("Permission denied");
    });

    it("should throw error for non-existent folder", async () => {
      const folderId = "nonexistent-folder";
      const userId = "user-123";

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [],
        }),
      );

      await expect(
        folderService.deleteFolder(folderId, userId),
      ).rejects.toThrow("Folder not found");
    });
  });

  describe("shareFolder", () => {
    it("should share folder with specific user", async () => {
      const folderId = "folder-123";
      const ownerId = "owner-123";
      const sharedWith = "user-456";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi
          .fn()
          // getFolder call
          .mockResolvedValueOnce({
            rows: [
              {
                id: folderId,
                name: "Documents",
                owner_id: ownerId,
                parent_id: null,
                path: "/Documents",
              },
            ],
          })
          // INSERT INTO folder_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                folder_id: folderId,
                shared_by: ownerId,
                shared_with: sharedWith,
                permission,
                expires_at: null,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await folderService.shareFolder(
        folderId,
        ownerId,
        sharedWith,
        permission,
      );

      expect(result.folderId).toBe(folderId);
      expect(result.sharedWith).toBe(sharedWith);
      expect(result.permission).toBe(permission);
    });

    it("should create public share", async () => {
      const folderId = "folder-123";
      const ownerId = "owner-123";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi
          .fn()
          // getFolder call
          .mockResolvedValueOnce({
            rows: [
              {
                id: folderId,
                owner_id: ownerId,
              },
            ],
          })
          // INSERT INTO folder_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                folder_id: folderId,
                shared_by: ownerId,
                shared_with: null,
                permission,
                expires_at: null,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await folderService.shareFolder(
        folderId,
        ownerId,
        null,
        permission,
      );

      expect(result.sharedWith).toBeNull();
    });

    it("should set expiration date", async () => {
      const folderId = "folder-123";
      const ownerId = "owner-123";
      const sharedWith = "user-456";
      const permission = "view" as SharePermission;
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now

      mockPool.setQueryMock(
        vi
          .fn()
          // getFolder call
          .mockResolvedValueOnce({
            rows: [{ id: folderId, owner_id: ownerId }],
          })
          // INSERT INTO folder_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                folder_id: folderId,
                shared_by: ownerId,
                shared_with: sharedWith,
                permission,
                expires_at: expiresAt,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await folderService.shareFolder(
        folderId,
        ownerId,
        sharedWith,
        permission,
        expiresAt,
      );

      expect(result.expiresAt).toEqual(expiresAt);
    });

    it("should allow edit permission", async () => {
      const folderId = "folder-123";
      const ownerId = "owner-123";
      const sharedWith = "user-456";
      const permission = "edit" as SharePermission;

      mockPool.setQueryMock(
        vi
          .fn()
          // getFolder call
          .mockResolvedValueOnce({
            rows: [{ id: folderId, owner_id: ownerId }],
          })
          // INSERT INTO folder_shares
          .mockResolvedValueOnce({
            rows: [
              {
                id: "share-123",
                folder_id: folderId,
                shared_by: ownerId,
                shared_with: sharedWith,
                permission,
                expires_at: null,
                created_at: new Date(),
              },
            ],
          }),
      );

      const result = await folderService.shareFolder(
        folderId,
        ownerId,
        sharedWith,
        permission,
      );

      expect(result.permission).toBe("edit");
    });

    it("should throw error if not owner", async () => {
      const folderId = "folder-123";
      const ownerId = "owner-123";
      const userId = "user-456";
      const sharedWith = "user-789";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [{ id: folderId, owner_id: ownerId }],
        }),
      );

      await expect(
        folderService.shareFolder(folderId, userId, sharedWith, permission),
      ).rejects.toThrow("Permission denied");
    });

    it("should throw error for non-existent folder", async () => {
      const folderId = "nonexistent-folder";
      const ownerId = "owner-123";
      const sharedWith = "user-456";
      const permission = "view" as SharePermission;

      mockPool.setQueryMock(
        vi.fn().mockResolvedValue({
          rows: [],
        }),
      );

      await expect(
        folderService.shareFolder(folderId, ownerId, sharedWith, permission),
      ).rejects.toThrow("Folder not found");
    });
  });
});
