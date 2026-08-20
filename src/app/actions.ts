"use server";

import { z } from "zod";

import {
  readFileDiff,
  readRecentCommits,
  readSemanticDiff,
  validateComparisonRefs,
} from "@/lib/sem";
import { comparisonSchema } from "@/lib/sem-types";
import { readWorkspaceRepositories } from "@/lib/workspace";

const filePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((filePath) => !filePath.includes("\0"), "Invalid file path");
const repoIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((repoId) => !repoId.includes("\0"), "Invalid repository id")
  .optional();

function reportValidationError(message: string) {
  console.error(`sdv: ${message}`);
  return { ok: false as const, error: message };
}

export async function getWorkspaceRepositories() {
  return readWorkspaceRepositories();
}

export async function getSemanticDiff(comparison: unknown, repoId?: unknown) {
  const parsed = comparisonSchema.safeParse(comparison);
  const parsedRepoId = repoIdSchema.safeParse(repoId);

  if (!parsed.success) {
    return reportValidationError("invalid comparison");
  }

  if (!parsedRepoId.success) {
    return reportValidationError("invalid repository id");
  }

  return readSemanticDiff(parsed.data, parsedRepoId.data);
}

export async function getFileDiff(
  filePath: string,
  comparison: unknown,
  repoId?: unknown,
) {
  const parsed = filePathSchema.safeParse(filePath);
  const parsedComparison = comparisonSchema.safeParse(comparison);
  const parsedRepoId = repoIdSchema.safeParse(repoId);

  if (!parsed.success) {
    const message = `invalid file path: ${parsed.error.issues[0]?.message ?? "validation failed"}`;
    return reportValidationError(message);
  }

  if (!parsedComparison.success) {
    return reportValidationError("invalid comparison");
  }

  if (!parsedRepoId.success) {
    return reportValidationError("invalid repository id");
  }

  return readFileDiff(parsed.data, parsedComparison.data, parsedRepoId.data);
}

export async function getRecentCommits(repoId?: unknown) {
  const parsedRepoId = repoIdSchema.safeParse(repoId);

  if (!parsedRepoId.success) {
    return reportValidationError("invalid repository id");
  }

  return readRecentCommits(parsedRepoId.data);
}

export async function validateGitRefs(
  from: unknown,
  to: unknown,
  repoId?: unknown,
) {
  const refSchema = z
    .string()
    .trim()
    .min(1)
    .max(256)
    .refine((ref) => !ref.includes("\0"), "Invalid Git ref");
  const parsedFrom = refSchema.safeParse(from);
  const parsedTo = refSchema.safeParse(to);
  const parsedRepoId = repoIdSchema.safeParse(repoId);

  if (!parsedFrom.success) {
    return {
      ok: false as const,
      field: "from" as const,
      error: "Invalid base ref.",
    };
  }
  if (!parsedTo.success) {
    return {
      ok: false as const,
      field: "to" as const,
      error: "Invalid compare ref.",
    };
  }
  if (!parsedRepoId.success) {
    return {
      ok: false as const,
      field: "from" as const,
      error: "Invalid repository id.",
    };
  }

  return validateComparisonRefs(
    parsedFrom.data,
    parsedTo.data,
    parsedRepoId.data,
  );
}
