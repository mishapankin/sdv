import type { Comparison } from "@/lib/sem-types";

function quoteShellArgument(argument: string) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(argument)) {
    return argument;
  }

  return `'${argument.replaceAll("'", "'\\''")}'`;
}

function formatShellCommand(command: string, args: string[]) {
  return [command, ...args].map(quoteShellArgument).join(" ");
}

export function getComparisonFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): Comparison {
  const mode = searchParams.get("mode");

  if (mode === "staged") {
    return { mode: "staged" };
  }

  if (mode === "commits") {
    return {
      mode: "commits",
      from: searchParams.get("from") || "HEAD~1",
      to: searchParams.get("to") || "HEAD",
    };
  }

  return { mode: "changed" };
}

export function getComparisonLabel(comparison: Comparison) {
  if (comparison.mode === "staged") return "Staged";
  if (comparison.mode === "commits") {
    return `${comparison.from} → ${comparison.to}`;
  }
  return "Changed";
}

export function getSemCommand(comparison: Comparison) {
  if (comparison.mode === "staged") {
    return "sem diff --staged --verbose --format json";
  }

  if (comparison.mode === "commits") {
    return formatShellCommand("sem", [
      "diff",
      "--from",
      comparison.from,
      "--to",
      comparison.to,
      "--verbose",
      "--format",
      "json",
    ]);
  }

  return "sem diff HEAD --verbose --format json";
}

export function getGitFileDiffCommand(
  comparison: Comparison,
  filePath: string,
  isUntracked = false,
) {
  if (isUntracked) {
    return formatShellCommand("git", [
      "diff",
      "--no-index",
      "--",
      "/dev/null",
      filePath,
    ]);
  }

  if (comparison.mode === "staged") {
    return formatShellCommand("git", [
      "diff",
      "--cached",
      "--",
      filePath,
    ]);
  }

  if (comparison.mode === "commits") {
    return formatShellCommand("git", [
      "diff",
      "--end-of-options",
      comparison.from,
      comparison.to,
      "--",
      filePath,
    ]);
  }

  return formatShellCommand("git", ["diff", "HEAD", "--", filePath]);
}
