/**
 * Error Classes Tests
 */

import { describe, it, expect } from "vitest";
import {
  NotImplementedError,
  MediaDeviceError,
  PeerConnectionError,
  SignalingError,
  StreamError,
} from "./errors.js";

describe("Error Classes", () => {
  describe("NotImplementedError", () => {
    it("should create error with feature name", () => {
      const error = new NotImplementedError("Virtual backgrounds");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("NotImplementedError");
      expect(error.message).toBe(
        "Feature not yet implemented: Virtual backgrounds",
      );
    });
  });

  describe("MediaDeviceError", () => {
    it("should create error with message and code", () => {
      const error = new MediaDeviceError("Camera access denied", "NOT_ALLOWED");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("MediaDeviceError");
      expect(error.message).toBe("Camera access denied");
      expect(error.code).toBe("NOT_ALLOWED");
    });

    it("should include optional details", () => {
      const details = { deviceId: "camera-123" };
      const error = new MediaDeviceError(
        "Device not found",
        "NOT_FOUND",
        details,
      );

      expect(error.details).toEqual(details);
    });
  });

  describe("PeerConnectionError", () => {
    it("should create error with message and code", () => {
      const error = new PeerConnectionError("Connection failed", "FAILED");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("PeerConnectionError");
      expect(error.message).toBe("Connection failed");
      expect(error.code).toBe("FAILED");
    });

    it("should include optional details", () => {
      const details = { peerId: "peer-456" };
      const error = new PeerConnectionError(
        "Peer not found",
        "NOT_FOUND",
        details,
      );

      expect(error.details).toEqual(details);
    });
  });

  describe("SignalingError", () => {
    it("should create error with message and code", () => {
      const error = new SignalingError(
        "Invalid signaling message",
        "INVALID_MESSAGE",
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("SignalingError");
      expect(error.message).toBe("Invalid signaling message");
      expect(error.code).toBe("INVALID_MESSAGE");
    });

    it("should include optional details", () => {
      const details = { messageType: "offer" };
      const error = new SignalingError("SDP parse error", "SDP_ERROR", details);

      expect(error.details).toEqual(details);
    });
  });

  describe("StreamError", () => {
    it("should create error with message and code", () => {
      const error = new StreamError(
        "Stream ended unexpectedly",
        "STREAM_ENDED",
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("StreamError");
      expect(error.message).toBe("Stream ended unexpectedly");
      expect(error.code).toBe("STREAM_ENDED");
    });

    it("should include optional details", () => {
      const details = { streamId: "stream-789" };
      const error = new StreamError(
        "No tracks available",
        "NO_TRACKS",
        details,
      );

      expect(error.details).toEqual(details);
    });
  });
});
