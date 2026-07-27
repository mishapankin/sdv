import type { Comparison } from "@/lib/sem-types";

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
    return `sem diff --from ${comparison.from} --to ${comparison.to} --verbose --format json`;
  }

  return "sem diff HEAD --verbose --format json";
}
