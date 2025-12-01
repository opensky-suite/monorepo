/**
 * SkyMeet WebRTC Error Classes
 *
 * Fail fast, fail hard, fail ugly - no silent failures
 */

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Feature not yet implemented: ${feature}`);
    this.name = "NotImplementedError";
  }
}

export class MediaDeviceError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "MediaDeviceError";
    this.code = code;
    this.details = details;
  }
}

export class PeerConnectionError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "PeerConnectionError";
    this.code = code;
    this.details = details;
  }
}

export class SignalingError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "SignalingError";
    this.code = code;
    this.details = details;
  }
}

export class StreamError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "StreamError";
    this.code = code;
    this.details = details;
  }
}
