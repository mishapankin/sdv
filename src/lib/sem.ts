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
  createImageSnapshot,
  hasPreviewableImageExtension,
  MAX_IMAGE_PREVIEW_BYTES,
} from "@/lib/image-preview";
import { readOptionalInspectAnalysis } from "@/lib/inspect";
import {
  type Comparison,
  type FileOnlyChange,
  type FileDiffResult,
  type GitCommitsResult,
  type GitCommit,
  type GitRefValidationResult,
  type ImageSnapshot,
  type SemDiff,
  semDiffSchema,
  type SemanticDiffResult,
} from "@/lib/sem-types";
import { getProcessError } from "@/lib/process-error";
import {
  readWorkingTreeBuffer,
  readWorkingTreeFile,
} from "@/lib/working-tree-file";
import { resolveRepositoryDirectory } from "@/lib/workspace";

const execFileAsync = promisify(execFile);

type CommandOutput = {
  stdout: string;
  stderr: string;
};

type BinaryCommandOutput = {
  stdout: Buffer;
  stderr: Buffer;
};

export type CommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<CommandOutput>;

type BinaryCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<BinaryCommandOutput>;

async function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandOutput> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: 20 * 1024 * 1024,
  });

  return { stdout, stderr };
}

async function runBinary(
  command: string,
  args: string[],
  cwd: string,
): Promise<BinaryCommandOutput> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    encoding: null,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: MAX_IMAGE_PREVIEW_BYTES + 1024,
  });

  return {
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr),
  };
}

function reportError(message: string) {
  console.error(`sdv: ${message}`);
}

function isMissingExecutable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

type OptionalSemDiff =
  | { available: true; data: SemDiff }
  | { available: false };

async function readOptionalSemDiff(
  comparison: ResolvedComparison,
  cwd: string,
  execute: CommandRunner,
): Promise<OptionalSemDiff> {
  try {
    const { stdout } = await execute(
      "sem",
      getSemDiffArgs(comparison),
      cwd,
    );
    let json: unknown;

    try {
      json = JSON.parse(stdout);
    } catch (error) {
      throw new Error(
        `sem returned invalid JSON: ${getProcessError(error)}`,
      );
    }

    const parsed = semDiffSchema.safeParse(json);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const location = issue?.path.length
        ? ` at ${issue.path.join(".")}`
        : "";

      throw new Error(
        `sem returned unexpected JSON${location}: ${issue?.message ?? "validation failed"}`,
      );
    }

    return { available: true, data: parsed.data };
  } catch (error) {
    if (!isMissingExecutable(error)) {
      reportError(getProcessError(error));
    }

    return { available: false };
  }
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

async function readGitImageSnapshot(
  cwd: string,
  ref: string,
  filePath: string,
  execute: CommandRunner,
  executeBinary: BinaryCommandRunner,
): Promise<ImageSnapshot | null> {
  const objectName = `${ref}:${filePath}`;
  const { stdout: sizeOutput } = await execute(
    "git",
    ["cat-file", "-s", objectName],
    cwd,
  );
  const byteSize = Number.parseInt(sizeOutput.trim(), 10);

  if (!Number.isSafeInteger(byteSize) || byteSize < 0) {
    throw new Error(`git returned an invalid blob size for ${filePath}`);
  }

  if (byteSize > MAX_IMAGE_PREVIEW_BYTES) {
    return null;
  }

  const { stdout } = await executeBinary(
    "git",
    ["show", objectName],
    cwd,
  );

  return createImageSnapshot(stdout);
}

