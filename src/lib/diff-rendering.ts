import type { FileDiffMetadata } from "@pierre/diffs";

export const FULL_DIFF_LINE_LIMIT = 50;

export function shouldExpandUnchanged(fileDiff: FileDiffMetadata) {
  return (
    Math.max(fileDiff.deletionLines.length, fileDiff.additionLines.length) <=
    FULL_DIFF_LINE_LIMIT
  );
}
