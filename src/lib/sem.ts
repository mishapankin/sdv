import "server-only";

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

import {
  getGitDiffArgs,
  getSemDiffArgs,
  type ResolvedComparison,
} from "@/lib/git-arguments";
import { resolveCommit } from "@/lib/git-ref";
import {
  addGitDiffSummaries,
  countTextLines,
  parseGitNumstat,
} from "@/lib/git-stats";
import {
  type Comparison,
  type FileOnlyChange,
  semDiffSchema,
  type FileDiffResult,
  type GitCommitsResult,
  type SemanticDiffResult,
} from "@/lib/sem-types";
import { getProcessError } from "@/lib/process-error";
import { readWorkingTreeFile } from "@/lib/working-tree-file";
import { resolveRepositoryDirectory } from "@/lib/workspace";

const execFileAsync = promisify(execFile);

type CommandOutput = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<CommandOutput>;

async function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandOutput> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  return { stdout, stderr };
}

function reportError(message: string) {
  console.error(`sdv: ${message}`);
}

function getContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function resolveComparison(
  comparison: Comparison,
  cwd: string,
  execute: CommandRunner = run,
): Promise<ResolvedComparison> {
  if (comparison.mode === "staged") {
    return comparison;
  }

  if (comparison.mode === "changed") {
    try {
      return {
        mode: "changed",
        base: await resolveCommit(execute, cwd, "HEAD"),
      };
    } catch {
      throw new Error(
        "Changed comparison requires a repository with at least one commit",
      );
    }
  }

  const [from, to] = await Promise.all([
    resolveCommit(execute, cwd, comparison.from),
    resolveCommit(execute, cwd, comparison.to),
  ]);

  return { mode: "commits", from, to };
}

async function readUntrackedFiles(
  cwd: string,
  execute: CommandRunner = run,
) {
  const { stdout } = await execute(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    cwd,
  );

  return stdout.split("\0").filter(Boolean);
}

async function readUntrackedFileData(
  cwd: string,
  execute: CommandRunner = run,
): Promise<{
  changes: FileOnlyChange[];
  summary: { fileCount: number; additions: number; deletions: number };
}> {
  const files = await readUntrackedFiles(cwd, execute);
  const contents = await Promise.all(
    files.map((filePath) =>
      readWorkingTreeFile(cwd, filePath).catch(() => ({
        content: "",
        binary: true,
      })),
    ),
  );

  return {
    changes: files.map((filePath) => ({
      changeType: "untracked" as const,
      filePath,
      oldFilePath: null,
      fileStatus: "added" as const,
    })),
    summary: {
      fileCount: files.length,
      additions: contents.reduce(
        (total, file) =>
          total + (file.binary ? 0 : countTextLines(file.content)),
        0,
      ),
      deletions: 0,
    },
  };
}

async function readGitDiffSummary(
  comparison: ResolvedComparison,
  cwd: string,
  execute: CommandRunner = run,
) {
  const [, ...comparisonArgs] = getGitDiffArgs(comparison);
  const { stdout } = await execute(
    "git",
    [
      "diff",
      "--numstat",
      "-z",
      "--find-renames",
      "--no-ext-diff",
      "--no-textconv",
      ...comparisonArgs,
    ],
    cwd,
  );

  return parseGitNumstat(stdout);
}

type GitChangedFile = {
  filePath: string;
  oldFilePath: string;
  status: string;
};

function getFileStatusFromGitStatus(
  status: string,
): FileOnlyChange["fileStatus"] {
  if (status === "A" || status === "C") return "added";
  if (status === "D") return "deleted";
  if (status === "R") return "renamed";
  return "modified";
}

function getTrackedFileChanges(files: GitChangedFile[]): FileOnlyChange[] {
  return files.map((file) => ({
    changeType: "tracked",
    filePath: file.filePath,
    oldFilePath: file.oldFilePath,
    fileStatus: getFileStatusFromGitStatus(file.status),
  }));
}

function parseGitNameStatus(stdout: string): GitChangedFile[] {
  const fields = stdout.split("\0").filter(Boolean);
  const files: GitChangedFile[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index];

    if (!status) continue;

    if (status.startsWith("R") || status.startsWith("C")) {
      const oldFilePath = fields[index + 1];
      const filePath = fields[index + 2];

      if (oldFilePath && filePath) {
        files.push({ filePath, oldFilePath, status: status[0] });
      }

      index += 2;
      continue;
    }

    const filePath = fields[index + 1];

    if (filePath) {
      files.push({ filePath, oldFilePath: filePath, status: status[0] });
    }

    index += 1;
  }

  return files;
}

