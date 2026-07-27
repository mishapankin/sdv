import { describe, expect, it } from "vitest";

import { groupByFile } from "@/lib/group-changes";
import type { SemanticChange } from "@/lib/sem-types";

function change(
  overrides: Partial<SemanticChange> & Pick<SemanticChange, "entityId" | "filePath">,
): SemanticChange {
  return {
    changeType: "modified",
    entityType: "function",
    entityName: "example",
    ...overrides,
  };
}

describe("file grouping", () => {
  it("sorts files and entities and preserves rename metadata", () => {
    const groups = groupByFile([
      change({ entityId: "later", filePath: "b.ts", startLine: 20 }),
      change({
        entityId: "renamed",
        filePath: "a.ts",
        oldFilePath: "old-a.ts",
        startLine: 5,
      }),
      change({ entityId: "earlier", filePath: "b.ts", startLine: 2 }),
    ]);

    expect(groups.map((group) => group.filePath)).toEqual(["a.ts", "b.ts"]);
    expect(groups[0]).toMatchObject({
      oldFilePath: "old-a.ts",
      changeType: "renamed",
    });
    expect(groups[1].changes.map((item) => item.entityId)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("includes file-only untracked and binary changes", () => {
    const groups = groupByFile([], [
      {
        changeType: "untracked",
        filePath: "empty.txt",
        oldFilePath: null,
        fileStatus: "added",
      },
      {
        changeType: "binary",
        filePath: "image.png",
        oldFilePath: null,
        fileStatus: "modified",
      },
    ]);

    expect(groups).toMatchObject([
      { filePath: "empty.txt", changeType: "added" },
      { filePath: "image.png", changeType: "modified" },
    ]);
  });
});
