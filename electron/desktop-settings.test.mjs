import { describe, expect, it } from "vitest";

import {
  getDefaultDesktopSettings,
  parseDesktopSettings,
  serializeDesktopSettings,
} from "./desktop-settings.mjs";

describe("desktop settings", () => {
  it("uses platform-appropriate defaults", () => {
    expect(getDefaultDesktopSettings("darwin")).toEqual({
      theme: "system",
      windowControls: "native",
    });
    expect(getDefaultDesktopSettings("linux").windowControls).toBe("native");
    expect(getDefaultDesktopSettings("win32").windowControls).toBe("right");
  });

  it("validates persisted theme and window control values", () => {
    expect(
      parseDesktopSettings(
        { theme: "dark", windowControls: "left" },
        "linux",
      ),
    ).toEqual({ theme: "dark", windowControls: "left" });
    expect(
      parseDesktopSettings(
        { theme: "invalid", windowControls: "invalid" },
        "win32",
      ),
    ).toEqual({ theme: "system", windowControls: "right" });
  });

  it("keeps macOS window controls native", () => {
    expect(
      parseDesktopSettings(
        { theme: "light", windowControls: "right" },
        "darwin",
      ),
    ).toEqual({ theme: "light", windowControls: "native" });
  });

  it("serializes readable JSON with a trailing newline", () => {
    expect(
      serializeDesktopSettings({ theme: "dark", windowControls: "right" }),
    ).toBe(
      '{\n  "theme": "dark",\n  "windowControls": "right"\n}\n',
    );
  });
});
