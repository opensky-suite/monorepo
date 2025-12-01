/**
 * PeerConnectionManager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PeerConnectionManager } from "./peer-connection-manager.js";
import { PeerConnectionError } from "./errors.js";
import type { PeerConnectionConfig } from "./types.js";

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  onicecandidate: ((event: any) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: any) => void) | null = null;
  ondatachannel: ((event: any) => void) | null = null;

  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState: RTCIceConnectionState = "new";
  signalingState: RTCSignalingState = "stable";
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;

  private tracks: any[] = [];
  private _dataChannel: MockRTCDataChannel | null = null;

  addTrack(track: any, stream: any): void {
    this.tracks.push({ track, stream });
  }

  createDataChannel(label: string, options: any): MockRTCDataChannel {
    this._dataChannel = new MockRTCDataChannel(label, options);
    return this._dataChannel;
  }

  async createOffer(options?: any): Promise<RTCSessionDescriptionInit> {
    return {
      type: "offer" as RTCSdpType,
      sdp: "mock-sdp-offer",
    };
  }

  async createAnswer(options?: any): Promise<RTCSessionDescriptionInit> {
    return {
      type: "answer" as RTCSdpType,
      sdp: "mock-sdp-answer",
    };
  }

  async setLocalDescription(
    description: RTCSessionDescriptionInit,
  ): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
  }

  async setRemoteDescription(
    description: RTCSessionDescriptionInit,
  ): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription;
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    // Mock implementation
  }

  async getStats(): Promise<RTCStatsReport> {
    const stats = new Map();

    stats.set("outbound-rtp-1", {
      type: "outbound-rtp",
      bytesSent: 1000,
    });

    stats.set("inbound-rtp-1", {
      type: "inbound-rtp",
      bytesReceived: 2000,
      packetsLost: 5,
      jitter: 0.01,
    });

    stats.set("candidate-pair-1", {
      type: "candidate-pair",
      state: "succeeded",
      currentRoundTripTime: 0.05,
      availableOutgoingBitrate: 1000000,
    });

    return stats as RTCStatsReport;
  }

  close(): void {
    this.connectionState = "closed";
    if (this._dataChannel) {
      this._dataChannel.close();
    }
  }

  triggerIceCandidate(candidate: any): void {
    if (this.onicecandidate) {
      this.onicecandidate({ candidate });
    }
  }

  triggerTrack(track: any, stream: any): void {
    if (this.ontrack) {
      this.ontrack({ track, streams: [stream] });
    }
  }

  triggerDataChannel(channel: MockRTCDataChannel): void {
    if (this.ondatachannel) {
      this.ondatachannel({ channel });
    }
  }

  triggerConnectionStateChange(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  }

  triggerIceConnectionStateChange(state: RTCIceConnectionState): void {
    this.iceConnectionState = state;
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange();
    }
  }
}

class MockRTCDataChannel {
  label: string;
  readyState: RTCDataChannelState = "connecting";
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  constructor(label: string, options: any) {
    this.label = label;
  }

  send(data: string): void {
    // Mock implementation
  }

  close(): void {
    this.readyState = "closed";
    if (this.onclose) {
      this.onclose();
    }
  }

  open(): void {
    this.readyState = "open";
    if (this.onopen) {
      this.onopen();
    }
  }

  receiveMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }
}

describe("PeerConnectionManager", () => {
  let manager: PeerConnectionManager;
  let config: PeerConnectionConfig;

  beforeEach(() => {
    config = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    manager = new PeerConnectionManager(config);

    // Mock RTCPeerConnection global
    (global as any).RTCPeerConnection = MockRTCPeerConnection;
    (global as any).RTCSessionDescription = class {
      type: RTCSdpType;
      sdp: string;
      constructor(init: RTCSessionDescriptionInit) {
        this.type = init.type!;
        this.sdp = init.sdp!;
      }
    };
    (global as any).RTCIceCandidate = class {
      candidate: string;
      constructor(init: RTCIceCandidateInit) {
        this.candidate = init.candidate!;
      }
    };
  });

  afterEach(() => {
    manager.closeAll();
  });

  describe("createPeerConnection", () => {
    it("should create new peer connection", () => {
      const connection = manager.createPeerConnection("peer-1");

      expect(connection).toBeInstanceOf(MockRTCPeerConnection);
      expect(manager.hasPeer("peer-1")).toBe(true);
    });

    it("should throw error if peer already exists", () => {
      manager.createPeerConnection("peer-1");

      expect(() => manager.createPeerConnection("peer-1")).toThrow(
        PeerConnectionError,
      );
      expect(() => manager.createPeerConnection("peer-1")).toThrow(
        "already exists",
      );
    });

    it("should add local stream tracks", () => {
      const mockTrack = { kind: "audio" };
      const mockStream = {
        getTracks: () => [mockTrack],
      };

      const connection = manager.createPeerConnection(
        "peer-1",
        mockStream as any,
      );
      expect((connection as any).tracks).toHaveLength(1);
    });

    it("should create data channel by default", () => {
      manager.createPeerConnection("peer-1");

      const connection = manager.getPeerConnection("peer-1") as any;
      expect(connection._dataChannel).toBeDefined();
    });

    it("should not create data channel when disabled", () => {
      manager.createPeerConnection("peer-1", undefined, false);

      const connection = manager.getPeerConnection("peer-1") as any;
      expect(connection._dataChannel).toBeNull();
    });
  });

  describe("Event Handling", () => {
    it("should emit ice-candidate event", () => {
      const spy = vi.fn();
      manager.on("ice-candidate", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      connection.triggerIceCandidate({
        candidate: "candidate-string",
        sdpMLineIndex: 0,
        sdpMid: "0",
      });

      expect(spy).toHaveBeenCalledWith("peer-1", {
        candidate: "candidate-string",
        sdpMLineIndex: 0,
        sdpMid: "0",
      });
    });

    it("should emit connection-state-change event", () => {
      const spy = vi.fn();
      manager.on("connection-state-change", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      connection.triggerConnectionStateChange("connected");

      expect(spy).toHaveBeenCalledWith("peer-1", "connected");
    });

    it("should emit ice-connection-state-change event", () => {
      const spy = vi.fn();
      manager.on("ice-connection-state-change", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      connection.triggerIceConnectionStateChange("connected");

      expect(spy).toHaveBeenCalledWith("peer-1", "connected");
    });

    it("should emit track event", () => {
      const spy = vi.fn();
      manager.on("track", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      const mockTrack = { kind: "video" };
      const mockStream = { id: "stream-1" };
      connection.triggerTrack(mockTrack, mockStream);

      expect(spy).toHaveBeenCalledWith("peer-1", mockTrack, mockStream);
    });

    it("should emit data-channel-open event", () => {
      const spy = vi.fn();
      manager.on("data-channel-open", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.open();

      expect(spy).toHaveBeenCalledWith("peer-1");
    });

    it("should emit data-channel-close event", () => {
      const spy = vi.fn();
      manager.on("data-channel-close", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.close();

      expect(spy).toHaveBeenCalledWith("peer-1");
    });

    it("should emit data-channel-message event with JSON data", () => {
      const spy = vi.fn();
      manager.on("data-channel-message", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.receiveMessage('{"type":"test","value":123}');

      expect(spy).toHaveBeenCalledWith("peer-1", { type: "test", value: 123 });
    });

    it("should emit data-channel-message event with raw data", () => {
      const spy = vi.fn();
      manager.on("data-channel-message", spy);

      const connection = manager.createPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.receiveMessage("plain text message");

      expect(spy).toHaveBeenCalledWith("peer-1", "plain text message");
    });
  });

  describe("SDP Offer/Answer", () => {
    beforeEach(() => {
      manager.createPeerConnection("peer-1");
    });

    it("should create offer", async () => {
      const offer = await manager.createOffer("peer-1");

      expect(offer.type).toBe("offer");
      expect(offer.sdp).toBe("mock-sdp-offer");
    });

    it("should create answer", async () => {
      const answer = await manager.createAnswer("peer-1");

      expect(answer.type).toBe("answer");
      expect(answer.sdp).toBe("mock-sdp-answer");
    });

    it("should throw error when creating offer for non-existent peer", async () => {
      await expect(manager.createOffer("peer-999")).rejects.toThrow(
        PeerConnectionError,
      );
    });

    it("should throw error when creating answer for non-existent peer", async () => {
      await expect(manager.createAnswer("peer-999")).rejects.toThrow(
        PeerConnectionError,
      );
    });

    it("should set remote description", async () => {
      const description = { type: "offer" as RTCSdpType, sdp: "remote-sdp" };
      await manager.setRemoteDescription("peer-1", description);

      const connection = manager.getPeerConnection("peer-1")!;
      expect(connection.remoteDescription).toBeDefined();
      expect(connection.remoteDescription!.sdp).toBe("remote-sdp");
    });

    it("should throw error when setting remote description for non-existent peer", async () => {
      const description = { type: "offer" as RTCSdpType, sdp: "remote-sdp" };
      await expect(
        manager.setRemoteDescription("peer-999", description),
      ).rejects.toThrow(PeerConnectionError);
    });
  });

  describe("ICE Candidates", () => {
    beforeEach(() => {
      manager.createPeerConnection("peer-1");
    });

    it("should add ICE candidate", async () => {
      const candidate = {
        candidate: "candidate-string",
        sdpMLineIndex: 0,
        sdpMid: "0",
      };

      await expect(
        manager.addIceCandidate("peer-1", candidate),
      ).resolves.not.toThrow();
    });

    it("should throw error when adding ICE candidate for non-existent peer", async () => {
      const candidate = {
        candidate: "candidate-string",
        sdpMLineIndex: 0,
        sdpMid: "0",
      };

      await expect(
        manager.addIceCandidate("peer-999", candidate),
      ).rejects.toThrow(PeerConnectionError);
    });
  });

  describe("Data Channel", () => {
    beforeEach(() => {
      manager.createPeerConnection("peer-1");
    });

    it("should send JSON data", () => {
      const connection = manager.getPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.readyState = "open";

      const sendSpy = vi.spyOn(dataChannel, "send");
      manager.sendData("peer-1", { type: "test", value: 123 });

      expect(sendSpy).toHaveBeenCalledWith('{"type":"test","value":123}');
    });

    it("should send string data", () => {
      const connection = manager.getPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.readyState = "open";

      const sendSpy = vi.spyOn(dataChannel, "send");
      manager.sendData("peer-1", "hello");

      expect(sendSpy).toHaveBeenCalledWith("hello");
    });

    it("should throw error when sending data to non-existent peer", () => {
      expect(() => manager.sendData("peer-999", "test")).toThrow(
        PeerConnectionError,
      );
    });

    it("should throw error when data channel is not available", () => {
      manager.createPeerConnection("peer-2", undefined, false);
      expect(() => manager.sendData("peer-2", "test")).toThrow(
        PeerConnectionError,
      );
      expect(() => manager.sendData("peer-2", "test")).toThrow("not available");
    });

    it("should throw error when data channel is not open", () => {
      const connection = manager.getPeerConnection("peer-1") as any;
      const dataChannel = connection._dataChannel;
      dataChannel.readyState = "connecting";

      expect(() => manager.sendData("peer-1", "test")).toThrow(
        PeerConnectionError,
      );
    });
  });

  describe("Statistics", () => {
    beforeEach(() => {
      manager.createPeerConnection("peer-1");
    });

    it("should get connection statistics", async () => {
      const stats = await manager.getStats("peer-1");

      expect(stats.bytesSent).toBe(1000);
      expect(stats.bytesReceived).toBe(2000);
      expect(stats.packetsLost).toBe(5);
      expect(stats.jitter).toBe(0.01);
      expect(stats.roundTripTime).toBe(0.05);
      expect(stats.availableBandwidth).toBe(1000000);
    });

    it("should throw error when getting stats for non-existent peer", async () => {
      await expect(manager.getStats("peer-999")).rejects.toThrow(
        PeerConnectionError,
      );
    });
  });

  describe("Peer Management", () => {
    it("should close peer connection", () => {
      manager.createPeerConnection("peer-1");
      expect(manager.hasPeer("peer-1")).toBe(true);

      manager.closePeerConnection("peer-1");
      expect(manager.hasPeer("peer-1")).toBe(false);
    });

    it("should handle closing non-existent peer gracefully", () => {
      expect(() => manager.closePeerConnection("peer-999")).not.toThrow();
    });

    it("should close all peer connections", () => {
      manager.createPeerConnection("peer-1");
      manager.createPeerConnection("peer-2");
      manager.createPeerConnection("peer-3");

      expect(manager.getPeerIds()).toHaveLength(3);

      manager.closeAll();
      expect(manager.getPeerIds()).toHaveLength(0);
    });

    it("should get peer connection", () => {
      const connection = manager.createPeerConnection("peer-1");
      expect(manager.getPeerConnection("peer-1")).toBe(connection);
    });

    it("should return undefined for non-existent peer", () => {
      expect(manager.getPeerConnection("peer-999")).toBeUndefined();
    });

    it("should get all peer IDs", () => {
      manager.createPeerConnection("peer-1");
      manager.createPeerConnection("peer-2");
      manager.createPeerConnection("peer-3");

      const peerIds = manager.getPeerIds();
      expect(peerIds).toEqual(["peer-1", "peer-2", "peer-3"]);
    });

    it("should check if peer exists", () => {
      manager.createPeerConnection("peer-1");

      expect(manager.hasPeer("peer-1")).toBe(true);
      expect(manager.hasPeer("peer-999")).toBe(false);
    });
  });
});
