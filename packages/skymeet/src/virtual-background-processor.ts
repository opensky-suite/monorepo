/**
 * VirtualBackgroundProcessor - Process video streams to add virtual backgrounds
 */

import { StreamError, NotImplementedError } from "./errors.js";

export type BackgroundEffect = "none" | "blur" | "image";

export interface BackgroundOptions {
  effect: BackgroundEffect;
  blurAmount?: number; // For blur effect (default: 10)
  imageUrl?: string; // For image replacement
  width?: number;
  height?: number;
  frameRate?: number; // Target frame rate (default: 30)
}

export interface ProcessorState {
  isProcessing: boolean;
  effect: BackgroundEffect;
  inputStream: MediaStream | null;
  outputStream: MediaStream | null;
}

export class VirtualBackgroundProcessor {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private outputStream: MediaStream | null = null;

  private state: ProcessorState = {
    isProcessing: false,
    effect: "none",
    inputStream: null,
    outputStream: null,
  };

  private options: BackgroundOptions = {
    effect: "none",
    blurAmount: 10,
    width: 1280,
    height: 720,
    frameRate: 30,
  };

  private backgroundImage: HTMLImageElement | null = null;

  /**
   * Start processing video stream with virtual background
   */
  async startProcessing(
    inputStream: MediaStream,
    options: Partial<BackgroundOptions> = {},
  ): Promise<MediaStream> {
    if (this.state.isProcessing) {
      throw new StreamError(
        "Already processing a stream",
        "ALREADY_PROCESSING",
      );
    }

    this.options = { ...this.options, ...options };
    this.state.effect = this.options.effect!;
    this.state.inputStream = inputStream;

    // Check browser support
    if (typeof document === "undefined") {
      throw new NotImplementedError("DOM (browser environment required)");
    }

    // Setup canvas and video element
    this.setupCanvas();
    this.setupVideo(inputStream);

    // Load background image if needed
    if (this.options.effect === "image" && this.options.imageUrl) {
      await this.loadBackgroundImage(this.options.imageUrl);
    }

    // Start processing frames
    this.startFrameProcessing();

    this.state.isProcessing = true;
    this.state.outputStream = this.outputStream;

    return this.outputStream!;
  }

  /**
   * Stop processing and cleanup resources
   */
  stopProcessing(): void {
    if (!this.state.isProcessing) {
      return;
    }

    // Stop animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop video element
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }

    // Stop output stream
    if (this.outputStream) {
      this.outputStream.getTracks().forEach((track) => track.stop());
      this.outputStream = null;
    }

    this.state.isProcessing = false;
    this.state.inputStream = null;
    this.state.outputStream = null;
  }

  /**
   * Change background effect on the fly
   */
  async changeEffect(
    effect: BackgroundEffect,
    imageUrl?: string,
  ): Promise<void> {
    if (!this.state.isProcessing) {
      throw new StreamError("Not currently processing", "NOT_PROCESSING");
    }

    this.options.effect = effect;
    this.state.effect = effect;

    if (effect === "image" && imageUrl) {
      this.options.imageUrl = imageUrl;
      await this.loadBackgroundImage(imageUrl);
    }
  }

  /**
   * Setup canvas for frame processing
   */
  private setupCanvas(): void {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.options.width!;
    this.canvas.height = this.options.height!;

    this.context = this.canvas.getContext("2d", {
      alpha: false,
      desynchronized: true, // Performance optimization
    });

    if (!this.context) {
      throw new StreamError(
        "Failed to get canvas 2D context",
        "CANVAS_CONTEXT_FAILED",
      );
    }

    // Get output stream from canvas
    const frameRate = this.options.frameRate!;
    this.outputStream = this.canvas.captureStream(frameRate);
  }

  /**
   * Setup video element for input stream
   */
  private setupVideo(stream: MediaStream): void {
    this.videoElement = document.createElement("video");
    this.videoElement.srcObject = stream;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    // Set video dimensions
    this.videoElement.width = this.options.width!;
    this.videoElement.height = this.options.height!;
  }

  /**
   * Load background image
   */
  private loadBackgroundImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        this.backgroundImage = img;
        resolve();
      };

      img.onerror = () => {
        reject(
          new StreamError(
            `Failed to load background image: ${imageUrl}`,
            "IMAGE_LOAD_FAILED",
          ),
        );
      };

      img.src = imageUrl;
    });
  }

  /**
   * Start frame processing loop
   */
  private startFrameProcessing(): void {
    const processFrame = () => {
      if (!this.state.isProcessing) {
        return;
      }

      if (
        this.videoElement &&
        this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA
      ) {
        this.processFrame();
      }

      this.animationFrameId = requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  /**
   * Process a single video frame
   */
  private processFrame(): void {
    if (!this.context || !this.videoElement || !this.canvas) {
      return;
    }

    const { width, height } = this.canvas;

    switch (this.options.effect) {
      case "none":
        // Just draw the video frame
        this.context.drawImage(this.videoElement, 0, 0, width, height);
        break;

      case "blur":
        // Draw video and apply blur filter
        this.context.filter = `blur(${this.options.blurAmount}px)`;
        this.context.drawImage(this.videoElement, 0, 0, width, height);
        this.context.filter = "none";
        break;

      case "image":
        // Draw background image, then overlay video (would need segmentation in production)
        if (this.backgroundImage) {
          this.context.drawImage(this.backgroundImage, 0, 0, width, height);
        }
        // In a real implementation, you'd use segmentation to mask the person
        // For now, just blend the video on top
        this.context.globalAlpha = 0.8;
        this.context.drawImage(this.videoElement, 0, 0, width, height);
        this.context.globalAlpha = 1.0;
        break;
    }
  }

  /**
   * Get current state
   */
  getState(): ProcessorState {
    return { ...this.state };
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.state.isProcessing;
  }

  /**
   * Get output stream
   */
  getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  /**
   * Get canvas element (for debugging/display)
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Static helper to check browser support
   */
  static isSupported(): boolean {
    if (typeof document === "undefined") {
      return false;
    }

    try {
      const canvas = document.createElement("canvas");
      const hasCanvas = !!canvas.getContext("2d");
      const hasCaptureStream = typeof canvas.captureStream === "function";
      return hasCanvas && hasCaptureStream;
    } catch {
      return false;
    }
  }
}
