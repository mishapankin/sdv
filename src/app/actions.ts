"use server";

import { z } from "zod";

import {
  readFileDiff,
  readRecentCommits,
  readSemanticDiff,
} from "@/lib/sem";
import { comparisonSchema } from "@/lib/sem-types";

const filePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((filePath) => !filePath.includes("\0"), "Invalid file path");

function reportValidationError(message: string) {
  console.error(`sdv: ${message}`);
  return { ok: false as const, error: message };
}

export async function getSemanticDiff(comparison: unknown) {
  const parsed = comparisonSchema.safeParse(comparison);

  if (!parsed.success) {
    return reportValidationError("invalid comparison");
  }

  return readSemanticDiff(parsed.data);
}

export async function getFileDiff(filePath: string, comparison: unknown) {
  const parsed = filePathSchema.safeParse(filePath);
  const parsedComparison = comparisonSchema.safeParse(comparison);

  if (!parsed.success) {
    const message = `invalid file path: ${parsed.error.issues[0]?.message ?? "validation failed"}`;
    return reportValidationError(message);
  }

  if (!parsedComparison.success) {
    return reportValidationError("invalid comparison");
  }

  return readFileDiff(parsed.data, parsedComparison.data);
}

export async function getRecentCommits() {
  return readRecentCommits();
}
