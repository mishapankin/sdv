import { lstat, open, readFile, readlink } from "node:fs/promises";
import path from "node:path";

const BINARY_SNIFF_BYTES = 8_000;
const MAX_TEXT_FILE_BYTES = 20 * 1024 * 1024;

export type WorkingTreeFile = {
  content: string;
  binary: boolean;
};

function resolveFilePath(cwd: string, filePath: string) {
  const absolutePath = path.resolve(cwd, filePath);
  const relativePath = path.relative(cwd, absolutePath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath === ""
  ) {
    throw new Error(`invalid file path: ${filePath}`);
  }

  return absolutePath;
}

export async function readWorkingTreeBuffer(
  cwd: string,
  filePath: string,
  maxBytes: number,
): Promise<Buffer | null> {
  const absolutePath = resolveFilePath(cwd, filePath);
  const fileStats = await lstat(absolutePath);

  if (!fileStats.isFile()) {
    throw new Error(`unsupported file type: ${filePath}`);
  }

  if (fileStats.size > maxBytes) {
    return null;
  }

  return readFile(absolutePath);
}

export async function readWorkingTreeFile(
  cwd: string,
  filePath: string,
): Promise<WorkingTreeFile> {
  const absolutePath = resolveFilePath(cwd, filePath);

  try {
    const fileStats = await lstat(absolutePath);

    if (fileStats.isSymbolicLink()) {
      return {
        content: await readlink(absolutePath),
        binary: false,
      };
    }

    if (!fileStats.isFile()) {
      throw new Error(`unsupported file type: ${filePath}`);
    }

    const fileHandle = await open(absolutePath, "r");
    const prefix = Buffer.alloc(
      Math.min(fileStats.size, BINARY_SNIFF_BYTES),
    );

    try {
      await fileHandle.read(prefix, 0, prefix.length, 0);
    } finally {
      await fileHandle.close();
    }

    if (prefix.includes(0)) {
      return { content: "", binary: true };
    }

    if (fileStats.size > MAX_TEXT_FILE_BYTES) {
      throw new Error(`text file exceeds 20 MiB limit: ${filePath}`);
    }

    const content = await readFile(absolutePath);

    return {
      content: content.toString("utf8"),
      binary: false,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { content: "", binary: false };
    }

    throw error;
  }
}
