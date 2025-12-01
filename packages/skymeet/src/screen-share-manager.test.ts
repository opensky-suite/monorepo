/**
 * ScreenShareManager Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScreenShareManager } from "./screen-share-manager.js";
import { MediaStreamManager } from "./media-stream-manager.js";
import { PeerConnectionManager } from "./peer-connection-manager.js";
import { StreamError } from "./errors.js";

// Mock classes from previous tests
class MockMediaStreamTrack {
  kind: string;
  enabled = true;
  readyState: "live" | "ended" = "live";
  private eventListeners: Map<string, ((event: any) => void)[]> = new Map();

  constructor(kind: "audio" | "video") {
    this.kind = kind;
  }

  stop(): void {
    this.readyState = "ended";
    const handlers = this.eventListeners.get("ended") || [];
    handlers.forEach((handler) => handler({ type: "ended" }));
  }

  addEventListener(event: string, handler: (event: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  removeEventListener(event: string, handler: (event: any) => void): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

class MockMediaStream {
  private tracks: MediaStreamTrack[] = [];

  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks;
  }

  getTracks(): MediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => (t as any).kind === "audio");
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => (t as any).kind === "video");
  }
}

describe("ScreenShareManager", () => {
  let screenShareManager: ScreenShareManager;
  let mediaManager: MediaStreamManager;
  let peerManager: PeerConnectionManager;
  let mockMediaDevices: any;

  beforeEach(() => {
    mediaManager = new MediaStreamManager();
    peerManager = new PeerConnectionManager({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    screenShareManager = new ScreenShareManager(mediaManager, peerManager);

    // Mock navigator.mediaDevices
    mockMediaDevices = {
      getUserMedia: vi.fn(),
      getDisplayMedia: vi.fn(),
      enumerateDevices: vi.fn(),
    };

    Object.defineProperty(global.navigator, "mediaDevices", {
      value: mockMediaDevices,
      writable: true,
      configurable: true,
    });

    // Mock RTCPeerConnection
    (global as any).RTCPeerConnection = class {
      getSenders(): any[] {
        return [];
      }
      getReceivers(): any[] {
        return [];
      }
      close(): void {}
    };
  });

  describe("startScreenShare", () => {
    it("should start screen sharing successfully", async () => {
      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      const result = await screenShareManager.startScreenShare();

      expect(result).toBe(screenStream);
      expect(screenShareManager.isScreenSharing()).toBe(true);
      expect(screenShareManager.getScreenStream()).toBe(screenStream);
    });

    it("should save original video track before screen sharing", async () => {
      // Setup local stream with video
      const localVideoTrack = new MockMediaStreamTrack("video") as any;
      const localStream = new MockMediaStream([localVideoTrack]) as any;
      mockMediaDevices.getUserMedia.mockResolvedValue(localStream);
      await mediaManager.getUserMedia();

      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();

      const state = screenShareManager.getState();
      expect(state.originalVideoTrack).toBe(localVideoTrack);
    });

    it("should throw error if already screen sharing", async () => {
      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();

      await expect(screenShareManager.startScreenShare()).rejects.toThrow(
        StreamError,
      );
      await expect(screenShareManager.startScreenShare()).rejects.toThrow(
        "already active",
      );
    });

    it("should throw error if no video track in screen stream", async () => {
      const screenStream = new MockMediaStream([]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await expect(screenShareManager.startScreenShare()).rejects.toThrow(
        StreamError,
      );
      await expect(screenShareManager.startScreenShare()).rejects.toThrow(
        "No video track",
      );
    });

    it("should replace video track in all peer connections", async () => {
      // Create mock peer connections
      (global as any).RTCPeerConnection = class {
        private tracks: any[] = [
          { track: { kind: "video" }, replaceTrack: vi.fn() },
        ];

        getSenders(): any[] {
          return this.tracks;
        }
        getReceivers(): any[] {
          return [];
        }
        createDataChannel(): any {
          return { readyState: "connecting" };
        }
        close(): void {}
      };

      peerManager.createPeerConnection("peer-1");
      peerManager.createPeerConnection("peer-2");

      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();

      const peer1Senders = peerManager.getSenders("peer-1");
      const peer2Senders = peerManager.getSenders("peer-2");

      expect(peer1Senders[0].replaceTrack).toHaveBeenCalledWith(screenTrack);
      expect(peer2Senders[0].replaceTrack).toHaveBeenCalledWith(screenTrack);
    });

    it("should cleanup on track replacement failure", async () => {
      (global as any).RTCPeerConnection = class {
        getSenders(): any[] {
          return [
            {
              track: { kind: "video" },
              replaceTrack: vi
                .fn()
                .mockRejectedValue(new Error("Replace failed")),
            },
          ];
        }
        getReceivers(): any[] {
          return [];
        }
        createDataChannel(): any {
          return { readyState: "connecting" };
        }
        close(): void {}
      };

      peerManager.createPeerConnection("peer-1");

      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await expect(screenShareManager.startScreenShare()).rejects.toThrow();
      expect(screenShareManager.isScreenSharing()).toBe(false);
    });

    it("should stop screen sharing when track ends", async () => {
      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();
      expect(screenShareManager.isScreenSharing()).toBe(true);

      // Simulate user stopping screen share via browser UI
      screenTrack.stop();

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screenShareManager.isScreenSharing()).toBe(false);
    });
  });

  describe("stopScreenShare", () => {
    it("should stop screen sharing and restore original track", async () => {
      // Setup local stream
      const localVideoTrack = new MockMediaStreamTrack("video") as any;
      const localStream = new MockMediaStream([localVideoTrack]) as any;
      mockMediaDevices.getUserMedia.mockResolvedValue(localStream);
      await mediaManager.getUserMedia();

      // Setup peer connection
      (global as any).RTCPeerConnection = class {
        private senders: any[] = [
          { track: { kind: "video" }, replaceTrack: vi.fn() },
        ];

        getSenders(): any[] {
          return this.senders;
        }
        getReceivers(): any[] {
          return [];
        }
        createDataChannel(): any {
          return { readyState: "connecting" };
        }
        close(): void {}
      };

      peerManager.createPeerConnection("peer-1");

      // Start screen sharing
      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);
      await screenShareManager.startScreenShare();

      // Stop screen sharing
      await screenShareManager.stopScreenShare();

      expect(screenShareManager.isScreenSharing()).toBe(false);
      expect(screenShareManager.getScreenStream()).toBeNull();

      const senders = peerManager.getSenders("peer-1");
      expect(senders[0].replaceTrack).toHaveBeenCalledWith(localVideoTrack);
    });

    it("should handle stopping when not sharing", async () => {
      await expect(screenShareManager.stopScreenShare()).resolves.not.toThrow();
      expect(screenShareManager.isScreenSharing()).toBe(false);
    });

    it("should handle errors when restoring original track", async () => {
      // Setup local stream
      const localVideoTrack = new MockMediaStreamTrack("video") as any;
      const localStream = new MockMediaStream([localVideoTrack]) as any;
      mockMediaDevices.getUserMedia.mockResolvedValue(localStream);
      await mediaManager.getUserMedia();

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Setup peer connection with failing replaceTrack on second call
      let callCount = 0;
      (global as any).RTCPeerConnection = class {
        getSenders(): any[] {
          return [
            {
              track: { kind: "video" },
              replaceTrack: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve(); // First call succeeds (start sharing)
                } else {
                  return Promise.reject(new Error("Replace failed")); // Second call fails (stop sharing)
                }
              }),
            },
          ];
        }
        getReceivers(): any[] {
          return [];
        }
        createDataChannel(): any {
          return { readyState: "connecting" };
        }
        close(): void {}
      };

      peerManager.createPeerConnection("peer-1");

      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);
      await screenShareManager.startScreenShare();

      // Should not throw even if restore fails
      await expect(screenShareManager.stopScreenShare()).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      expect(screenShareManager.isScreenSharing()).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("toggleScreenShare", () => {
    it("should start screen sharing when not sharing", async () => {
      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      const result = await screenShareManager.toggleScreenShare();

      expect(result).toBe(true);
      expect(screenShareManager.isScreenSharing()).toBe(true);
    });

    it("should stop screen sharing when already sharing", async () => {
      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();
      const result = await screenShareManager.toggleScreenShare();

      expect(result).toBe(false);
      expect(screenShareManager.isScreenSharing()).toBe(false);
    });
  });

  describe("State queries", () => {
    it("should return correct screen sharing state", async () => {
      expect(screenShareManager.isScreenSharing()).toBe(false);

      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();
      expect(screenShareManager.isScreenSharing()).toBe(true);

      await screenShareManager.stopScreenShare();
      expect(screenShareManager.isScreenSharing()).toBe(false);
    });

    it("should return screen stream", async () => {
      expect(screenShareManager.getScreenStream()).toBeNull();

      const screenTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenTrack]) as any;
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await screenShareManager.startScreenShare();
      expect(screenShareManager.getScreenStream()).toBe(screenStream);
    });

    it("should return complete state", async () => {
      const state = screenShareManager.getState();

      expect(state).toEqual({
        isSharing: false,
        stream: null,
        originalVideoTrack: null,
      });
    });
  });
});
