export type ResolvedComparison =
  | { mode: "changed"; base: string }
  | { mode: "staged" }
  | { mode: "commits"; from: string; to: string };

export function getSemDiffArgs(comparison: ResolvedComparison) {
  const args = ["diff", "--verbose", "--format", "json"];

  if (comparison.mode === "changed") {
    args.push(comparison.base);
  } else if (comparison.mode === "staged") {
    args.push("--staged");
  } else {
    args.push("--from", comparison.from, "--to", comparison.to);
  }

  return args;
}

export function getGitDiffArgs(comparison: ResolvedComparison) {
  if (comparison.mode === "changed") {
    return ["diff", comparison.base];
  }

  if (comparison.mode === "staged") {
    return ["diff", "--cached"];
  }

  return ["diff", comparison.from, comparison.to];
}
