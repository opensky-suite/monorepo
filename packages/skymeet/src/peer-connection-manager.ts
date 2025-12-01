/**
 * PeerConnectionManager - Manages WebRTC peer connections
 */

import EventEmitter from "eventemitter3";
import { PeerConnectionError } from "./errors.js";
import type {
  PeerConnectionConfig,
  PeerInfo,
  IceCandidate,
  SessionDescription,
  ConnectionStats,
} from "./types.js";

export interface PeerConnectionEvents {
  "ice-candidate": (peerId: string, candidate: IceCandidate) => void;
  "connection-state-change": (
    peerId: string,
    state: RTCPeerConnectionState,
  ) => void;
  "ice-connection-state-change": (
    peerId: string,
    state: RTCIceConnectionState,
  ) => void;
  track: (peerId: string, track: MediaStreamTrack, stream: MediaStream) => void;
  "data-channel-message": (peerId: string, data: unknown) => void;
  "data-channel-open": (peerId: string) => void;
  "data-channel-close": (peerId: string) => void;
}

export class PeerConnectionManager extends EventEmitter<PeerConnectionEvents> {
  private peers: Map<string, PeerInfo> = new Map();
  private config: RTCConfiguration;

  constructor(config: PeerConnectionConfig) {
    super();
    this.config = {
      iceServers: config.iceServers,
      iceTransportPolicy: config.iceTransportPolicy,
      bundlePolicy: config.bundlePolicy,
      rtcpMuxPolicy: config.rtcpMuxPolicy,
    };
  }

