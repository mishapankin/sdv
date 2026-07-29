import { describe, expect, it } from "vitest";

import { getRequestedWorkspace } from "./arguments.mjs";

describe("getRequestedWorkspace", () => {
  it("reads inline and separate workspace arguments", () => {
    expect(getRequestedWorkspace(["electron", ".", "--workspace=/repo"])).toBe(
      "/repo",
    );
    expect(
      getRequestedWorkspace(["electron", ".", "--workspace", "/other"]),
    ).toBe("/other");
  });

  it("returns undefined when no workspace was supplied", () => {
    expect(getRequestedWorkspace(["electron", "."])).toBeUndefined();
  });
});
