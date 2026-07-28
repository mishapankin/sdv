import { describe, expect, it } from "vitest";

import {
  getComparisonFromSearchParams,
  getComparisonLabel,
  getGitFileDiffCommand,
  getSemCommand,
} from "@/lib/comparison";

describe("comparison view state", () => {
  it("parses supported URL modes and defaults missing refs", () => {
    expect(getComparisonFromSearchParams(new URLSearchParams())).toEqual({
      mode: "changed",
    });
    expect(
      getComparisonFromSearchParams(new URLSearchParams("mode=staged")),
    ).toEqual({ mode: "staged" });
    expect(
      getComparisonFromSearchParams(new URLSearchParams("mode=commits")),
    ).toEqual({
      mode: "commits",
      from: "HEAD~1",
      to: "HEAD",
    });
    expect(
      getComparisonFromSearchParams(
        new URLSearchParams("mode=commits&from=main&to=feature"),
      ),
    ).toEqual({
      mode: "commits",
      from: "main",
      to: "feature",
    });
  });

  it("formats labels and sem commands without changing comparison semantics", () => {
    expect(getComparisonLabel({ mode: "changed" })).toBe("Changed");
    expect(getSemCommand({ mode: "changed" })).toBe(
      "sem diff HEAD --verbose --format json",
    );
    expect(getSemCommand({ mode: "staged" })).toBe(
      "sem diff --staged --verbose --format json",
    );
    expect(
      getSemCommand({ mode: "commits", from: "main", to: "feature" }),
    ).toBe(
      "sem diff --from main --to feature --verbose --format json",
    );
  });

  it("formats contextual Git commands for full-file diffs", () => {
    expect(
      getGitFileDiffCommand({ mode: "changed" }, "src/app.ts"),
    ).toBe("git diff HEAD -- src/app.ts");
    expect(
      getGitFileDiffCommand({ mode: "staged" }, "src/app.ts"),
    ).toBe("git diff --cached -- src/app.ts");
    expect(
      getGitFileDiffCommand(
        { mode: "commits", from: "main", to: "feature" },
        "src/app.ts",
      ),
    ).toBe(
      "git diff --end-of-options main feature -- src/app.ts",
    );
    expect(
      getGitFileDiffCommand(
        { mode: "changed" },
        "new files/app.ts",
        true,
      ),
    ).toBe(
      "git diff --no-index -- /dev/null 'new files/app.ts'",
    );
  });
});
