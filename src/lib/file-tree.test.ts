import { describe, expect, it } from "vitest";

import { buildFileTree } from "@/lib/file-tree";
import { groupByFile } from "@/lib/group-changes";
import type { SemanticChange } from "@/lib/sem-types";

function change(
  entityId: string,
  filePath: string,
): SemanticChange {
  return {
    entityId,
    filePath,
    changeType: "modified",
    entityType: "function",
    entityName: entityId,
  };
}

describe("file tree", () => {
  it("builds nested directories with folders before files", () => {
    const groups = groupByFile([
      change("root", "README.md"),
      change("button", "src/components/button.tsx"),
      change("app", "src/app.ts"),
      change("test10", "tests/case10.ts"),
      change("test2", "tests/case2.ts"),
    ]);
    const tree = buildFileTree(groups);

    expect(tree.map((node) => `${node.type}:${node.name}`)).toEqual([
      "directory:src",
      "directory:tests",
      "file:README.md",
    ]);
    expect(tree[0]).toMatchObject({
      type: "directory",
      path: "src",
      fileCount: 2,
      children: [
        {
          type: "directory",
          path: "src/components",
          fileCount: 1,
        },
        {
          type: "file",
          name: "app.ts",
          path: "src/app.ts",
        },
      ],
    });
    expect(tree[1]).toMatchObject({
      type: "directory",
      fileCount: 2,
      children: [
        { type: "file", name: "case2.ts" },
        { type: "file", name: "case10.ts" },
      ],
    });
  });

  it("keeps the original file group on each leaf", () => {
    const [group] = groupByFile([
      change("renamed", "src/new-name.ts"),
    ]);
    group.oldFilePath = "src/old-name.ts";

    const tree = buildFileTree([group]);
    const src = tree[0];

    expect(src.type).toBe("directory");
    if (src.type !== "directory") return;

    expect(src.children[0]).toMatchObject({
      type: "file",
      name: "new-name.ts",
      path: "src/new-name.ts",
      group: {
        oldFilePath: "src/old-name.ts",
      },
    });
  });
});
