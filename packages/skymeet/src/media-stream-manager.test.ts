/**
 * MediaStreamManager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MediaStreamManager } from "./media-stream-manager.js";
import { MediaDeviceError } from "./errors.js";

// Mock MediaStream
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

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack): void {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}

// Mock MediaStreamTrack
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

describe("MediaStreamManager", () => {
  let manager: MediaStreamManager;
  let mockMediaDevices: any;

  beforeEach(() => {
    manager = new MediaStreamManager();

    // Setup navigator.mediaDevices mock
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
  });

  afterEach(() => {
    manager.stopAll();
  });

  describe("getUserMedia", () => {
    it("should get user media with default constraints", async () => {
      const mockStream = new MockMediaStream([
        new MockMediaStreamTrack("audio") as any,
        new MockMediaStreamTrack("video") as any,
      ]);
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const stream = await manager.getUserMedia();

      expect(stream).toBe(mockStream);
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      });
    });

    it("should get user media with custom constraints", async () => {
      const mockStream = new MockMediaStream();
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      await manager.getUserMedia({
        audio: { echoCancellation: true },
        video: { width: 1280, height: 720 },
      });

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: { echoCancellation: true },
        video: { width: 1280, height: 720 },
      });
    });

    it("should throw MediaDeviceError when getUserMedia is not supported", async () => {
      (global.navigator as any).mediaDevices = undefined;

      await expect(manager.getUserMedia()).rejects.toThrow(MediaDeviceError);
      await expect(manager.getUserMedia()).rejects.toThrow("not supported");
    });

    it("should throw MediaDeviceError when getUserMedia fails", async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      );

      await expect(manager.getUserMedia()).rejects.toThrow(MediaDeviceError);
    });
  });

  describe("getDisplayMedia", () => {
    it("should get display media", async () => {
      const mockStream = new MockMediaStream([
        new MockMediaStreamTrack("video") as any,
      ]);
      mockMediaDevices.getDisplayMedia.mockResolvedValue(mockStream);

      const stream = await manager.getDisplayMedia();

      expect(stream).toBe(mockStream);
      expect(mockMediaDevices.getDisplayMedia).toHaveBeenCalledWith({
        audio: false,
        video: true,
      });
    });

    it("should throw MediaDeviceError when getDisplayMedia is not supported", async () => {
      mockMediaDevices.getDisplayMedia = undefined;

      await expect(manager.getDisplayMedia()).rejects.toThrow(MediaDeviceError);
    });

    it("should handle screen share stop event", async () => {
      const videoTrack = new MockMediaStreamTrack("video") as any;
      const mockStream = new MockMediaStream([videoTrack]);
      mockMediaDevices.getDisplayMedia.mockResolvedValue(mockStream);

      await manager.getDisplayMedia();
      expect(manager.isScreenSharing()).toBe(true);

      // Simulate user stopping screen share
      videoTrack.stop();

      expect(manager.getScreenStream()).toBeNull();
    });
  });

  describe("getDevices", () => {
    it("should enumerate media devices", async () => {
      const mockDevices = [
        { deviceId: "1", kind: "audioinput", label: "Microphone" },
        { deviceId: "2", kind: "videoinput", label: "Camera" },
      ];
      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);

      const devices = await manager.getDevices();

      expect(devices).toEqual(mockDevices);
    });

    it("should throw MediaDeviceError when enumerateDevices is not supported", async () => {
      mockMediaDevices.enumerateDevices = undefined;

      await expect(manager.getDevices()).rejects.toThrow(MediaDeviceError);
    });
  });

  describe("Audio/Video Control", () => {
    beforeEach(async () => {
      const mockStream = new MockMediaStream([
        new MockMediaStreamTrack("audio") as any,
        new MockMediaStreamTrack("video") as any,
      ]);
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
      await manager.getUserMedia();
    });

    it("should enable/disable audio", () => {
      expect(manager.isAudioEnabled()).toBe(true);

      manager.setAudioEnabled(false);
      expect(manager.isAudioEnabled()).toBe(false);

      manager.setAudioEnabled(true);
      expect(manager.isAudioEnabled()).toBe(true);
    });

    it("should enable/disable video", () => {
      expect(manager.isVideoEnabled()).toBe(true);

      manager.setVideoEnabled(false);
      expect(manager.isVideoEnabled()).toBe(false);

      manager.setVideoEnabled(true);
      expect(manager.isVideoEnabled()).toBe(true);
    });

    it("should throw error when setting audio without stream", () => {
      manager.stopLocalStream();
      expect(() => manager.setAudioEnabled(true)).toThrow(MediaDeviceError);
    });

    it("should throw error when setting video without stream", () => {
      manager.stopLocalStream();
      expect(() => manager.setVideoEnabled(true)).toThrow(MediaDeviceError);
    });
  });

  describe("Stream Management", () => {
    it("should return local stream", async () => {
      const mockStream = new MockMediaStream();
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      await manager.getUserMedia();
      expect(manager.getLocalStream()).toBe(mockStream);
    });

    it("should stop local stream", async () => {
      const audioTrack = new MockMediaStreamTrack("audio") as any;
      const videoTrack = new MockMediaStreamTrack("video") as any;
      const mockStream = new MockMediaStream([audioTrack, videoTrack]);
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      await manager.getUserMedia();
      manager.stopLocalStream();

      expect(audioTrack.readyState).toBe("ended");
      expect(videoTrack.readyState).toBe("ended");
      expect(manager.getLocalStream()).toBeNull();
    });

    it("should stop screen share", async () => {
      const videoTrack = new MockMediaStreamTrack("video") as any;
      const mockStream = new MockMediaStream([videoTrack]);
      mockMediaDevices.getDisplayMedia.mockResolvedValue(mockStream);

      await manager.getDisplayMedia();
      manager.stopScreenShare();

      expect(videoTrack.readyState).toBe("ended");
      expect(manager.getScreenStream()).toBeNull();
    });

    it("should stop all streams", async () => {
      const localAudioTrack = new MockMediaStreamTrack("audio") as any;
      const localVideoTrack = new MockMediaStreamTrack("video") as any;
      const localStream = new MockMediaStream([
        localAudioTrack,
        localVideoTrack,
      ]);

      const screenVideoTrack = new MockMediaStreamTrack("video") as any;
      const screenStream = new MockMediaStream([screenVideoTrack]);

      mockMediaDevices.getUserMedia.mockResolvedValue(localStream);
      mockMediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

      await manager.getUserMedia();
      await manager.getDisplayMedia();

      manager.stopAll();

      expect(localAudioTrack.readyState).toBe("ended");
      expect(localVideoTrack.readyState).toBe("ended");
      expect(screenVideoTrack.readyState).toBe("ended");
      expect(manager.getLocalStream()).toBeNull();
      expect(manager.getScreenStream()).toBeNull();
    });
  });

  describe("State Queries", () => {
    it("should return false for isAudioEnabled when no stream", () => {
      expect(manager.isAudioEnabled()).toBe(false);
    });

    it("should return false for isVideoEnabled when no stream", () => {
      expect(manager.isVideoEnabled()).toBe(false);
    });

    it("should return false for isScreenSharing initially", () => {
      expect(manager.isScreenSharing()).toBe(false);
    });

    it("should return true for isScreenSharing when screen sharing", async () => {
      const mockStream = new MockMediaStream([
        new MockMediaStreamTrack("video") as any,
      ]);
      mockMediaDevices.getDisplayMedia.mockResolvedValue(mockStream);

      await manager.getDisplayMedia();
      expect(manager.isScreenSharing()).toBe(true);
    });
  });
});
