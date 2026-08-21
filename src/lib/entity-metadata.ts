import { parseDiffFromFile, type FileDiffMetadata } from "@pierre/diffs";

import type { SemanticChange } from "@/lib/sem-types";

export type EntityLineStats = {
  additions: number;
  deletions: number;
};

export function formatLineRange(
  startLine?: number | null,
  endLine?: number | null,
) {
  if (startLine == null) return null;
  if (endLine == null || endLine === startLine) return `L${startLine}`;
  return `L${startLine}–${endLine}`;
}

export function createEntityFileDiff(
  change: SemanticChange,
  renderVersion?: string,
): FileDiffMetadata {
  const oldName = change.oldFilePath || change.filePath;
  const version = renderVersion ? `:${renderVersion}` : "";
  const fileDiff = parseDiffFromFile(
    {
      name: oldName,
      contents: change.beforeContent ?? "",
      cacheKey: `${change.entityId}${version}:before`,
    },
    {
      name: change.filePath,
      contents: change.afterContent ?? "",
      cacheKey: `${change.entityId}${version}:after`,
    },
    { context: 3 },
  );
  const oldOffset = Math.max((change.oldStartLine ?? 1) - 1, 0);
  const newOffset = Math.max((change.startLine ?? 1) - 1, 0);

  for (const hunk of fileDiff.hunks) {
    hunk.deletionStart += oldOffset;
    hunk.additionStart += newOffset;
    hunk.hunkSpecs = `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`;
  }

  return fileDiff;
}

export function getEntityLineStats(change: SemanticChange): EntityLineStats {
  const fileDiff = createEntityFileDiff(change);

  return fileDiff.hunks.reduce(
    (stats, hunk) => ({
      additions: stats.additions + hunk.additionLines,
      deletions: stats.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
}
