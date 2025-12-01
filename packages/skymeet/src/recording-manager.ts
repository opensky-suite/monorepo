/**
 * RecordingManager - Manages media recording for calls
 */

import EventEmitter from "eventemitter3";
import { StreamError, NotImplementedError } from "./errors.js";

export interface RecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
  bitsPerSecond?: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number | null;
  duration: number;
  chunks: Blob[];
  mimeType: string;
}

export interface RecordingEvents {
  "recording-started": () => void;
  "recording-stopped": (blob: Blob) => void;
  "recording-paused": () => void;
  "recording-resumed": () => void;
  "recording-error": (error: Error) => void;
  "data-available": (data: Blob) => void;
}

export class RecordingManager extends EventEmitter<RecordingEvents> {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    startTime: null,
    duration: 0,
    chunks: [],
    mimeType: "",
  };
  private startTimestamp: number = 0;
  private pauseTimestamp: number = 0;
  private totalPausedDuration: number = 0;

  /**
   * Start recording a media stream
   */
  async startRecording(
    stream: MediaStream,
    options: RecordingOptions = {},
  ): Promise<void> {
    if (this.state.isRecording) {
      throw new StreamError(
        "Recording already in progress",
        "ALREADY_RECORDING",
      );
    }

    if (!stream || stream.getTracks().length === 0) {
      throw new StreamError("Invalid or empty media stream", "INVALID_STREAM");
    }

    // Check MediaRecorder support
    if (typeof MediaRecorder === "undefined") {
      throw new NotImplementedError("MediaRecorder API");
    }

    // Determine best mime type
    const mimeType = this.selectMimeType(options.mimeType);

    try {
      this.recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: options.audioBitsPerSecond,
        videoBitsPerSecond: options.videoBitsPerSecond,
        bitsPerSecond: options.bitsPerSecond,
      });
    } catch (error) {
      throw new StreamError(
        `Failed to create MediaRecorder: ${error}`,
        "RECORDER_CREATION_FAILED",
        error,
      );
    }

    this.stream = stream;
    this.state.chunks = [];
    this.state.mimeType = mimeType;
    this.startTimestamp = Date.now();
    this.totalPausedDuration = 0;

    // Setup event handlers
    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.state.chunks.push(event.data);
        this.emit("data-available", event.data);
      }
    };

    this.recorder.onstart = () => {
      this.state.isRecording = true;
      this.state.isPaused = false;
      this.state.startTime = Date.now();
      this.emit("recording-started");
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.state.chunks, { type: this.state.mimeType });
      this.state.isRecording = false;
      this.state.isPaused = false;
      this.emit("recording-stopped", blob);
    };

    this.recorder.onerror = (event: Event) => {
      const error = new StreamError(
        "MediaRecorder error",
        "RECORDER_ERROR",
        event,
      );
      this.emit("recording-error", error);
    };

    this.recorder.onpause = () => {
      this.state.isPaused = true;
      this.pauseTimestamp = Date.now();
      this.emit("recording-paused");
    };

    this.recorder.onresume = () => {
      this.state.isPaused = false;
      this.totalPausedDuration += Date.now() - this.pauseTimestamp;
      this.emit("recording-resumed");
    };

    // Start recording with time slicing (1 second chunks)
    this.recorder.start(1000);
  }

  /**
   * Stop recording
   */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.state.isRecording) {
        reject(new StreamError("No recording in progress", "NOT_RECORDING"));
        return;
      }

      if (!this.recorder) {
        reject(new StreamError("No recorder available", "NO_RECORDER"));
        return;
      }

      // Listen for stop event to resolve with blob
      const handleStop = (blob: Blob) => {
        this.off("recording-stopped", handleStop);
        this.recorder = null;
        this.stream = null;
        resolve(blob);
      };

      this.once("recording-stopped", handleStop);
      this.recorder.stop();
    });
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.state.isRecording) {
      throw new StreamError("No recording in progress", "NOT_RECORDING");
    }

    if (this.state.isPaused) {
      throw new StreamError("Recording already paused", "ALREADY_PAUSED");
    }

    if (!this.recorder) {
      throw new StreamError("No recorder available", "NO_RECORDER");
    }

    this.recorder.pause();
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.state.isRecording) {
      throw new StreamError("No recording in progress", "NOT_RECORDING");
    }

    if (!this.state.isPaused) {
      throw new StreamError("Recording not paused", "NOT_PAUSED");
    }

    if (!this.recorder) {
      throw new StreamError("No recorder available", "NO_RECORDER");
    }

    this.recorder.resume();
  }

  /**
   * Get current recording duration in milliseconds
   */
  getDuration(): number {
    if (!this.state.isRecording) {
      return this.state.duration;
    }

    const elapsed = Date.now() - this.startTimestamp;
    return elapsed - this.totalPausedDuration;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.state.isRecording;
  }

  /**
   * Check if recording is paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Get current state
   */
  getState(): RecordingState {
    return {
      ...this.state,
      duration: this.getDuration(),
    };
  }

  /**
   * Get supported mime types
   */
  static getSupportedMimeTypes(): string[] {
    if (typeof MediaRecorder === "undefined") {
      return [];
    }

    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
      "video/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];

    return types.filter((type) => MediaRecorder.isTypeSupported(type));
  }

  /**
   * Select best available mime type
   */
  private selectMimeType(preferred?: string): string {
    if (typeof MediaRecorder === "undefined") {
      throw new NotImplementedError("MediaRecorder API");
    }

    // If preferred type is supported, use it
    if (preferred && MediaRecorder.isTypeSupported(preferred)) {
      return preferred;
    }

    // Try to find a supported type
    const supported = RecordingManager.getSupportedMimeTypes();

    if (supported.length === 0) {
      throw new StreamError(
        "No supported mime types found",
        "NO_SUPPORTED_MIME_TYPES",
      );
    }

    return supported[0];
  }

  /**
   * Create download link for recorded blob
   */
  static createDownloadLink(blob: Blob, filename: string): HTMLAnchorElement {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    return link;
  }

  /**
   * Download recorded blob
   */
  static downloadRecording(blob: Blob, filename: string): void {
    const link = this.createDownloadLink(blob, filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}
