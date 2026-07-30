import "server-only";

import type { ImageSnapshot } from "@/lib/sem-types";

export const MAX_IMAGE_PREVIEW_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

export function hasPreviewableImageExtension(filePath: string) {
  const extensionIndex = filePath.lastIndexOf(".");
  const extension =
    extensionIndex === -1 ? "" : filePath.slice(extensionIndex).toLowerCase();

  return IMAGE_EXTENSIONS.has(extension);
}

export function detectImageMimeType(content: Buffer): string | null {
  if (
    content.length >= 8 &&
    content.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }

  if (
    content.length >= 3 &&
    content[0] === 0xff &&
    content[1] === 0xd8 &&
    content[2] === 0xff
  ) {
    return "image/jpeg";
  }

  const signature = content.subarray(0, 12).toString("ascii");

  if (signature.startsWith("GIF87a") || signature.startsWith("GIF89a")) {
    return "image/gif";
  }

  if (signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") {
    return "image/webp";
  }

  if (
    content.length >= 12 &&
    content.subarray(4, 8).toString("ascii") === "ftyp" &&
    content.subarray(8, Math.min(content.length, 32)).includes("avif")
  ) {
    return "image/avif";
  }

  if (content.length >= 2 && content.subarray(0, 2).toString("ascii") === "BM") {
    return "image/bmp";
  }

  if (
    content.length >= 4 &&
    content[0] === 0 &&
    content[1] === 0 &&
    content[2] === 1 &&
    content[3] === 0
  ) {
    return "image/x-icon";
  }

  return null;
}

export function createImageSnapshot(content: Buffer): ImageSnapshot | null {
  if (content.length > MAX_IMAGE_PREVIEW_BYTES) {
    return null;
  }

  const mimeType = detectImageMimeType(content);

  if (!mimeType) {
    return null;
  }

  return {
    dataUrl: `data:${mimeType};base64,${content.toString("base64")}`,
    mimeType,
    byteSize: content.length,
  };
}
