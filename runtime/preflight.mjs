import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const DESKTOP_PATHS = {
  darwin: ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"],
  linux: ["/usr/local/bin", "/usr/bin", "/bin"],
};

export function createExecutableEnvironment(
  environment = process.env,
  platform = process.platform,
) {
  const separator = platform === "win32" ? ";" : ":";
  const existingPaths = (environment.PATH || "")
    .split(separator)
    .filter(Boolean);
  const paths = [
    ...existingPaths,
    ...(DESKTOP_PATHS[platform] || []),
  ].filter((entry, index, entries) => entries.indexOf(entry) === index);

  return {
    ...environment,
    PATH: paths.join(separator),
  };
}

function runVersionCheck(command, directory, environment, execute) {
  return execute(command, ["--version"], {
    cwd: directory,
    encoding: "utf8",
    env: environment,
  });
}

export function preflightWorkspace(
  directory,
  {
    environment = process.env,
    execute = spawnSync,
    platform = process.platform,
  } = {},
) {
  const workspaceDirectory = path.resolve(directory);

  try {
    if (!statSync(workspaceDirectory).isDirectory()) {
      throw new Error("not a directory");
    }
  } catch {
    return {
      ok: false,
      code: "invalid-directory",
      error: "sdv: selected directory does not exist or is not a directory",
    };
  }

  const executableEnvironment = createExecutableEnvironment(
    environment,
    platform,
  );
  const gitCheck = runVersionCheck(
    "git",
    workspaceDirectory,
    executableEnvironment,
    execute,
  );

  if (gitCheck.status !== 0) {
    return {
      ok: false,
      code: "git-failed",
      error: (gitCheck.stderr || "sdv: unable to run git").trim(),
    };
  }

  const repositoryCheck = execute(
    "git",
    ["rev-parse", "--is-inside-work-tree"],
    {
      cwd: workspaceDirectory,
      encoding: "utf8",
      env: executableEnvironment,
    },
  );

  if (
    repositoryCheck.status !== 0 ||
    repositoryCheck.stdout.trim() !== "true"
  ) {
    return {
      ok: false,
      code: "invalid-repository",
      error: "sdv: selected directory is not a Git worktree",
    };
  }

  return {
    ok: true,
    directory: workspaceDirectory,
    environment: executableEnvironment,
  };
}
