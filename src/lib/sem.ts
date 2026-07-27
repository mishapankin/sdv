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

async function run(command: string, args: string[], cwd: string) {
  return execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

type ExecFileError = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
};

function isExecFileError(error: unknown): error is ExecFileError {
  return typeof error === "object" && error !== null;
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
): Promise<ResolvedComparison> {
  if (comparison.mode === "staged") {
    return comparison;
  }

  if (comparison.mode === "changed") {
    try {
      return { mode: "changed", base: await resolveCommit(run, cwd, "HEAD") };
    } catch {
      throw new Error(
        "Changed comparison requires a repository with at least one commit",
      );
    }
  }

  const [from, to] = await Promise.all([
    resolveCommit(run, cwd, comparison.from),
    resolveCommit(run, cwd, comparison.to),
  ]);

  return { mode: "commits", from, to };
}

async function readUntrackedFiles(cwd: string) {
  const { stdout } = await run(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    cwd,
  );

  return stdout.split("\0").filter(Boolean);
}

async function readUntrackedFileChanges(cwd: string): Promise<FileOnlyChange[]> {
  const files = await readUntrackedFiles(cwd);

  return files.map((filePath) => ({
    changeType: "untracked" as const,
    filePath,
    oldFilePath: null,
    fileStatus: "added" as const,
  }));
}

type GitChangedFile = {
  filePath: string;
  oldFilePath: string;
};

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
        files.push({ filePath, oldFilePath });
      }

      index += 2;
      continue;
    }

    const filePath = fields[index + 1];

    if (filePath) {
      files.push({ filePath, oldFilePath: filePath });
    }

    index += 1;
  }

  return files;
}

async function readChangedFiles(
  diffArgs: string[],
  cwd: string,
): Promise<GitChangedFile[]> {
  const { stdout } = await run(
    "git",
    [...diffArgs, "--name-status", "-z", "--find-renames"],
    cwd,
  );

  return parseGitNameStatus(stdout);
}

async function readGitBlob(cwd: string, ref: string, filePath: string) {
  try {
    const { stdout } = await run("git", ["show", `${ref}:${filePath}`], cwd);

    return stdout;
  } catch (error) {
    if (isExecFileError(error)) {
      return "";
    }

    throw error;
  }
}

async function readIndexFile(cwd: string, filePath: string) {
  return readGitBlob(cwd, "", filePath);
}

async function isBinaryChange(
  diffArgs: string[],
  cwd: string,
  filePath: string,
) {
  const { stdout } = await run(
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
    const resolvedComparison = await resolveComparison(comparison, cwd);
    const shouldIncludeUntracked = resolvedComparison.mode === "changed";
    const [{ stdout }, branchResult, rootResult, untrackedChanges] =
      await Promise.all([
        run("sem", getSemDiffArgs(resolvedComparison), cwd),
        run("git", ["branch", "--show-current"], cwd),
        run("git", ["rev-parse", "--show-toplevel"], cwd),
        shouldIncludeUntracked
          ? readUntrackedFileChanges(cwd)
          : Promise.resolve([]),
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

    return {
      ok: true,
      data: {
        ...parsed.data,
        fileChanges: [
          ...parsed.data.fileChanges,
          ...parsed.data.binaryChanges,
          ...untrackedChanges,
        ],
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
    const resolvedComparison = await resolveComparison(comparison, cwd);
    const diffArgs = getGitDiffArgs(resolvedComparison);
    const [changedFileRecords, untrackedFiles] = await Promise.all([
      readChangedFiles(diffArgs, cwd),
      resolvedComparison.mode === "changed"
        ? readUntrackedFiles(cwd)
        : Promise.resolve([]),
    ]);
    const changedFiles = new Map(
      changedFileRecords.map((file) => [file.filePath, file.oldFilePath]),
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

    const oldFilePath = changedFiles.get(filePath);

    if (!oldFilePath) {
      const message = `file is not part of the selected comparison: ${filePath}`;
      reportError(message);
      return { ok: false, error: message };
    }

    if (await isBinaryChange(diffArgs, cwd, filePath)) {
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

    const [oldContent, newContent] =
      resolvedComparison.mode === "changed"
        ? await Promise.all([
            readGitBlob(cwd, resolvedComparison.base, oldFilePath),
            readWorkingTreeFile(cwd, filePath),
          ])
        : resolvedComparison.mode === "staged"
          ? await Promise.all([
              readGitBlob(cwd, "HEAD", oldFilePath),
              readIndexFile(cwd, filePath),
            ])
          : await Promise.all([
              readGitBlob(cwd, resolvedComparison.from, oldFilePath),
              readGitBlob(cwd, resolvedComparison.to, filePath),
            ]);
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
