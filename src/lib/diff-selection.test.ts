import { describe, expect, it } from "vitest";

import { resolveDiffSelection } from "@/lib/diff-selection";
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

const fileGroups = groupByFile([
  change("first", "src/a.ts"),
  change("second", "src/b.ts"),
]);

describe("three-pane diff selection", () => {
  it("defaults to the first semantic entity", () => {
    expect(resolveDiffSelection(fileGroups)).toMatchObject({
      effectiveSelectedFilePath: "src/a.ts",
      fileDiffPath: undefined,
      selectedEntityId: "first",
      selectedEntityIndex: 0,
    });
  });

  it("derives the selected file from an entity selection", () => {
    expect(resolveDiffSelection(fileGroups, "second")).toMatchObject({
      effectiveSelectedFilePath: "src/b.ts",
      fileDiffPath: undefined,
      selectedEntityId: "second",
      selectedEntityIndex: 1,
    });
  });

  it("gives explicit file selection precedence", () => {
    expect(
      resolveDiffSelection(fileGroups, "second", "src/a.ts"),
    ).toMatchObject({
      effectiveSelectedFilePath: "src/a.ts",
      fileDiffPath: "src/a.ts",
      selectedChange: undefined,
    });
  });

  it("falls back from a stale file path to the first semantic entity", () => {
    expect(
      resolveDiffSelection(fileGroups, undefined, "src/missing.ts"),
    ).toMatchObject({
      effectiveSelectedFilePath: "src/a.ts",
      fileDiffPath: undefined,
      selectedFileGroup: {
        filePath: "src/a.ts",
      },
      selectedEntityId: "first",
      selectedEntityIndex: 0,
    });
  });

  it("falls back from an unknown entity to the first semantic entity", () => {
    expect(resolveDiffSelection(fileGroups, "unknown")).toMatchObject({
      effectiveSelectedFilePath: "src/a.ts",
      fileDiffPath: undefined,
      selectedEntityId: "first",
      selectedEntityIndex: 0,
    });
  });

  it("falls back to the first full-file diff when there are no entities", () => {
    const groupsWithoutEntities = groupByFile([], [
      {
        filePath: "README.md",
        changeType: "modified",
        binary: false,
      },
    ]);

    expect(resolveDiffSelection(groupsWithoutEntities)).toMatchObject({
      effectiveSelectedFilePath: "README.md",
      fileDiffPath: "README.md",
      selectedChange: undefined,
      selectedEntityIndex: -1,
    });
  });
});
