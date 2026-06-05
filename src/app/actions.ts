"use server";

import { z } from "zod";

import { readFileDiff, readSemanticDiff } from "@/lib/sem";

const filePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((filePath) => !filePath.includes("\0"), "Invalid file path");

export async function getSemanticDiff() {
  return readSemanticDiff();
}

export async function getFileDiff(filePath: string) {
  const parsed = filePathSchema.safeParse(filePath);

  if (!parsed.success) {
    const message = `invalid file path: ${parsed.error.issues[0]?.message ?? "validation failed"}`;
    console.error(`sdv: ${message}`);
    return { ok: false as const, error: message };
  }

  return readFileDiff(parsed.data);
}
