import type { FileGroup } from "@/lib/group-changes";

export type DiffLineTarget = {
  lineNumber: number;
  side: "additions" | "deletions";
};

export type DiffSelection =
  | { type: "entity"; entityId: string }
  | { type: "file"; filePath: string; target?: DiffLineTarget };

function getDefaultSelection(
  fileGroups: FileGroup[],
  navigableChanges: FileGroup["changes"],
): DiffSelection | undefined {
  const firstChange = navigableChanges[0];

  if (firstChange) {
    return { type: "entity", entityId: firstChange.entityId };
  }

  const firstFileGroup = fileGroups[0];
  return firstFileGroup
    ? { type: "file", filePath: firstFileGroup.filePath }
    : undefined;
}

export function resolveDiffSelection(
  fileGroups: FileGroup[],
  selection: DiffSelection | null,
) {
  const navigableChanges = fileGroups.flatMap((group) => group.changes);
  const isValidSelection =
    selection?.type === "entity"
      ? navigableChanges.some(
          (change) => change.entityId === selection.entityId,
        )
      : selection?.type === "file"
        ? fileGroups.some((group) => group.filePath === selection.filePath)
        : false;
  const effectiveSelection =
    isValidSelection && selection
      ? selection
      : getDefaultSelection(fileGroups, navigableChanges);
  const selectedChange = navigableChanges.find(
    (change) =>
      effectiveSelection?.type === "entity" &&
      change.entityId === effectiveSelection.entityId,
  );
  const effectiveSelectedFilePath =
    effectiveSelection?.type === "file"
      ? effectiveSelection.filePath
      : selectedChange?.filePath;
  const selectedFileGroup = fileGroups.find(
    (group) => group.filePath === effectiveSelectedFilePath,
  );

  return {
    navigableChanges,
    selection: effectiveSelection,
    selectedChange,
    selectedEntityId: selectedChange?.entityId,
    selectedEntityIndex: selectedChange
      ? navigableChanges.findIndex(
          (change) => change.entityId === selectedChange.entityId,
        )
      : -1,
    effectiveSelectedFilePath,
    selectedFileGroup,
    fileDiffPath:
      effectiveSelection?.type === "file"
        ? effectiveSelection.filePath
        : undefined,
    fileTarget:
      effectiveSelection?.type === "file"
        ? effectiveSelection.target
        : undefined,
  };
}
