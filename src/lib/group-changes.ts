import type {
  ChangeType,
  FileOnlyChange,
  FileStatus,
  SemanticChange,
} from "@/lib/sem-types";

export type FileGroup = {
  filePath: string;
  oldFilePath: string | null;
  changeType: ChangeType;
  changes: SemanticChange[];
  fileChange?: FileOnlyChange;
};

export function groupByFile(
  changes: SemanticChange[],
  fileChanges: FileOnlyChange[] = [],
): FileGroup[] {
  const groups = new Map<
    string,
    { changes: SemanticChange[]; fileChange?: FileOnlyChange }
  >();

  for (const change of changes) {
    const current = groups.get(change.filePath) ?? { changes: [] };
    current.changes.push(change);
    groups.set(change.filePath, current);
  }

  for (const fileChange of fileChanges) {
    const current = groups.get(fileChange.filePath) ?? { changes: [] };
    current.fileChange = fileChange;
    groups.set(fileChange.filePath, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, group]) => ({
      filePath,
      oldFilePath:
        getFileOldPath(filePath, group.changes) ??
        group.fileChange?.oldFilePath ??
        null,
      changeType: getFileChangeType(
        filePath,
        group.changes,
        group.fileChange,
      ),
      changes: group.changes.sort((left, right) => {
        const leftLine = left.startLine ?? left.oldStartLine ?? 0;
        const rightLine = right.startLine ?? right.oldStartLine ?? 0;
        return leftLine - rightLine;
      }),
      fileChange: group.fileChange,
    }));
}

function getFileOldPath(filePath: string, changes: SemanticChange[]) {
  const oldPath = changes.find(
    (change) => change.oldFilePath && change.oldFilePath !== filePath,
  )?.oldFilePath;

  return oldPath ?? null;
}

function getFileChangeType(
  filePath: string,
  changes: SemanticChange[],
  fileChange?: FileOnlyChange,
): ChangeType {
  if (!changes.length && fileChange) {
    return getChangeTypeFromFileStatus(fileChange.fileStatus);
  }

  const changeTypes = new Set(changes.map((change) => change.changeType));

  if (changeTypes.size === 1) {
    const [changeType] = changeTypes;

    if (changeType === "added" || changeType === "deleted") {
      return changeType;
    }
  }

  if (
    changes.some(
      (change) => change.oldFilePath && change.oldFilePath !== filePath,
    )
  ) {
    return "renamed";
  }

  return "modified";
}

function getChangeTypeFromFileStatus(fileStatus: FileStatus): ChangeType {
  if (fileStatus === "added" || fileStatus === "deleted") {
    return fileStatus;
  }

  if (fileStatus === "renamed") {
    return "renamed";
  }

  return "modified";
}

export function hasFileInDiff(
  filePath: string,
  changes: SemanticChange[],
  fileChanges: FileOnlyChange[],
) {
  return (
    changes.some((change) => change.filePath === filePath) ||
    fileChanges.some((change) => change.filePath === filePath)
  );
}
