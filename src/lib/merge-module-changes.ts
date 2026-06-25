import type { SemanticChange } from "@/lib/sem-types";

const MODULE_ENTITY_TYPES = new Set([
  "chunk",
  "orphan",
  "module",
  "module-level",
]);
const MAX_LINE_GAP = 3;
const CLUSTER_LINE_GAP = 6;
const TOP_OF_FILE_MAX_START = 25;

type ChangeCluster = {
  changes: SemanticChange[];
  oldRange: { start: number; end: number };
  newRange: { start: number; end: number };
};

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

function rangesOverlapOrTouch(
  left: { start: number; end: number },
  right: { start: number; end: number },
  gap: number,
) {
  return left.start <= right.end + gap && right.start <= left.end + gap;
}

function isTopOfFileCluster(cluster: ChangeCluster) {
  return (
    cluster.oldRange.start <= TOP_OF_FILE_MAX_START ||
    cluster.newRange.start <= TOP_OF_FILE_MAX_START
  );
}

function mergeStructuralChange(changes: SemanticChange[]) {
  if (changes.some((change) => change.structuralChange === true)) {
    return true;
  }

  if (changes.every((change) => change.structuralChange === false)) {
    return false;
  }

  return null;
}

function combineContent(changes: SemanticChange[], side: "before" | "after") {
  return changes
    .map((change) =>
      side === "before"
        ? (change.beforeContent ?? "")
        : (change.afterContent ?? ""),
    )
    .filter((content) => content.length > 0)
    .join("\n");
}

function getClusterRange(
  changes: SemanticChange[],
  rangeGetter: (change: SemanticChange) => { start: number; end: number },
) {
  const ranges = changes.map(rangeGetter);

  return {
    start: Math.min(...ranges.map((range) => range.start)),
    end: Math.max(...ranges.map((range) => range.end)),
  };
}

function createCluster(changes: SemanticChange[]): ChangeCluster {
  return {
    changes,
    oldRange: getClusterRange(changes, getOldRange),
    newRange: getClusterRange(changes, getNewRange),
  };
}

function clusterChanges(
  changes: SemanticChange[],
  rangeGetter: (change: SemanticChange) => { start: number; end: number },
) {
  const sorted = [...changes].sort((left, right) => {
    const leftRange = rangeGetter(left);
    const rightRange = rangeGetter(right);

    return leftRange.start - rightRange.start;
  });
  const clusters: SemanticChange[][] = [];

  for (const change of sorted) {
    const currentRange = rangeGetter(change);
    const lastCluster = clusters.at(-1);

    if (!lastCluster) {
      clusters.push([change]);
      continue;
    }

    const lastRange = getClusterRange(lastCluster, rangeGetter);

    if (currentRange.start <= lastRange.end + CLUSTER_LINE_GAP) {
      lastCluster.push(change);
    } else {
      clusters.push([change]);
    }
  }

  return clusters.map(createCluster);
}

function clustersCanMerge(deleted: ChangeCluster, added: ChangeCluster) {
  if (isTopOfFileCluster(deleted) && isTopOfFileCluster(added)) {
    return true;
  }

  if (deleted.changes.length === 1 && added.changes.length === 1) {
    return rangesAreNearby(deleted.changes[0], added.changes[0]);
  }

  return rangesOverlapOrTouch(
    deleted.oldRange,
    added.newRange,
    MAX_LINE_GAP,
  );
}

function getClusterDistance(deleted: ChangeCluster, added: ChangeCluster) {
  if (isTopOfFileCluster(deleted) && isTopOfFileCluster(added)) {
    return 0;
  }

  return Math.abs(deleted.oldRange.start - added.newRange.start);
}

function mergeClusters(
  deleted: ChangeCluster,
  added: ChangeCluster,
): SemanticChange {
  const deletedChanges = deleted.changes;
  const addedChanges = added.changes;
  const allChanges = [...deletedChanges, ...addedChanges];
  const mergedEntityType = allChanges.every(
    (change) => change.entityType.toLowerCase() === "chunk",
  )
    ? "chunk"
    : "orphan";

  return {
    entityId: `${addedChanges[0].filePath}::module-level::merged::${allChanges
      .map((change) => change.entityId)
      .join("::")}`,
    entityName: mergedEntityType === "chunk" ? "chunk" : "module-level",
    entityType: mergedEntityType,
    changeType: "modified",
    filePath: addedChanges[0].filePath,
    oldFilePath: deletedChanges[0].oldFilePath ?? deletedChanges[0].filePath,
    oldEntityName: deletedChanges[0].entityName,
    oldStartLine: deleted.oldRange.start,
    oldEndLine: deleted.oldRange.end,
    startLine: added.newRange.start,
    endLine: added.newRange.end,
    beforeContent: combineContent(deletedChanges, "before"),
    afterContent: combineContent(addedChanges, "after"),
    structuralChange: mergeStructuralChange(allChanges),
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

    if (!deleted.length || !added.length) {
      mergedChanges.push(...fileChanges);
      continue;
    }

    const deletedClusters = clusterChanges(deleted, getOldRange);
    const addedClusters = clusterChanges(added, getNewRange);
    const usedAddedClusters = new Set<number>();
    const pairedIds = new Set<string>();
    const syntheticChanges: SemanticChange[] = [];

    for (const deletedCluster of deletedClusters) {
      let bestMatchIndex = -1;
      let bestMatchDistance = Number.POSITIVE_INFINITY;

      for (const [index, addedCluster] of addedClusters.entries()) {
        if (usedAddedClusters.has(index)) continue;
        if (!clustersCanMerge(deletedCluster, addedCluster)) continue;

        const distance = getClusterDistance(deletedCluster, addedCluster);

        if (distance < bestMatchDistance) {
          bestMatchIndex = index;
          bestMatchDistance = distance;
        }
      }

      if (bestMatchIndex === -1) continue;

      const addedCluster = addedClusters[bestMatchIndex];
      usedAddedClusters.add(bestMatchIndex);

      for (const change of [
        ...deletedCluster.changes,
        ...addedCluster.changes,
      ]) {
        pairedIds.add(change.entityId);
      }

      syntheticChanges.push(mergeClusters(deletedCluster, addedCluster));
    }

    mergedChanges.push(
      ...fileChanges.filter((change) => !pairedIds.has(change.entityId)),
      ...syntheticChanges,
    );
  }

  return mergedChanges;
}
