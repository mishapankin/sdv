import "server-only";

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  type Comparison,
  type FileOnlyChange,
  semDiffSchema,
  type FileDiffResult,
  type GitCommitsResult,
  type SemanticDiffResult,
} from "@/lib/sem-types";
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

function reportError(message: string) {
  console.error(`sdv: ${message}`);
}

function getContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function getSemDiffArgs(comparison: Comparison) {
  const args = ["diff", "--verbose", "--format", "json"];

  if (comparison.mode === "staged") {
    args.push("--staged");
  } else if (comparison.mode === "commits") {
    args.push("--from", comparison.from, "--to", comparison.to);
  }

  return args;
}

function getGitDiffArgs(comparison: Comparison) {
  if (comparison.mode === "staged") {
    return ["diff", "--cached"];
  }

  if (comparison.mode === "commits") {
    return ["diff", comparison.from, comparison.to];
  }

  return ["diff"];
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

async function readWorkingTreeFile(cwd: string, filePath: string) {
  const absolutePath = path.resolve(cwd, filePath);
  const relativePath = path.relative(cwd, absolutePath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath === ""
  ) {
    throw new Error(`invalid file path: ${filePath}`);
  }

  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "";
    }

    throw error;
  }
}

export async function readSemanticDiff(
  comparison: Comparison,
  repoId?: string,
): Promise<SemanticDiffResult> {
  try {
    const cwd = await resolveRepositoryDirectory(repoId);
    const shouldIncludeUntracked = comparison.mode === "unstaged";
    const [{ stdout }, branchResult, rootResult, untrackedChanges] =
      await Promise.all([
        run("sem", getSemDiffArgs(comparison), cwd),
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
  const diffArgs = getGitDiffArgs(comparison);

  try {
    const cwd = await resolveRepositoryDirectory(repoId);
    const [changedFileRecords, untrackedFiles] = await Promise.all([
      readChangedFiles(diffArgs, cwd),
      comparison.mode === "unstaged"
        ? readUntrackedFiles(cwd)
        : Promise.resolve([]),
    ]);
    const changedFiles = new Map(
      changedFileRecords.map((file) => [file.filePath, file.oldFilePath]),
    );
    const untrackedFileSet = new Set(untrackedFiles);

    if (untrackedFileSet.has(filePath)) {
      const newContent = await readWorkingTreeFile(cwd, filePath);

      if (!newContent) {
        const message = `untracked file is empty or unreadable: ${filePath}`;
        reportError(message);
        return { ok: false, error: message };
      }

      return {
        ok: true,
        data: {
          filePath,
          oldFilePath: filePath,
          oldContent: "",
          newContent,
          cacheKey: `untracked:${filePath}:${getContentHash(newContent)}`,
        },
      };
    }

    const oldFilePath = changedFiles.get(filePath);

    if (!oldFilePath) {
      const message = `file is not part of the selected comparison: ${filePath}`;
      reportError(message);
      return { ok: false, error: message };
    }

    const [oldContent, newContent] =
      comparison.mode === "unstaged"
        ? await Promise.all([
            readIndexFile(cwd, oldFilePath),
            readWorkingTreeFile(cwd, filePath),
          ])
        : comparison.mode === "staged"
          ? await Promise.all([
              readGitBlob(cwd, "HEAD", oldFilePath),
              readIndexFile(cwd, filePath),
            ])
          : await Promise.all([
              readGitBlob(cwd, comparison.from, oldFilePath),
              readGitBlob(cwd, comparison.to, filePath),
            ]);

    return {
      ok: true,
      data: {
        filePath,
        oldFilePath,
        oldContent,
        newContent,
        cacheKey: `${comparison.mode}:${oldFilePath}:${filePath}:${getContentHash(oldContent)}:${getContentHash(newContent)}`,
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
