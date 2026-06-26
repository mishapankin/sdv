import "server-only";

import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  WorkspaceRepositoriesResult,
  WorkspaceRepository,
} from "@/lib/sem-types";

const execFileAsync = promisify(execFile);

async function run(command: string, args: string[], cwd: string) {
  return execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
}

function getProcessError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string" &&
    error.stderr.trim()
  ) {
    return error.stderr.trim();
  }

  return error instanceof Error ? error.message : "Unknown process error";
}

function getWorkspaceDirectory() {
  return process.env.SDV_WORKSPACE_CWD || process.env.SDV_REPO_CWD || process.cwd();
}

function getSearchDepth() {
  const value = process.env.SDV_SEARCH_DEPTH;

  if (!value || value === "unlimited") {
    return Number.POSITIVE_INFINITY;
  }

  const depth = Number.parseInt(value, 10);

  return Number.isInteger(depth) && depth >= 0
    ? depth
    : Number.POSITIVE_INFINITY;
}

async function isGitRepository(directory: string) {
  try {
    const { stdout } = await run(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      directory,
    );

    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

function getChangedFilePath(statusLine: string) {
  const pathPart = statusLine.slice(3);
  const renamedPath = pathPart.split(" -> ").at(-1);
  return renamedPath || pathPart;
}

function parseChangedFileCount(statusOutput: string) {
  const files = new Set<string>();

  for (const line of statusOutput.split("\n")) {
    if (!line.trim()) continue;
    files.add(getChangedFilePath(line));
  }

  return files.size;
}

async function readRepositoryStatus(
  id: string,
  directory: string,
  relativePath: string,
): Promise<WorkspaceRepository> {
  const name = path.basename(directory);

  try {
    const [branchResult, statusResult] = await Promise.all([
      run("git", ["branch", "--show-current"], directory),
      run("git", ["status", "--porcelain=v1"], directory),
    ]);
    const changedFileCount = parseChangedFileCount(statusResult.stdout);

    return {
      id,
      name,
      relativePath,
      branchName: branchResult.stdout.trim() || "detached HEAD",
      hasChanges: changedFileCount > 0,
      changedFileCount,
    };
  } catch (error) {
    return {
      id,
      name,
      relativePath,
      branchName: "unknown",
      hasChanges: false,
      changedFileCount: 0,
      error: getProcessError(error),
    };
  }
}

async function readChildDirectories(directory: string) {
  const entries = await readdir(/* turbopackIgnore: true */ directory, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(/* turbopackIgnore: true */ directory, entry.name));
}

async function discoverRepositoryCandidates() {
  const workspaceDirectory = getWorkspaceDirectory();
  const maxDepth = getSearchDepth();
  const candidates: Array<{
    id: string;
    directory: string;
    relativePath: string;
  }> = [];

  async function visit(directory: string, depth: number) {
    if (await isGitRepository(directory)) {
      const relativePath = path.relative(workspaceDirectory, directory) || ".";

      candidates.push({
        id: relativePath,
        directory,
        relativePath,
      });
      return;
    }

    if (depth >= maxDepth) {
      return;
    }

    let childDirectories: string[];

    try {
      childDirectories = await readChildDirectories(directory);
    } catch {
      return;
    }

    for (const childDirectory of childDirectories) {
      await visit(childDirectory, depth + 1);
    }
  }

  await visit(workspaceDirectory, 0);

  return candidates;
}

function sortRepositories(
  left: WorkspaceRepository,
  right: WorkspaceRepository,
) {
  if (left.hasChanges !== right.hasChanges) {
    return left.hasChanges ? -1 : 1;
  }

  if (left.changedFileCount !== right.changedFileCount) {
    return right.changedFileCount - left.changedFileCount;
  }

  return left.name.localeCompare(right.name);
}

export async function readWorkspaceRepositories(): Promise<WorkspaceRepositoriesResult> {
  const workspaceDirectory = getWorkspaceDirectory();

  try {
    const candidates = await discoverRepositoryCandidates();
    const repositories = (
      await Promise.all(
        candidates.map((candidate) =>
          readRepositoryStatus(
            candidate.id,
            candidate.directory,
            candidate.relativePath,
          ),
        ),
      )
    ).sort(sortRepositories);

    return {
      ok: true,
      data: {
        workspaceName: path.basename(workspaceDirectory),
        repositories,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getProcessError(error),
    };
  }
}

export async function resolveRepositoryDirectory(repoId: string | undefined) {
  const repositories = await discoverRepositoryCandidates();
  const selectedId = repoId || repositories[0]?.id;
  const repository = repositories.find((candidate) => candidate.id === selectedId);

  if (!repository) {
    throw new Error("selected repository is not available");
  }

  return repository.directory;
}
