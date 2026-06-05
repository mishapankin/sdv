import type { SemanticChange } from "@/lib/sem-types";

const MODULE_ENTITY_TYPES = new Set(["orphan", "module", "module-level"]);
const MAX_LINE_GAP = 3;

function isModuleLevel(change: SemanticChange) {
  return (
    MODULE_ENTITY_TYPES.has(change.entityType.toLowerCase()) ||
    change.entityName.toLowerCase() === "module-level"
  );
}

function getOldRange(change: SemanticChange) {
  return {
    start: change.oldStartLine ?? change.startLine ?? 1,
    end:
      change.oldEndLine ??
      change.endLine ??
      change.oldStartLine ??
      change.startLine ??
      1,
  };
}

function getNewRange(change: SemanticChange) {
  return {
    start: change.startLine ?? change.oldStartLine ?? 1,
    end:
      change.endLine ??
      change.oldEndLine ??
      change.startLine ??
      change.oldStartLine ??
      1,
  };
}

function rangesAreNearby(
  deleted: SemanticChange,
  added: SemanticChange,
) {
  const oldRange = getOldRange(deleted);
  const newRange = getNewRange(added);

  return (
    oldRange.start <= newRange.end + MAX_LINE_GAP &&
    newRange.start <= oldRange.end + MAX_LINE_GAP
  );
}

function mergeStructuralChange(
  deleted: SemanticChange,
  added: SemanticChange,
) {
  if (deleted.structuralChange === true || added.structuralChange === true) {
    return true;
  }

  if (
    deleted.structuralChange === false &&
    added.structuralChange === false
  ) {
    return false;
  }

  return null;
}

function mergePair(
  deleted: SemanticChange,
  added: SemanticChange,
): SemanticChange {
  const oldRange = getOldRange(deleted);
  const newRange = getNewRange(added);

  return {
    entityId: `${deleted.filePath}::module-level::merged::${deleted.entityId}::${added.entityId}`,
    entityName: "module-level",
    entityType: "orphan",
    changeType: "modified",
    filePath: added.filePath,
    oldFilePath: deleted.oldFilePath ?? deleted.filePath,
    oldEntityName: deleted.entityName,
    oldStartLine: oldRange.start,
    oldEndLine: oldRange.end,
    startLine: newRange.start,
    endLine: newRange.end,
    beforeContent: deleted.beforeContent ?? "",
    afterContent: added.afterContent ?? "",
    structuralChange: mergeStructuralChange(deleted, added),
  };
}

export function mergeModuleLevelChanges(changes: SemanticChange[]) {
  const changesByFile = new Map<string, SemanticChange[]>();

  for (const change of changes) {
    const fileChanges = changesByFile.get(change.filePath) ?? [];
    fileChanges.push(change);
    changesByFile.set(change.filePath, fileChanges);
  }

  const mergedChanges: SemanticChange[] = [];

  for (const fileChanges of changesByFile.values()) {
    const deleted = fileChanges.filter(
      (change) => isModuleLevel(change) && change.changeType === "deleted",
    );
    const added = fileChanges.filter(
      (change) => isModuleLevel(change) && change.changeType === "added",
    );

    if (
      deleted.length === 1 &&
      added.length === 1 &&
      rangesAreNearby(deleted[0], added[0])
    ) {
      const pairedIds = new Set([deleted[0].entityId, added[0].entityId]);
      mergedChanges.push(
        ...fileChanges.filter((change) => !pairedIds.has(change.entityId)),
        mergePair(deleted[0], added[0]),
      );
    } else {
      mergedChanges.push(...fileChanges);
    }
  }

  return mergedChanges;
}
