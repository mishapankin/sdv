import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  semDiffSchema,
  type FileDiffResult,
  type SemanticDiffResult,
} from "@/lib/sem-types";

const execFileAsync = promisify(execFile);

function getRepositoryDirectory() {
  return process.env.SDV_REPO_CWD || process.cwd();
}

async function run(command: string, args: string[], cwd: string) {
  return execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
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

function reportError(message: string) {
  console.error(`sdv: ${message}`);
}

export async function readSemanticDiff(): Promise<SemanticDiffResult> {
  const cwd = getRepositoryDirectory();

  try {
    const [{ stdout }, branchResult, rootResult] = await Promise.all([
      run("sem", ["diff", "--verbose", "--format", "json"], cwd),
      run("git", ["branch", "--show-current"], cwd),
      run("git", ["rev-parse", "--show-toplevel"], cwd),
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

export async function readFileDiff(filePath: string): Promise<FileDiffResult> {
  const cwd = getRepositoryDirectory();

  try {
    const { stdout: changedFilesOutput } = await run(
      "git",
      ["diff", "--name-only", "-z"],
      cwd,
    );
    const changedFiles = new Set(
      changedFilesOutput.split("\0").filter(Boolean),
    );

    if (!changedFiles.has(filePath)) {
      const message = `file is not an unstaged tracked change: ${filePath}`;
      reportError(message);
      return { ok: false, error: message };
    }

    const { stdout: patch } = await run(
      "git",
      [
        "diff",
        "--no-ext-diff",
        "--no-color",
        "--find-renames",
        "--",
        filePath,
      ],
      cwd,
    );

    if (!patch.trim()) {
      const message = `git returned no unstaged diff for: ${filePath}`;
      reportError(message);
      return { ok: false, error: message };
    }

    return {
      ok: true,
      data: {
        filePath,
        patch,
      },
    };
  } catch (error) {
    const message = getProcessError(error);
    reportError(message);
    return { ok: false, error: message };
  }
}
