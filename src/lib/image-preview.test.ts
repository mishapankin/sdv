import { describe, expect, it } from "vitest";

import {
  createImageSnapshot,
  detectImageMimeType,
  hasPreviewableImageExtension,
  MAX_IMAGE_PREVIEW_BYTES,
} from "@/lib/image-preview";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("image previews", () => {
  it("recognizes supported paths case-insensitively", () => {
    expect(hasPreviewableImageExtension("assets/preview.PNG")).toBe(true);
    expect(hasPreviewableImageExtension("assets/vector.svg")).toBe(false);
    expect(hasPreviewableImageExtension("assets/archive.bin")).toBe(false);
  });

  it("detects image content from its signature", () => {
    expect(detectImageMimeType(PNG)).toBe("image/png");
    expect(detectImageMimeType(Buffer.from([1, 0, 2]))).toBeNull();
  });

  it("creates a serializable data URL snapshot", () => {
    expect(createImageSnapshot(PNG)).toEqual({
      dataUrl: `data:image/png;base64,${PNG.toString("base64")}`,
      mimeType: "image/png",
      byteSize: PNG.length,
    });
  });

  it("does not preview files above the size limit", () => {
    const oversized = Buffer.alloc(MAX_IMAGE_PREVIEW_BYTES + 1);
    expect(createImageSnapshot(oversized)).toBeNull();
  });
});
