import { describe, expect, it, vi } from "vitest";

import { resolveCommit } from "@/lib/git-ref";

describe("Git ref resolution", () => {
  it("places untrusted refs after --end-of-options", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "deadbeef\n" });

    await expect(
      resolveCommit(run, "/repo", "--output=/tmp/injected"),
    ).resolves.toBe("deadbeef");
    expect(run).toHaveBeenCalledWith(
      "git",
      [
        "rev-parse",
        "--verify",
        "--end-of-options",
        "--output=/tmp/injected^{commit}",
      ],
      "/repo",
    );
  });
});