async function readWorkingTreeImageSnapshot(
  cwd: string,
  filePath: string,
): Promise<ImageSnapshot | null> {
  const content = await readWorkingTreeBuffer(
    cwd,
    filePath,
    MAX_IMAGE_PREVIEW_BYTES,
  );

  return content ? createImageSnapshot(content) : null;
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
      semanticResult,
      branchResult,
      rootResult,
      trackedNumstat,
      trackedFiles,
      untrackedData,
    ] = await Promise.all([
      readOptionalSemDiff(resolvedComparison, cwd, execute),
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
    const semanticData = semanticResult.available
      ? semanticResult.data
      : {
          summary: {
            fileCount: 0,
            added: 0,
            modified: 0,
            deleted: 0,
            moved: 0,
            renamed: 0,
            reordered: 0,
            binary: 0,
            orphan: 0,
            total: 0,
          },
          changes: [],
          binaryChanges: [],
          fileChanges: [],
        };
    const inspectAnalysis = await readOptionalInspectAnalysis(
      resolvedComparison,
      semanticData.changes,
      cwd,
      execute,
    );

    if (inspectAnalysis.status === "failed") {
      reportError(`inspect: ${inspectAnalysis.error}`);
    }

    const binaryFilePaths = new Set(
      semanticData.binaryChanges.map((change) => change.filePath),
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
        ...semanticData,
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
        semanticAvailable: semanticResult.available,
        inspectAnalysis,
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
  executeBinary: BinaryCommandRunner = runBinary,
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
        if (hasPreviewableImageExtension(filePath)) {
          const after = await readWorkingTreeImageSnapshot(cwd, filePath);

          if (after) {
            return {
              ok: true,
              data: {
                kind: "image",
                filePath,
                oldFilePath: filePath,
                before: null,
                after,
                cacheKey: `untracked-image:${filePath}:${getContentHash(after.dataUrl)}`,
              },
            };
          }
        }

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
      if (
        hasPreviewableImageExtension(filePath) ||
        hasPreviewableImageExtension(oldFilePath)
      ) {
        const oldRef =
          resolvedComparison.mode === "changed"
            ? resolvedComparison.base
            : resolvedComparison.mode === "commits"
              ? resolvedComparison.from
              : "HEAD";
        const expectsBefore = status !== "A" && status !== "C";
        const expectsAfter = status !== "D";
        const [before, after] = await Promise.all([
          expectsBefore
            ? readGitImageSnapshot(
                cwd,
                oldRef,
                oldFilePath,
                execute,
                executeBinary,
              )
            : Promise.resolve(null),
          expectsAfter
            ? resolvedComparison.mode === "changed"
              ? readWorkingTreeImageSnapshot(cwd, filePath)
              : readGitImageSnapshot(
                  cwd,
                  resolvedComparison.mode === "commits"
                    ? resolvedComparison.to
                    : "",
                  filePath,
                  execute,
                  executeBinary,
                )
            : Promise.resolve(null),
        ]);

        if ((!expectsBefore || before) && (!expectsAfter || after)) {
          const imageHash = getContentHash(
            `${before?.dataUrl ?? ""}:${after?.dataUrl ?? ""}`,
          );

          return {
            ok: true,
            data: {
              kind: "image",
              filePath,
              oldFilePath,
              before,
              after,
              cacheKey: `${comparison.mode}:image:${oldFilePath}:${filePath}:${imageHash}`,
            },
          };
        }
      }

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
    return readRecentCommitsFromRepository(cwd);
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);
    return { ok: false, error: message };
  }
}

const COMMIT_LOG_FORMAT =
  "%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%ar%x1f%D%x1e";

function parseCommitLog(stdout: string): GitCommit[] {
  return stdout
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [
        hash,
        shortHash,
        subject,
        author,
        authoredAt,
        relativeDate,
        refs,
      ] = record.split("\x1f");

      return {
        hash: hash ?? "",
        shortHash: shortHash ?? "",
        subject: subject ?? "",
        author: author ?? "",
        authoredAt: authoredAt ?? "",
        relativeDate: relativeDate ?? "",
        refs: refs ?? "",
      };
    });
}

export async function readRecentCommitsFromRepository(
  cwd: string,
  execute: CommandRunner = run,
): Promise<GitCommitsResult> {
  try {
    const [current, repository] = await Promise.all([
      execute(
        "git",
        [
          "log",
          "HEAD",
          "-n",
          "200",
          "--date=relative",
          `--format=${COMMIT_LOG_FORMAT}`,
        ],
        cwd,
      ),
      execute(
        "git",
        [
          "log",
          "--branches",
          "--remotes",
          "--tags",
          "-n",
          "500",
          "--date=relative",
          `--format=${COMMIT_LOG_FORMAT}`,
        ],
        cwd,
      ),
    ]);
    const seen = new Set<string>();
    const commits = [
      ...parseCommitLog(current.stdout),
      ...parseCommitLog(repository.stdout),
    ].filter((commit) => {
      if (!commit.hash || seen.has(commit.hash)) return false;
      seen.add(commit.hash);
      return true;
    });

    return { ok: true, data: commits };
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);
    return { ok: false, error: message };
  }
}

export async function validateComparisonRefs(
  from: string,
  to: string,
  repoId?: string,
): Promise<GitRefValidationResult> {
  try {
    const cwd = await resolveRepositoryDirectory(repoId);
    return validateComparisonRefsInRepository(from, to, cwd);
  } catch (error) {
    return {
      ok: false,
      field: "from",
      error: getProcessError(error),
    };
  }
}

export async function validateComparisonRefsInRepository(
  from: string,
  to: string,
  cwd: string,
  execute: CommandRunner = run,
): Promise<GitRefValidationResult> {
  try {
    await resolveCommit(execute, cwd, from);
  } catch {
    return {
      ok: false,
      field: "from",
      error: `Base ref “${from}” does not resolve to a commit.`,
    };
  }

  try {
    await resolveCommit(execute, cwd, to);
  } catch {
    return {
      ok: false,
      field: "to",
      error: `Compare ref “${to}” does not resolve to a commit.`,
    };
  }

  return { ok: true };
}
