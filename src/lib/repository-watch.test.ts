import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { subscribeToRepositoryChanges } from "@/lib/repository-watch";

const execFileAsync = promisify(execFile);
const originalWorkspace = process.env.SDV_WORKSPACE_CWD;
const originalSearchDepth = process.env.SDV_SEARCH_DEPTH;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  if (originalWorkspace === undefined) {
    delete process.env.SDV_WORKSPACE_CWD;
  } else {
    process.env.SDV_WORKSPACE_CWD = originalWorkspace;
  }
  if (originalSearchDepth === undefined) {
    delete process.env.SDV_SEARCH_DEPTH;
  } else {
    process.env.SDV_SEARCH_DEPTH = originalSearchDepth;
  }
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("repository watcher", () => {
  it("emits a debounced change after a working-tree file is written", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdv-watch-"));
    temporaryDirectories.push(directory);
    await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
    process.env.SDV_WORKSPACE_CWD = directory;
    process.env.SDV_SEARCH_DEPTH = "0";

    let resolveChange: (() => void) | undefined;
    const changed = new Promise<void>((resolve) => {
      resolveChange = resolve;
    });
    const unsubscribe = await subscribeToRepositoryChanges(undefined, (event) => {
      if (event.type === "change") resolveChange?.();
    });

    try {
      await writeFile(path.join(directory, "example.ts"), "export {}\n");
      await expect(
        Promise.race([
          changed,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("watch event timed out")), 3_000),
          ),
        ]),
      ).resolves.toBeUndefined();
    } finally {
      await unsubscribe();
    }
  });

  it("does not watch directories Git reports as ignored", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdv-watch-"));
    temporaryDirectories.push(directory);
    await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
    await writeFile(path.join(directory, ".gitignore"), "generated/\n");
    await mkdir(path.join(directory, "generated"));
    await writeFile(path.join(directory, "generated", "existing.js"), "old\n");
    process.env.SDV_WORKSPACE_CWD = directory;
    process.env.SDV_SEARCH_DEPTH = "0";

    let changeCount = 0;
    const unsubscribe = await subscribeToRepositoryChanges(undefined, (event) => {
      if (event.type === "change") changeCount += 1;
    });

    try {
      await writeFile(path.join(directory, "generated", "existing.js"), "new\n");
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(changeCount).toBe(0);
    } finally {
      await unsubscribe();
    }
  });
});