  /**
   * Create a new peer connection
   */
  createPeerConnection(
    peerId: string,
    localStream?: MediaStream,
    createDataChannel = true,
  ): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      throw new PeerConnectionError(
        `Peer connection already exists for ${peerId}`,
        "PEER_EXISTS",
      );
    }

    const connection = new RTCPeerConnection(this.config);
    let dataChannel: RTCDataChannel | null = null;

    // Create data channel if requested
    if (createDataChannel) {
      dataChannel = connection.createDataChannel("data", {
        ordered: true,
      });
      this.setupDataChannel(peerId, dataChannel);
    }

    // Add local stream tracks if provided
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    // Setup event handlers
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit("ice-candidate", peerId, {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        });
      }
    };

    connection.onconnectionstatechange = () => {
      this.emit("connection-state-change", peerId, connection.connectionState);
    };

    connection.oniceconnectionstatechange = () => {
      this.emit(
        "ice-connection-state-change",
        peerId,
        connection.iceConnectionState,
      );
    };

    connection.ontrack = (event) => {
      this.emit("track", peerId, event.track, event.streams[0]);

      // Update peer info with remote stream
      const peerInfo = this.peers.get(peerId);
      if (peerInfo) {
        peerInfo.stream = event.streams[0];
      }
    };

    connection.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel);
    };

    // Store peer info
    this.peers.set(peerId, {
      id: peerId,
      connection,
      stream: null,
      dataChannel,
    });

    return connection;
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.emit("data-channel-open", peerId);
    };

    channel.onclose = () => {
      this.emit("data-channel-close", peerId);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit("data-channel-message", peerId, data);
      } catch {
        this.emit("data-channel-message", peerId, event.data);
      }
    };

    // Update peer info
    const peerInfo = this.peers.get(peerId);
    if (peerInfo) {
      peerInfo.dataChannel = channel;
    }
  }

  /**
   * Create SDP offer
   */
  async createOffer(
    peerId: string,
    options?: RTCOfferOptions,
  ): Promise<SessionDescription> {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      throw new PeerConnectionError(
        `Peer ${peerId} not found`,
        "PEER_NOT_FOUND",
      );
    }

    try {
      const offer = await peerInfo.connection.createOffer(options);
      await peerInfo.connection.setLocalDescription(offer);

      return {
        type: offer.type,
        sdp: offer.sdp!,
      };
    } catch (error) {
      throw new PeerConnectionError(
        `Failed to create offer for peer ${peerId}: ${error}`,
        "CREATE_OFFER_FAILED",
        error,
      );
    }
  }

  /**
   * Create SDP answer
   */
  async createAnswer(
    peerId: string,
    options?: RTCAnswerOptions,
  ): Promise<SessionDescription> {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      throw new PeerConnectionError(
        `Peer ${peerId} not found`,
        "PEER_NOT_FOUND",
      );
    }

    try {
      const answer = await peerInfo.connection.createAnswer(options);
      await peerInfo.connection.setLocalDescription(answer);

      return {
        type: answer.type,
        sdp: answer.sdp!,
      };
    } catch (error) {
      throw new PeerConnectionError(
        `Failed to create answer for peer ${peerId}: ${error}`,
        "CREATE_ANSWER_FAILED",
        error,
      );
    }
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(
    peerId: string,
    description: SessionDescription,
  ): Promise<void> {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      throw new PeerConnectionError(
        `Peer ${peerId} not found`,
        "PEER_NOT_FOUND",
      );
    }

    try {
      await peerInfo.connection.setRemoteDescription(
        new RTCSessionDescription(description),
      );
    } catch (error) {
      throw new PeerConnectionError(
        `Failed to set remote description for peer ${peerId}: ${error}`,
        "SET_REMOTE_DESCRIPTION_FAILED",
        error,
      );
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(
    peerId: string,
    candidate: IceCandidate,
  ): Promise<void> {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      throw new PeerConnectionError(
        `Peer ${peerId} not found`,
        "PEER_NOT_FOUND",
      );
    }

    try {
      await peerInfo.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      throw new PeerConnectionError(
        `Failed to add ICE candidate for peer ${peerId}: ${error}`,
        "ADD_ICE_CANDIDATE_FAILED",
        error,
      );
    }
  }

  /**
   * Send data via data channel
   */
  sendData(peerId: string, data: unknown): void {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      throw new PeerConnectionError(
        `Peer ${peerId} not found`,
        "PEER_NOT_FOUND",
      );
    }

    if (!peerInfo.dataChannel || peerInfo.dataChannel.readyState !== "open") {
      throw new PeerConnectionError(
        `Data channel not available for peer ${peerId}`,
        "DATA_CHANNEL_NOT_AVAILABLE",
      );
    }

    const message = typeof data === "string" ? data : JSON.stringify(data);
    peerInfo.dataChannel.send(message);
  }

  /**
   * Get connection statistics
   */
  async getStats(peerId: string): Promise<ConnectionStats> {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      throw new PeerConnectionError(
        `Peer ${peerId} not found`,
        "PEER_NOT_FOUND",
      );
    }

    const stats = await peerInfo.connection.getStats();
    const result: ConnectionStats = {
      bytesSent: 0,
      bytesReceived: 0,
      packetsLost: 0,
      jitter: 0,
      roundTripTime: 0,
      availableBandwidth: 0,
    };

    stats.forEach((report) => {
      if (report.type === "outbound-rtp") {
        result.bytesSent += report.bytesSent || 0;
      } else if (report.type === "inbound-rtp") {
        result.bytesReceived += report.bytesReceived || 0;
        result.packetsLost += report.packetsLost || 0;
        result.jitter = report.jitter || 0;
      } else if (
        report.type === "candidate-pair" &&
        report.state === "succeeded"
      ) {
        result.roundTripTime = report.currentRoundTripTime || 0;
        result.availableBandwidth = report.availableOutgoingBitrate || 0;
      }
    });

    return result;
  }

  /**
   * Close peer connection
   */
  closePeerConnection(peerId: string): void {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) {
      return;
    }

    peerInfo.dataChannel?.close();
    peerInfo.connection.close();
    this.peers.delete(peerId);
  }

  /**
   * Close all peer connections
   */
  closeAll(): void {
    this.peers.forEach((_, peerId) => {
      this.closePeerConnection(peerId);
    });
  }

  /**
   * Get peer connection
   */
  getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.peers.get(peerId)?.connection;
  }

  /**
   * Get all peer IDs
   */
  getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Check if peer exists
   */
  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }
}
