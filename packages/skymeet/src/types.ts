/**
 * SkyMeet WebRTC Core Types
 */

export interface MediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}

export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
}

export interface MediaStreamOptions {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
  screen?: boolean;
}

export interface CallState {
  isConnected: boolean;
  isConnecting: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}

export interface PeerInfo {
  id: string;
  connection: RTCPeerConnection;
  stream: MediaStream | null;
  dataChannel: RTCDataChannel | null;
}

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  availableBandwidth: number;
}

export interface WebRTCError extends Error {
  code: string;
  details?: unknown;
}

export enum ConnectionState {
  NEW = "new",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  FAILED = "failed",
  CLOSED = "closed",
}

export enum SignalingState {
  STABLE = "stable",
  HAVE_LOCAL_OFFER = "have-local-offer",
  HAVE_REMOTE_OFFER = "have-remote-offer",
  HAVE_LOCAL_PRANSWER = "have-local-pranswer",
  HAVE_REMOTE_PRANSWER = "have-remote-pranswer",
  CLOSED = "closed",
}

export interface IceCandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

export interface SessionDescription {
  type: RTCSdpType;
  sdp: string;
}
