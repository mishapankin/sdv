import { describe, expect, it } from "vitest";

import { shouldShowSemanticSidebar } from "@/lib/semantic-sidebar";

describe("semantic sidebar visibility", () => {
  it("shows installation guidance only for text files when sem is unavailable", () => {
    expect(
      shouldShowSemanticSidebar({
        semanticAvailable: false,
        semanticChangeCount: 0,
        fileKind: "text",
      }),
    ).toBe(true);
    expect(
      shouldShowSemanticSidebar({
        semanticAvailable: false,
        semanticChangeCount: 0,
        fileKind: "image",
      }),
    ).toBe(false);
    expect(
      shouldShowSemanticSidebar({
        semanticAvailable: false,
        semanticChangeCount: 0,
        fileKind: "binary",
      }),
    ).toBe(false);
  });

  it("uses reported semantic changes when sem is available", () => {
    expect(
      shouldShowSemanticSidebar({
        semanticAvailable: true,
        semanticChangeCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldShowSemanticSidebar({
        semanticAvailable: true,
        semanticChangeCount: 0,
        fileKind: "text",
      }),
    ).toBe(false);
  });
});
