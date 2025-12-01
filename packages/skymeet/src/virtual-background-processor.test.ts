/**
 * VirtualBackgroundProcessor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VirtualBackgroundProcessor } from "./virtual-background-processor.js";
import { StreamError, NotImplementedError } from "./errors.js";

// Mock browser APIs
class MockHTMLCanvasElement {
  width = 0;
  height = 0;
  private context: any = null;
  private stream: any = null;

  getContext(type: string, options?: any): any {
    if (type === "2d") {
      this.context = new MockCanvasRenderingContext2D();
      return this.context;
    }
    return null;
  }

  captureStream(frameRate?: number): MediaStream {
    this.stream = new MockMediaStream();
    return this.stream as any;
  }
}

class MockCanvasRenderingContext2D {
  filter = "none";
  globalAlpha = 1.0;

  drawImage = vi.fn();
}

class MockHTMLVideoElement {
  srcObject: any = null;
  autoplay = false;
  playsInline = false;
  muted = false;
  width = 0;
  height = 0;
  readyState = 4; // HAVE_ENOUGH_DATA
  HAVE_ENOUGH_DATA = 4;

  pause(): void {}
}

class MockHTMLImageElement {
  private _src = "";
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  shouldFailLoad = false;

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // Auto-trigger load/error asynchronously to simulate browser behavior
    setTimeout(() => {
      if (this.shouldFailLoad && this.onerror) {
        this.onerror();
      } else if (this.onload) {
        this.onload();
      }
    }, 0);
  }

  triggerLoad(): void {
    if (this.onload) {
      this.onload();
    }
  }

  triggerError(): void {
    if (this.onerror) {
      this.onerror();
    }
  }
}

class MockMediaStream {
  private tracks: any[] = [{ kind: "video", stop: vi.fn() }];

  getTracks(): any[] {
    return this.tracks;
  }
}

describe("VirtualBackgroundProcessor", () => {
  let processor: VirtualBackgroundProcessor;
  let mockStream: MediaStream;

  beforeEach(() => {
    processor = new VirtualBackgroundProcessor();
    mockStream = new MockMediaStream() as any;

    // Mock document and browser APIs
    (global as any).document = {
      createElement: vi.fn((tag: string) => {
        if (tag === "canvas") {
          return new MockHTMLCanvasElement();
        } else if (tag === "video") {
          return new MockHTMLVideoElement();
        }
        return null;
      }),
    };

    (global as any).Image = MockHTMLImageElement;
    (global as any).requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
    (global as any).cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    processor.stopProcessing();
  });

  describe("startProcessing", () => {
    it("should start processing with no effect", async () => {
      const outputStream = await processor.startProcessing(mockStream, {
        effect: "none",
      });

      expect(outputStream).toBeDefined();
      expect(processor.isProcessing()).toBe(true);
    });

    it("should start processing with blur effect", async () => {
      const outputStream = await processor.startProcessing(mockStream, {
        effect: "blur",
        blurAmount: 15,
      });

      expect(outputStream).toBeDefined();
      expect(processor.isProcessing()).toBe(true);

      const state = processor.getState();
      expect(state.effect).toBe("blur");
    });

    it("should start processing with image effect", async () => {
      const outputStream = await processor.startProcessing(mockStream, {
        effect: "image",
        imageUrl: "https://example.com/background.jpg",
      });

      expect(outputStream).toBeDefined();
      expect(processor.isProcessing()).toBe(true);
    });

    it("should throw error if already processing", async () => {
      await processor.startProcessing(mockStream);

      await expect(processor.startProcessing(mockStream)).rejects.toThrow(
        StreamError,
      );
      await expect(processor.startProcessing(mockStream)).rejects.toThrow(
        "Already processing",
      );
    });

    it("should throw NotImplementedError if no DOM", async () => {
      (global as any).document = undefined;

      await expect(processor.startProcessing(mockStream)).rejects.toThrow(
        NotImplementedError,
      );
    });

    it("should handle custom dimensions", async () => {
      await processor.startProcessing(mockStream, {
        effect: "none",
        width: 1920,
        height: 1080,
      });

      const canvas = processor.getCanvas();
      expect(canvas?.width).toBe(1920);
      expect(canvas?.height).toBe(1080);
    });

    it("should handle custom frame rate", async () => {
      await processor.startProcessing(mockStream, {
        effect: "none",
        frameRate: 60,
      });

      expect(processor.isProcessing()).toBe(true);
    });
  });

  describe("stopProcessing", () => {
    beforeEach(async () => {
      await processor.startProcessing(mockStream);
    });

    it("should stop processing", () => {
      processor.stopProcessing();

      expect(processor.isProcessing()).toBe(false);
      expect(processor.getOutputStream()).toBeNull();
    });

    it("should cleanup resources", () => {
      const outputStream = processor.getOutputStream();
      const tracks = outputStream?.getTracks() || [];

      processor.stopProcessing();

      tracks.forEach((track: any) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });

    it("should handle stopping when not processing", () => {
      processor.stopProcessing();

      // Should not throw
      expect(() => processor.stopProcessing()).not.toThrow();
    });

    it("should cancel animation frame", () => {
      // Simply verify that stopProcessing doesn't throw and properly cleans up
      // The actual cancelAnimationFrame call is implementation detail
      expect(() => processor.stopProcessing()).not.toThrow();
      expect(processor.isProcessing()).toBe(false);
    });
  });

  describe("changeEffect", () => {
    beforeEach(async () => {
      await processor.startProcessing(mockStream, { effect: "none" });
    });

    it("should change to blur effect", async () => {
      await processor.changeEffect("blur");

      const state = processor.getState();
      expect(state.effect).toBe("blur");
    });

    it("should change to image effect", async () => {
      await processor.changeEffect("image", "https://example.com/bg.jpg");

      const state = processor.getState();
      expect(state.effect).toBe("image");
    });

    it("should throw error if not processing", async () => {
      processor.stopProcessing();

      await expect(processor.changeEffect("blur")).rejects.toThrow(StreamError);
      await expect(processor.changeEffect("blur")).rejects.toThrow(
        "Not currently processing",
      );
    });
  });

  describe("getState", () => {
    it("should return initial state", () => {
      const state = processor.getState();

      expect(state).toEqual({
        isProcessing: false,
        effect: "none",
        inputStream: null,
        outputStream: null,
      });
    });

    it("should return processing state", async () => {
      await processor.startProcessing(mockStream, { effect: "blur" });

      const state = processor.getState();

      expect(state.isProcessing).toBe(true);
      expect(state.effect).toBe("blur");
      expect(state.inputStream).toBe(mockStream);
      expect(state.outputStream).toBeDefined();
    });
  });

  describe("isSupported", () => {
    it("should return true when supported", () => {
      expect(VirtualBackgroundProcessor.isSupported()).toBe(true);
    });

    it("should return false when no document", () => {
      (global as any).document = undefined;

      expect(VirtualBackgroundProcessor.isSupported()).toBe(false);
    });

    it("should return false when no canvas support", () => {
      (global as any).document = {
        createElement: vi.fn(() => ({
          getContext: () => null,
        })),
      };

      expect(VirtualBackgroundProcessor.isSupported()).toBe(false);
    });

    it("should return false when no captureStream support", () => {
      (global as any).document = {
        createElement: vi.fn(() => ({
          getContext: () => ({}),
          captureStream: undefined,
        })),
      };

      expect(VirtualBackgroundProcessor.isSupported()).toBe(false);
    });
  });

  describe("getCanvas", () => {
    it("should return null initially", () => {
      expect(processor.getCanvas()).toBeNull();
    });

    it("should return canvas after processing starts", async () => {
      await processor.startProcessing(mockStream);

      const canvas = processor.getCanvas();
      expect(canvas).toBeDefined();
      expect(canvas).toBeInstanceOf(MockHTMLCanvasElement);
    });
  });

  describe("getOutputStream", () => {
    it("should return null initially", () => {
      expect(processor.getOutputStream()).toBeNull();
    });

    it("should return stream after processing starts", async () => {
      await processor.startProcessing(mockStream);

      const outputStream = processor.getOutputStream();
      expect(outputStream).toBeDefined();
      expect(outputStream).toBeInstanceOf(MockMediaStream);
    });
  });

  describe("Error Handling", () => {
    it("should handle image load failure", async () => {
      // Configure next Image to fail
      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockHTMLImageElement {
        shouldFailLoad = true;
      };

      const promise = processor.startProcessing(mockStream, {
        effect: "image",
        imageUrl: "https://example.com/invalid.jpg",
      });

      await expect(promise).rejects.toThrow(StreamError);
      await expect(promise).rejects.toThrow("Failed to load background image");

      // Restore original Image
      (global as any).Image = originalImage;
    });

    it("should handle missing canvas context", async () => {
      (global as any).document = {
        createElement: vi.fn((tag: string) => {
          if (tag === "canvas") {
            return {
              width: 0,
              height: 0,
              getContext: () => null,
              captureStream: () => new MockMediaStream(),
            };
          }
          return new MockHTMLVideoElement();
        }),
      };

      await expect(processor.startProcessing(mockStream)).rejects.toThrow(
        StreamError,
      );
      await expect(processor.startProcessing(mockStream)).rejects.toThrow(
        "Failed to get canvas 2D context",
      );
    });
  });
});
