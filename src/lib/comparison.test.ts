import { describe, expect, it } from "vitest";

import {
  getComparisonFromSearchParams,
  getComparisonLabel,
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
});
