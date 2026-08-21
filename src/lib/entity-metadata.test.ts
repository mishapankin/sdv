import { describe, expect, it } from "vitest";

import {
  formatLineRange,
  getEntityLineStats,
} from "@/lib/entity-metadata";
import type { SemanticChange } from "@/lib/sem-types";

function change(overrides: Partial<SemanticChange> = {}): SemanticChange {
  return {
    entityId: "src/example.ts::function::example",
    changeType: "modified",
    entityType: "function",
    entityName: "example",
    filePath: "src/example.ts",
    beforeContent: "function example() {\n  return 1;\n}",
    afterContent: "function example() {\n  const value = 2;\n  return value;\n}",
    ...overrides,
  };
}

describe("entity metadata", () => {
  it("formats single lines and ranges", () => {
    expect(formatLineRange(12, 12)).toBe("L12");
    expect(formatLineRange(12, 18)).toBe("L12–18");
    expect(formatLineRange(null, null)).toBeNull();
  });

  it("counts actual changed lines rather than hunk context", () => {
    expect(getEntityLineStats(change())).toEqual({
      additions: 2,
      deletions: 1,
    });
  });

  it("reports structural-only changes without invented line changes", () => {
    expect(
      getEntityLineStats(
        change({
          changeType: "moved",
          beforeContent: "function example() {}",
          afterContent: "function example() {}",
        }),
      ),
    ).toEqual({ additions: 0, deletions: 0 });
  });
});
