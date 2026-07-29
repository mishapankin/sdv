import { describe, expect, it } from "vitest";

import {
  createExecutableEnvironment,
  preflightWorkspace,
} from "./preflight.mjs";

function createExecutor(results) {
  const calls = [];
  const execute = (command, args, options) => {
    calls.push({ command, args, options });
    return results.shift();
  };

  return { calls, execute };
}

describe("createExecutableEnvironment", () => {
  it("adds common desktop executable locations without duplicates", () => {
    const environment = createExecutableEnvironment(
      { PATH: "/custom/bin:/usr/bin" },
      "darwin",
    );

    expect(environment.PATH).toBe(
      "/custom/bin:/usr/bin:/opt/homebrew/bin:/usr/local/bin:/bin",
    );
  });
});

describe("preflightWorkspace", () => {
  it("reports a missing sem executable before checking Git", () => {
    const { calls, execute } = createExecutor([
      { error: { code: "ENOENT" }, status: null, stderr: "" },
    ]);

    expect(
      preflightWorkspace("/tmp/example", { execute, platform: "linux" }),
    ).toEqual({
      ok: false,
      code: "missing-sem",
      error: "sdv: sem is missing from PATH",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("sem");
  });

  it("returns a normalized workspace and environment for a Git worktree", () => {
    const { calls, execute } = createExecutor([
      { status: 0, stdout: "sem 1.0\n", stderr: "" },
      { status: 0, stdout: "git version 2.0\n", stderr: "" },
      { status: 0, stdout: "true\n", stderr: "" },
    ]);

    const result = preflightWorkspace("/tmp/example/..", {
      environment: { PATH: "/custom/bin" },
      execute,
      platform: "linux",
    });

    expect(result).toMatchObject({
      ok: true,
      directory: "/tmp",
      environment: {
        PATH: "/custom/bin:/usr/local/bin:/usr/bin:/bin",
      },
    });
    expect(calls.map(({ command }) => command)).toEqual(["sem", "git", "git"]);
    expect(calls[2].args).toEqual([
      "rev-parse",
      "--is-inside-work-tree",
    ]);
  });

  it("rejects a directory outside a Git worktree", () => {
    const { execute } = createExecutor([
      { status: 0, stdout: "sem 1.0\n", stderr: "" },
      { status: 0, stdout: "git version 2.0\n", stderr: "" },
      { status: 128, stdout: "", stderr: "not a repository" },
    ]);

    expect(
      preflightWorkspace("/tmp/example", { execute, platform: "linux" }),
    ).toMatchObject({
      ok: false,
      code: "invalid-repository",
    });
  });
});
