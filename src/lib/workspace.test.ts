import { describe, expect, it } from "vitest";

import { parseChangedFileCount } from "@/lib/workspace";

describe("workspace Git status parsing", () => {
  it("counts NUL-delimited paths without interpreting filename contents", () => {
    const status = [
      " M ordinary.ts",
      "?? line\nbreak -> name.ts",
      "A  quoted \"name\".ts",
      "",
    ].join("\0");

    expect(parseChangedFileCount(status)).toBe(3);
  });

  it("counts a rename or copy once and skips its source record", () => {
    const status = [
      "R  destination -> literal.ts",
      "source\nname.ts",
      "C  copied.ts",
      "original.ts",
      "",
    ].join("\0");

    expect(parseChangedFileCount(status)).toBe(2);
  });
});
