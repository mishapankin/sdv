import { execFile } from "node:child_process";
import {
  mkdtemp,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileDiffFromRepository } from "@/lib/sem";

const execFileAsync = promisify(execFile);
const repositories: string[] = [];

async function git(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
  });

  return stdout.trim();
}

async function createRepository() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "sdv-file-diff-"));
  repositories.push(cwd);

  await git(cwd, ["init", "--quiet"]);
  await git(cwd, ["config", "user.email", "sdv@example.test"]);
  await git(cwd, ["config", "user.name", "SDV Tests"]);
  await writeFile(path.join(cwd, "deleted.txt"), "deleted before\n");
  await writeFile(path.join(cwd, "renamed-before.txt"), "rename contents\n");
  await writeFile(path.join(cwd, "binary.bin"), Buffer.from([1, 0, 2]));
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "--quiet", "-m", "base"]);

  return cwd;
}

afterEach(async () => {
  await Promise.all(
    repositories.splice(0).map((repository) =>
      rm(repository, { recursive: true, force: true }),
    ),
  );
});

describe("file diff repository integration", () => {
  it("loads deleted, renamed, untracked, and binary working-tree changes", async () => {
    const cwd = await createRepository();
    await unlink(path.join(cwd, "deleted.txt"));
    await rename(
      path.join(cwd, "renamed-before.txt"),
      path.join(cwd, "renamed-after.txt"),
    );
    await git(cwd, ["add", "renamed-before.txt", "renamed-after.txt"]);
    await writeFile(path.join(cwd, "untracked.txt"), "new file\n");
    await writeFile(path.join(cwd, "binary.bin"), Buffer.from([1, 0, 3]));

    const deleted = await readFileDiffFromRepository(
      "deleted.txt",
      { mode: "changed" },
      cwd,
    );
    const renamed = await readFileDiffFromRepository(
      "renamed-after.txt",
      { mode: "changed" },
      cwd,
    );
    const untracked = await readFileDiffFromRepository(
      "untracked.txt",
      { mode: "changed" },
      cwd,
    );
    const binary = await readFileDiffFromRepository(
      "binary.bin",
      { mode: "changed" },
      cwd,
    );

    expect(deleted).toMatchObject({
      ok: true,
      data: {
        kind: "text",
        oldContent: "deleted before\n",
        newContent: "",
      },
    });
    expect(renamed).toMatchObject({
      ok: true,
      data: {
        kind: "text",
        oldFilePath: "renamed-before.txt",
        oldContent: "rename contents\n",
        newContent: "rename contents\n",
      },
    });
    expect(untracked).toMatchObject({
      ok: true,
      data: {
        kind: "text",
        oldContent: "",
        newContent: "new file\n",
      },
    });
    expect(binary).toMatchObject({
      ok: true,
      data: { kind: "binary", filePath: "binary.bin" },
    });
  });

  it("loads staged additions and deletions from the index", async () => {
    const cwd = await createRepository();
    await unlink(path.join(cwd, "deleted.txt"));
    await writeFile(path.join(cwd, "added.txt"), "staged addition\n");
    await git(cwd, ["add", "-A"]);

    const deleted = await readFileDiffFromRepository(
      "deleted.txt",
      { mode: "staged" },
      cwd,
    );
    const added = await readFileDiffFromRepository(
      "added.txt",
      { mode: "staged" },
      cwd,
    );

    expect(deleted).toMatchObject({
      ok: true,
      data: {
        kind: "text",
        oldContent: "deleted before\n",
        newContent: "",
      },
    });
    expect(added).toMatchObject({
      ok: true,
      data: {
        kind: "text",
        oldContent: "",
        newContent: "staged addition\n",
      },
    });
  });

  it("loads deleted files between two commits", async () => {
    const cwd = await createRepository();
    const base = await git(cwd, ["rev-parse", "HEAD"]);
    await unlink(path.join(cwd, "deleted.txt"));
    await git(cwd, ["add", "-A"]);
    await git(cwd, ["commit", "--quiet", "-m", "delete"]);
    const head = await git(cwd, ["rev-parse", "HEAD"]);

    const result = await readFileDiffFromRepository(
      "deleted.txt",
      { mode: "commits", from: base, to: head },
      cwd,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        kind: "text",
        oldContent: "deleted before\n",
        newContent: "",
      },
    });
  });

  it("rejects files outside the selected comparison", async () => {
    const cwd = await createRepository();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await readFileDiffFromRepository(
        "missing.txt",
        { mode: "changed" },
        cwd,
      );

      expect(result).toEqual({
        ok: false,
        error: "file is not part of the selected comparison: missing.txt",
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
