import type { GitDiffSummary } from "@/lib/sem-types";

export function parseGitNumstat(output: string): GitDiffSummary {
  const summary: GitDiffSummary = {
    fileCount: 0,
    additions: 0,
    deletions: 0,
  };

  for (const record of output.split("\0")) {
    const match = record.match(/^(\d+|-)\t(\d+|-)\t/);

    if (!match) continue;

    summary.fileCount += 1;

    if (match[1] !== "-") {
      summary.additions += Number(match[1]);
    }

    if (match[2] !== "-") {
      summary.deletions += Number(match[2]);
    }
  }

  return summary;
}

export function countTextLines(content: string) {
  if (!content) return 0;

  const lineBreakCount = content.split("\n").length - 1;
  return content.endsWith("\n") ? lineBreakCount : lineBreakCount + 1;
}

export function addGitDiffSummaries(
  left: GitDiffSummary,
  right: GitDiffSummary,
): GitDiffSummary {
  return {
    fileCount: left.fileCount + right.fileCount,
    additions: left.additions + right.additions,
    deletions: left.deletions + right.deletions,
  };
}
