import { describe, expect, it } from "vitest";

import {
  getGitDiffArgs,
  getSemDiffArgs,
} from "@/lib/git-arguments";

describe("diff argument construction", () => {
  it("compares Changed from the resolved HEAD", () => {
    const comparison = { mode: "changed" as const, base: "abc123" };

    expect(getSemDiffArgs(comparison)).toEqual([
      "diff",
      "--verbose",
      "--format",
      "json",
      "abc123",
    ]);
    expect(getGitDiffArgs(comparison)).toEqual(["diff", "abc123"]);
  });

  it("constructs staged and resolved ref comparisons", () => {
    expect(getGitDiffArgs({ mode: "staged" })).toEqual([
      "diff",
      "--cached",
    ]);
    expect(
      getSemDiffArgs({
        mode: "commits",
        from: "resolved-from",
        to: "resolved-to",
      }),
    ).toEqual([
      "diff",
      "--verbose",
      "--format",
      "json",
      "--from",
      "resolved-from",
      "--to",
      "resolved-to",
    ]);
  });
});
