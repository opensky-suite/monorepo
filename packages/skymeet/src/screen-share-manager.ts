/**
 * ScreenShareManager - High-level screen sharing coordinator
 * Combines MediaStreamManager and PeerConnectionManager for easy screen sharing
 */

import { MediaStreamManager } from "./media-stream-manager.js";
import { PeerConnectionManager } from "./peer-connection-manager.js";
import { StreamError } from "./errors.js";
import type { MediaStreamOptions } from "./types.js";

export interface ScreenShareState {
  isSharing: boolean;
  stream: MediaStream | null;
  originalVideoTrack: MediaStreamTrack | null;
}

export class ScreenShareManager {
  private mediaManager: MediaStreamManager;
  private peerManager: PeerConnectionManager;
  private state: ScreenShareState = {
    isSharing: false,
    stream: null,
    originalVideoTrack: null,
  };

  constructor(
    mediaManager: MediaStreamManager,
    peerManager: PeerConnectionManager,
  ) {
    this.mediaManager = mediaManager;
    this.peerManager = peerManager;
  }

  /**
   * Start screen sharing and replace video track in all peer connections
   */
  async startScreenShare(
    options: MediaStreamOptions = {},
  ): Promise<MediaStream> {
    if (this.state.isSharing) {
      throw new StreamError("Screen sharing already active", "ALREADY_SHARING");
    }

    // Save original video track
    const localStream = this.mediaManager.getLocalStream();
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.state.originalVideoTrack = videoTrack;
      }
    }

    // Start screen sharing
    const screenStream = await this.mediaManager.getDisplayMedia(options);
    const screenTrack = screenStream.getVideoTracks()[0];

    if (!screenTrack) {
      throw new StreamError(
        "No video track in screen share stream",
        "NO_VIDEO_TRACK",
      );
    }

    // Replace video track in all peer connections
    try {
      await this.peerManager.replaceVideoTrackForAll(screenTrack);
    } catch (error) {
      // Cleanup on failure
      this.mediaManager.stopScreenShare();
      throw error;
    }

    // Listen for when user stops sharing via browser UI
    screenTrack.addEventListener("ended", () => {
      this.stopScreenShare().catch(console.error);
    });

    this.state.isSharing = true;
    this.state.stream = screenStream;

    return screenStream;
  }

  /**
   * Stop screen sharing and restore original video track
   */
  async stopScreenShare(): Promise<void> {
    if (!this.state.isSharing) {
      return;
    }

    // Restore original video track if available
    if (this.state.originalVideoTrack) {
      try {
        await this.peerManager.replaceVideoTrackForAll(
          this.state.originalVideoTrack,
        );
      } catch (error) {
        console.error("Failed to restore original video track:", error);
      }
    }

    // Stop screen share stream
    this.mediaManager.stopScreenShare();

    // Reset state
    this.state.isSharing = false;
    this.state.stream = null;
    this.state.originalVideoTrack = null;
  }

  /**
   * Toggle screen sharing on/off
   */
  async toggleScreenShare(options?: MediaStreamOptions): Promise<boolean> {
    if (this.state.isSharing) {
      await this.stopScreenShare();
      return false;
    } else {
      await this.startScreenShare(options);
      return true;
    }
  }

  /**
   * Check if currently screen sharing
   */
  isScreenSharing(): boolean {
    return this.state.isSharing;
  }

  /**
   * Get current screen share stream
   */
  getScreenStream(): MediaStream | null {
    return this.state.stream;
  }

  /**
   * Get current state
   */
  getState(): ScreenShareState {
    return { ...this.state };
  }
}
