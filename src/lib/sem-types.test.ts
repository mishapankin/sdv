import { describe, expect, it } from "vitest";

import {
  comparisonSchema,
  semDiffSchema,
} from "@/lib/sem-types";

describe("process-boundary schemas", () => {
  it("accepts only the supported comparison modes", () => {
    expect(comparisonSchema.safeParse({ mode: "changed" }).success).toBe(true);
    expect(comparisonSchema.safeParse({ mode: "staged" }).success).toBe(true);
    expect(
      comparisonSchema.safeParse({
        mode: "commits",
        from: "HEAD~1",
        to: "HEAD",
      }).success,
    ).toBe(true);
    expect(comparisonSchema.safeParse({ mode: "unstaged" }).success).toBe(false);
  });

  it("validates verbose sem JSON with binary changes", () => {
    const result = semDiffSchema.safeParse({
      summary: {
        fileCount: 1,
        added: 0,
        modified: 0,
        deleted: 0,
        moved: 0,
        renamed: 0,
        reordered: 0,
        binary: 1,
        orphan: 0,
        total: 1,
      },
      changes: [],
      binaryChanges: [
        {
          changeType: "binary",
          filePath: "image.png",
          oldFilePath: null,
          fileStatus: "modified",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
