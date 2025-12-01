/**
 * MediaStreamManager - Manages local media streams (camera, microphone, screen share)
 */

import { MediaDeviceError } from "./errors.js";
import type { MediaStreamOptions } from "./types.js";

export class MediaStreamManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  /**
   * Get user media (camera and microphone)
   */
  async getUserMedia(options: MediaStreamOptions = {}): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: options.audio ?? true,
      video: options.video ?? true,
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new MediaDeviceError(
          "getUserMedia is not supported in this browser",
          "NOT_SUPPORTED",
        );
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      if (error instanceof DOMException) {
        throw new MediaDeviceError(
          `Failed to get user media: ${error.message}`,
          error.name,
          error,
        );
      }
      throw error;
    }
  }

  /**
   * Get display media (screen share)
   */
  async getDisplayMedia(
    options: MediaStreamOptions = {},
  ): Promise<MediaStream> {
    const constraints: DisplayMediaStreamOptions = {
      audio: options.audio ?? false,
      video: options.video ?? true,
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new MediaDeviceError(
          "getDisplayMedia is not supported in this browser",
          "NOT_SUPPORTED",
        );
      }

      this.screenStream =
        await navigator.mediaDevices.getDisplayMedia(constraints);

      // Add event listener for when user stops sharing via browser UI
      this.screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        // Just clear the reference, don't call stop() again to avoid recursion
        this.screenStream = null;
      });

      return this.screenStream;
    } catch (error) {
      if (error instanceof DOMException) {
        throw new MediaDeviceError(
          `Failed to get display media: ${error.message}`,
          error.name,
          error,
        );
      }
      throw error;
    }
  }

  /**
   * List available media devices
   */
  async getDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new MediaDeviceError(
          "enumerateDevices is not supported in this browser",
          "NOT_SUPPORTED",
        );
      }

      return await navigator.mediaDevices.enumerateDevices();
    } catch (error) {
      if (error instanceof DOMException) {
        throw new MediaDeviceError(
          `Failed to enumerate devices: ${error.message}`,
          error.name,
          error,
        );
      }
      throw error;
    }
  }

  /**
   * Mute/unmute audio track
   */
  setAudioEnabled(enabled: boolean): void {
    if (!this.localStream) {
      throw new MediaDeviceError("No local stream available", "NO_STREAM");
    }

    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  /**
   * Enable/disable video track
   */
  setVideoEnabled(enabled: boolean): void {
    if (!this.localStream) {
      throw new MediaDeviceError("No local stream available", "NO_STREAM");
    }

    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  /**
   * Get current local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get current screen share stream
   */
  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  /**
   * Stop local media stream
   */
  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Stop screen share
   */
  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
  }

  /**
   * Stop all media streams
   */
  stopAll(): void {
    this.stopLocalStream();
    this.stopScreenShare();
  }

  /**
   * Check if audio is enabled
   */
  isAudioEnabled(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    return audioTrack ? audioTrack.enabled : false;
  }

  /**
   * Check if video is enabled
   */
  isVideoEnabled(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    return videoTrack ? videoTrack.enabled : false;
  }

  /**
   * Check if screen sharing is active
   */
  isScreenSharing(): boolean {
    return this.screenStream !== null;
  }
}
