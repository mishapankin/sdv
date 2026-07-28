import { parseDiffFromFile } from "@pierre/diffs";
import { describe, expect, it } from "vitest";

import { shouldExpandUnchanged } from "@/lib/diff-rendering";

function createChangedFileDiff(lineCount: number) {
  const oldLines = Array.from(
    { length: lineCount },
    (_, index) => `line ${index + 1}`,
  );
  const newLines = [...oldLines];
  newLines[Math.floor(lineCount / 2)] = "changed line";

  return parseDiffFromFile(
    { name: "example.ts", contents: oldLines.join("\n") },
    { name: "example.ts", contents: newLines.join("\n") },
    { context: 3 },
  );
}

describe("shouldExpandUnchanged", () => {
  it("expands a diff whose larger side has exactly 50 lines", () => {
    expect(shouldExpandUnchanged(createChangedFileDiff(50))).toBe(true);
  });

  it("keeps unchanged lines collapsed when either side exceeds 50 lines", () => {
    const fileDiff = parseDiffFromFile(
      { name: "example.ts", contents: "old line" },
      {
        name: "example.ts",
        contents: Array.from(
          { length: 51 },
          (_, index) => `new line ${index + 1}`,
        ).join("\n"),
      },
      { context: 3 },
    );

    expect(shouldExpandUnchanged(fileDiff)).toBe(false);
  });
});
