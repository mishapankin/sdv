import { describe, expect, it } from "vitest";

import {
  addGitDiffSummaries,
  countTextLines,
  parseGitNumstat,
} from "@/lib/git-stats";

describe("Git diff statistics", () => {
  it("aggregates text, binary, and renamed numstat records", () => {
    expect(
      parseGitNumstat(
        [
          "5\t2\tsrc/app.ts",
          "-\t-\timage.png",
          "0\t0\t",
          "old.ts",
          "new.ts",
          "",
        ].join("\0"),
      ),
    ).toEqual({
      fileCount: 3,
      additions: 5,
      deletions: 2,
    });
  });

  it("counts unterminated and newline-terminated text consistently", () => {
    expect(countTextLines("")).toBe(0);
    expect(countTextLines("one")).toBe(1);
    expect(countTextLines("one\n")).toBe(1);
    expect(countTextLines("one\ntwo")).toBe(2);
    expect(countTextLines("one\ntwo\n")).toBe(2);
  });

  it("combines tracked and untracked summaries", () => {
    expect(
      addGitDiffSummaries(
        { fileCount: 2, additions: 5, deletions: 3 },
        { fileCount: 1, additions: 8, deletions: 0 },
      ),
    ).toEqual({ fileCount: 3, additions: 13, deletions: 3 });
  });
});
