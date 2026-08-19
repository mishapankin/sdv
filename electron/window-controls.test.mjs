import { describe, expect, it } from "vitest";

import {
  getDefaultWindowControls,
  parseWindowControls,
} from "./window-controls.mjs";

describe("window control preferences", () => {
  it("uses platform-appropriate defaults", () => {
    expect(getDefaultWindowControls("darwin")).toBe("native");
    expect(getDefaultWindowControls("linux")).toBe("native");
    expect(getDefaultWindowControls("win32")).toBe("right");
  });

  it("accepts custom modes outside macOS", () => {
    expect(parseWindowControls("left", "linux")).toBe("left");
    expect(parseWindowControls("right", "win32")).toBe("right");
    expect(parseWindowControls("hidden", "linux")).toBe("hidden");
  });

  it("keeps macOS native and rejects invalid stored values", () => {
    expect(parseWindowControls("right", "darwin")).toBe("native");
    expect(parseWindowControls("invalid", "linux")).toBe("native");
    expect(parseWindowControls("invalid", "win32")).toBe("right");
  });
});
