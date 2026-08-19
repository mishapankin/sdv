import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DependencyName = "git" | "sem" | "inspect";

export type DependencyStatus = {
  name: DependencyName;
  available: boolean;
  version?: string;
};

export type VersionRunner = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

async function runVersion(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 64 * 1024,
  });

  return { stdout, stderr };
}

function firstLine(value: string) {
  return value.trim().split(/\r?\n/, 1)[0]?.slice(0, 160);
}

async function checkDependency(
  name: DependencyName,
  execute: VersionRunner,
): Promise<DependencyStatus> {
  try {
    const { stdout, stderr } = await execute(name, ["--version"]);
    const version = firstLine(stdout) || firstLine(stderr);

    return { name, available: true, ...(version ? { version } : {}) };
  } catch {
    try {
      await execute(name, ["--help"]);
      return { name, available: true };
    } catch {
      return { name, available: false };
    }
  }
}

export async function readDependencyStatuses(
  execute: VersionRunner = runVersion,
) {
  return Promise.all(
    (["git", "sem", "inspect"] as const).map((name) =>
      checkDependency(name, execute),
    ),
  );
}
