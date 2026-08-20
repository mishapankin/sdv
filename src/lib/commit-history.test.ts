import { describe, expect, it, vi } from "vitest";

import {
  readRecentCommitsFromRepository,
  validateComparisonRefsInRepository,
  type CommandRunner,
} from "@/lib/sem";

function record({
  hash,
  shortHash,
  subject,
  refs = "",
}: {
  hash: string;
  shortHash: string;
  subject: string;
  refs?: string;
}) {
  return [
    hash,
    shortHash,
    subject,
    "Ada Lovelace",
    "2026-08-20T12:00:00Z",
    "yesterday",
    refs,
  ].join("\x1f") + "\x1e";
}

describe("commit history boundary", () => {
  it("puts current history first, deduplicates commits, and avoids --all", async () => {
    const current = record({
      hash: "a".repeat(40),
      shortHash: "aaaaaaa",
      subject: "Current branch commit",
      refs: "HEAD -> main",
    });
    const other = record({
      hash: "b".repeat(40),
      shortHash: "bbbbbbb",
      subject: "Other branch commit",
      refs: "feature/other",
    });
    const runner: CommandRunner = vi.fn(async (_command, args) => ({
      stdout: args.includes("HEAD") ? current : other + current,
      stderr: "",
    }));

    const result = await readRecentCommitsFromRepository("/repo", runner);

    expect(result).toMatchObject({
      ok: true,
      data: [
        { shortHash: "aaaaaaa", author: "Ada Lovelace" },
        { shortHash: "bbbbbbb" },
      ],
    });
    expect(runner).not.toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["--all"]),
      "/repo",
    );
    expect(runner).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["--branches", "--remotes", "--tags"]),
      "/repo",
    );
  });

  it("reports the invalid ref next to the correct field", async () => {
    const runner: CommandRunner = vi.fn(async (_command, args) => {
      if (args.at(-1) === "missing^{commit}") throw new Error("bad ref");
      return { stdout: "a".repeat(40), stderr: "" };
    });

    await expect(
      validateComparisonRefsInRepository("main", "missing", "/repo", runner),
    ).resolves.toEqual({
      ok: false,
      field: "to",
      error: "Compare ref “missing” does not resolve to a commit.",
    });
  });
});
