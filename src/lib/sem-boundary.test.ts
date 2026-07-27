import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  type CommandRunner,
  readSemanticDiffFromRepository,
} from "@/lib/sem";

const fixtureUrl = new URL("./fixtures/sem-0.7-verbose.json", import.meta.url);

function createRunner(semOutput: string): CommandRunner {
  return vi.fn(async (command, args) => {
    if (command === "sem") {
      return { stdout: semOutput, stderr: "" };
    }

    if (args[0] === "branch") {
      return { stdout: "main\n", stderr: "" };
    }

    if (args[0] === "rev-parse") {
      return { stdout: "/tmp/example\n", stderr: "" };
    }

    throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
  });
}

describe("sem process boundary", () => {
  it("accepts representative sem 0.7 verbose JSON change variants", async () => {
    const fixture = await readFile(fixtureUrl, "utf8");
    const runner = createRunner(fixture);
    const result = await readSemanticDiffFromRepository(
      { mode: "staged" },
      "/tmp/example",
      runner,
    );

    expect(result.ok).toBe(true);
    expect(runner).toHaveBeenCalledWith(
      "sem",
      ["diff", "--verbose", "--format", "json", "--staged"],
      "/tmp/example",
    );

    if (!result.ok) return;

    expect(result.data.changes.map((change) => change.changeType)).toEqual([
      "added",
      "modified",
      "deleted",
      "moved",
      "renamed",
      "reordered",
    ]);
    expect(result.data.binaryChanges).toEqual([]);
    expect(result.data.fileChanges).toEqual([]);
    expect(result.data.repositoryName).toBe("example");
    expect(result.data.branchName).toBe("main");
  });

  it("returns clear errors for invalid and unexpected sem JSON", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const invalid = await readSemanticDiffFromRepository(
        { mode: "staged" },
        "/tmp/example",
        createRunner("{not json"),
      );
      const unexpected = await readSemanticDiffFromRepository(
        { mode: "staged" },
        "/tmp/example",
        createRunner('{"summary":{},"changes":[]}'),
      );

      expect(invalid).toMatchObject({
        ok: false,
        error: expect.stringContaining("sem returned invalid JSON"),
      });
      expect(unexpected).toMatchObject({
        ok: false,
        error: expect.stringContaining("sem returned unexpected JSON"),
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("surfaces sem command failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const runner: CommandRunner = vi.fn(async (command) => {
      if (command === "sem") {
        throw { stderr: "sem: parser crashed\n" };
      }

      return { stdout: "", stderr: "" };
    });

    try {
      await expect(
        readSemanticDiffFromRepository(
          { mode: "staged" },
          "/tmp/example",
          runner,
        ),
      ).resolves.toEqual({
        ok: false,
        error: "sem: parser crashed",
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
