import { describe, expect, it } from "vitest";

import {
  formatInspectClassification,
  getHighestFileRiskReview,
  indexInspectReviews,
} from "@/lib/inspect-view-model";
import type { InspectEntityReview } from "@/lib/inspect-types";

function review(
  entityId: string,
  filePath: string,
  riskLevel: InspectEntityReview["riskLevel"],
): InspectEntityReview {
  return {
    entityId,
    entityName: entityId,
    entityType: "function",
    filePath,
    classification: "Functional",
    riskScore: 0.5,
    riskLevel,
    blastRadius: 0,
    dependentCount: 0,
    dependencyCount: 0,
    publicApi: false,
    structuralChange: true,
    groupId: 0,
    groupLabel: null,
  };
}

describe("inspect view model", () => {
  it("matches reviews by exact entity id", () => {
    const matching = review("src/a.ts::function::run", "src/a.ts", "high");
    const reviews = indexInspectReviews([matching]);

    expect(reviews.get("src/a.ts::function::run")).toBe(matching);
    expect(reviews.get("src/a.ts::function::runner")).toBeUndefined();
  });

  it("returns the highest risk review for a file", () => {
    const reviews = [
      review("low", "src/a.ts", "low"),
      review("critical", "src/a.ts", "critical"),
      review("other", "src/b.ts", "high"),
    ];

    expect(getHighestFileRiskReview(reviews, "src/a.ts")?.entityId).toBe(
      "critical",
    );
  });

  it("formats compound classifications", () => {
    expect(formatInspectClassification("SyntaxFunctional")).toBe(
      "syntax + functional",
    );
  });
});
