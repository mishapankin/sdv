import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readWorkingTreeFile } from "@/lib/working-tree-file";

describe("working-tree file reads", () => {
  it("accepts empty files", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "sdv-empty-"));
    await writeFile(path.join(cwd, "empty.txt"), "");

    await expect(readWorkingTreeFile(cwd, "empty.txt")).resolves.toEqual({
      content: "",
      binary: false,
    });
  });

  it("returns a symlink target instead of following it", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "sdv-link-"));
    const secretPath = path.join(cwd, "..", "sdv-secret.txt");
    await writeFile(secretPath, "secret contents");
    await symlink(secretPath, path.join(cwd, "link.txt"));

    await expect(readWorkingTreeFile(cwd, "link.txt")).resolves.toEqual({
      content: secretPath,
      binary: false,
    });
  });

  it("detects binary content without returning a text diff classification", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "sdv-binary-"));
    await writeFile(path.join(cwd, "image.bin"), Buffer.from([1, 0, 2]));

    await expect(readWorkingTreeFile(cwd, "image.bin")).resolves.toMatchObject({
      binary: true,
    });
  });

  it("rejects paths outside the repository", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "sdv-path-"));

    await expect(readWorkingTreeFile(cwd, "../outside")).rejects.toThrow(
      "invalid file path",
    );
  });
});
