import type { FileGroup } from "@/lib/group-changes";

export type FileTreeFile = {
  type: "file";
  name: string;
  path: string;
  group: FileGroup;
};

export type FileTreeDirectory = {
  type: "directory";
  name: string;
  path: string;
  children: FileTreeNode[];
  fileCount: number;
};

export type FileTreeNode = FileTreeDirectory | FileTreeFile;

type MutableDirectory = {
  name: string;
  path: string;
  directories: Map<string, MutableDirectory>;
  files: FileTreeFile[];
};

function createDirectory(name: string, path: string): MutableDirectory {
  return {
    name,
    path,
    directories: new Map(),
    files: [],
  };
}

function compareNames(
  left: { name: string },
  right: { name: string },
) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function finalizeDirectory(directory: MutableDirectory): FileTreeNode[] {
  const directories = [...directory.directories.values()]
    .sort(compareNames)
    .map((child): FileTreeDirectory => {
      const children = finalizeDirectory(child);

      return {
        type: "directory",
        name: child.name,
        path: child.path,
        children,
        fileCount: children.reduce(
          (count, node) =>
            count + (node.type === "directory" ? node.fileCount : 1),
          0,
        ),
      };
    });
  const files = [...directory.files].sort(compareNames);

  return [...directories, ...files];
}

export function buildFileTree(fileGroups: FileGroup[]): FileTreeNode[] {
  const root = createDirectory("", "");

  for (const group of fileGroups) {
    const segments = group.filePath.split("/").filter(Boolean);
    const fileName = segments.pop() ?? group.filePath;
    let directory = root;

    for (const segment of segments) {
      const directoryPath = directory.path
        ? `${directory.path}/${segment}`
        : segment;
      let child = directory.directories.get(segment);

      if (!child) {
        child = createDirectory(segment, directoryPath);
        directory.directories.set(segment, child);
      }

      directory = child;
    }

    directory.files.push({
      type: "file",
      name: fileName,
      path: group.filePath,
      group,
    });
  }

  return finalizeDirectory(root);
}