async function readChangedFiles(
  diffArgs: string[],
  cwd: string,
  execute: CommandRunner = run,
): Promise<GitChangedFile[]> {
  const { stdout } = await execute(
    "git",
    [...diffArgs, "--name-status", "-z", "--find-renames"],
    cwd,
  );

  return parseGitNameStatus(stdout);
}

async function readGitBlob(
  cwd: string,
  ref: string,
  filePath: string,
  execute: CommandRunner = run,
) {
  const { stdout } = await execute(
    "git",
    ["show", `${ref}:${filePath}`],
    cwd,
  );

  return stdout;
}

async function readIndexFile(
  cwd: string,
  filePath: string,
  execute: CommandRunner = run,
) {
  return readGitBlob(cwd, "", filePath, execute);
}

async function isBinaryChange(
  diffArgs: string[],
  cwd: string,
  filePath: string,
  execute: CommandRunner = run,
) {
  const { stdout } = await execute(
    "git",
    [
      ...diffArgs,
      "--numstat",
      "--no-ext-diff",
      "--no-textconv",
      "--",
      filePath,
    ],
    cwd,
  );

  return stdout.split("\n").some((line) => line.startsWith("-\t-\t"));
}

export async function readSemanticDiff(
  comparison: Comparison,
  repoId?: string,
): Promise<SemanticDiffResult> {
  try {
    const cwd = await resolveRepositoryDirectory(repoId);
    return await readSemanticDiffFromRepository(comparison, cwd);
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);

    return {
      ok: false,
      error: message,
    };
  }
}

export async function readSemanticDiffFromRepository(
  comparison: Comparison,
  cwd: string,
  execute: CommandRunner = run,
): Promise<SemanticDiffResult> {
  try {
    const resolvedComparison = await resolveComparison(
      comparison,
      cwd,
      execute,
    );
    const shouldIncludeUntracked = resolvedComparison.mode === "changed";
    const [
      { stdout },
      branchResult,
      rootResult,
      trackedNumstat,
      trackedFiles,
      untrackedData,
    ] = await Promise.all([
      execute("sem", getSemDiffArgs(resolvedComparison), cwd),
      execute("git", ["branch", "--show-current"], cwd),
      execute("git", ["rev-parse", "--show-toplevel"], cwd),
      readGitDiffSummary(resolvedComparison, cwd, execute),
      readChangedFiles(getGitDiffArgs(resolvedComparison), cwd, execute),
      shouldIncludeUntracked
        ? readUntrackedFileData(cwd, execute)
        : Promise.resolve({
            changes: [],
            summary: { fileCount: 0, additions: 0, deletions: 0 },
          }),
    ]);
    let json: unknown;

    try {
      json = JSON.parse(stdout);
    } catch (error) {
      const message = `sem returned invalid JSON: ${getProcessError(error)}`;
      reportError(message);
      return { ok: false, error: message };
    }

    const parsed = semDiffSchema.safeParse(json);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const location = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
      const message = `sem returned unexpected JSON${location}: ${issue?.message ?? "validation failed"}`;
      reportError(message);

      return {
        ok: false,
        error: message,
      };
    }

    const binaryFilePaths = new Set(
      parsed.data.binaryChanges.map((change) => change.filePath),
    );
    const trackedFileChanges = getTrackedFileChanges(trackedFiles).map(
      (change): FileOnlyChange =>
        binaryFilePaths.has(change.filePath)
          ? { ...change, changeType: "binary" }
          : change,
    );

    return {
      ok: true,
      data: {
        ...parsed.data,
        fileChanges: [
          ...trackedFileChanges,
          ...untrackedData.changes,
        ],
        gitSummary: addGitDiffSummaries(
          {
            ...trackedNumstat,
            fileCount: trackedFiles.length,
          },
          untrackedData.summary,
        ),
        repositoryName: path.basename(rootResult.stdout.trim()),
        branchName: branchResult.stdout.trim() || "detached HEAD",
        refreshedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);

    return {
      ok: false,
      error: message,
    };
  }
}

