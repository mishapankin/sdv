import type { FileGroup } from "@/lib/group-changes";

export function resolveDiffSelection(
  fileGroups: FileGroup[],
  selectedEntityIdFromUrl?: string,
  selectedFilePath?: string,
) {
  const navigableChanges = fileGroups.flatMap((group) => group.changes);
  const explicitlySelectedFileGroup = fileGroups.find(
    (group) => group.filePath === selectedFilePath,
  );
  const selectedChange =
    explicitlySelectedFileGroup === undefined
      ? (navigableChanges.find(
          (change) => change.entityId === selectedEntityIdFromUrl,
        ) ?? navigableChanges[0])
      : undefined;
  const effectiveSelectedFilePath =
    explicitlySelectedFileGroup?.filePath ??
    selectedChange?.filePath ??
    fileGroups[0]?.filePath;
  const selectedFileGroup = fileGroups.find(
    (group) => group.filePath === effectiveSelectedFilePath,
  );

  return {
    navigableChanges,
    selectedChange,
    selectedEntityId: selectedChange?.entityId,
    selectedEntityIndex: selectedChange
      ? navigableChanges.findIndex(
          (change) => change.entityId === selectedChange.entityId,
        )
      : -1,
    effectiveSelectedFilePath,
    selectedFileGroup,
    fileDiffPath: selectedChange
      ? undefined
      : effectiveSelectedFilePath,
  };
}