export async function readFileDiff(
  filePath: string,
  comparison: Comparison,
  repoId?: string,
): Promise<FileDiffResult> {
  try {
    const cwd = await resolveRepositoryDirectory(repoId);
    return await readFileDiffFromRepository(filePath, comparison, cwd);
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);
    return { ok: false, error: message };
  }
}

export async function readFileDiffFromRepository(
  filePath: string,
  comparison: Comparison,
  cwd: string,
  execute: CommandRunner = run,
): Promise<FileDiffResult> {
  try {
    const resolvedComparison = await resolveComparison(
      comparison,
      cwd,
      execute,
    );
    const diffArgs = getGitDiffArgs(resolvedComparison);
    const [changedFileRecords, untrackedFiles] = await Promise.all([
      readChangedFiles(diffArgs, cwd, execute),
      resolvedComparison.mode === "changed"
        ? readUntrackedFiles(cwd, execute)
        : Promise.resolve([]),
    ]);
    const changedFiles = new Map(
      changedFileRecords.map((file) => [file.filePath, file]),
    );
    const untrackedFileSet = new Set(untrackedFiles);

    if (untrackedFileSet.has(filePath)) {
      const workingTreeFile = await readWorkingTreeFile(cwd, filePath);

      if (workingTreeFile.binary) {
        return {
          ok: true,
          data: {
            kind: "binary",
            filePath,
            oldFilePath: filePath,
            cacheKey: `untracked-binary:${filePath}`,
          },
        };
      }

      return {
        ok: true,
        data: {
          kind: "text",
          filePath,
          oldFilePath: filePath,
          oldContent: "",
          newContent: workingTreeFile.content,
          cacheKey: `untracked:${filePath}:${getContentHash(workingTreeFile.content)}`,
        },
      };
    }

    const changedFile = changedFiles.get(filePath);

    if (!changedFile) {
      const message = `file is not part of the selected comparison: ${filePath}`;
      reportError(message);
      return { ok: false, error: message };
    }

    const { oldFilePath, status } = changedFile;

    if (await isBinaryChange(diffArgs, cwd, filePath, execute)) {
      return {
        ok: true,
        data: {
          kind: "binary",
          filePath,
          oldFilePath,
          cacheKey: `${comparison.mode}:binary:${oldFilePath}:${filePath}`,
        },
      };
    }

    const oldRef =
      resolvedComparison.mode === "changed"
        ? resolvedComparison.base
        : resolvedComparison.mode === "commits"
          ? resolvedComparison.from
          : "HEAD";
    const oldContent =
      status === "A"
        ? ""
        : await readGitBlob(cwd, oldRef, oldFilePath, execute);
    const newContent =
      status === "D"
        ? ""
        : resolvedComparison.mode === "changed"
          ? await readWorkingTreeFile(cwd, filePath)
          : resolvedComparison.mode === "staged"
            ? await readIndexFile(cwd, filePath, execute)
            : await readGitBlob(
                cwd,
                resolvedComparison.to,
                filePath,
                execute,
              );
    const newTextContent =
      typeof newContent === "string" ? newContent : newContent.content;

    return {
      ok: true,
      data: {
        kind: "text",
        filePath,
        oldFilePath,
        oldContent,
        newContent: newTextContent,
        cacheKey: `${comparison.mode}:${oldFilePath}:${filePath}:${getContentHash(oldContent)}:${getContentHash(newTextContent)}`,
      },
    };
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);
    return { ok: false, error: message };
  }
}

export async function readRecentCommits(
  repoId?: string,
): Promise<GitCommitsResult> {
  try {
    const cwd = await resolveRepositoryDirectory(repoId);
    const { stdout } = await run(
      "git",
      [
        "log",
        "--all",
        "-n",
        "100",
        "--date=relative",
        "--format=%H%x1f%h%x1f%s%x1f%ar%x1f%D%x1e",
      ],
      cwd,
    );
    const commits = stdout
      .split("\x1e")
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, shortHash, subject, relativeDate, refs] =
          record.split("\x1f");

        return {
          hash: hash ?? "",
          shortHash: shortHash ?? "",
          subject: subject ?? "",
          relativeDate: relativeDate ?? "",
          refs: refs ?? "",
        };
      });

    return { ok: true, data: commits };
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);
    return { ok: false, error: message };
  }
}
