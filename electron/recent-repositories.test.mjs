import { describe, expect, it } from "vitest";

import {
  forgetRecentRepository,
  parseRecentRepositories,
  rememberRecentRepository,
  serializeRecentRepositories,
} from "./recent-repositories.mjs";

describe("recent repositories", () => {
  it("migrates the legacy string-array format", () => {
    expect(parseRecentRepositories(["/repo", "/other"])).toEqual([
      { path: "/repo", lastOpenedAt: null },
      { path: "/other", lastOpenedAt: null },
    ]);
  });

  it("moves an opened repository to the front with a timestamp", () => {
    expect(
      rememberRecentRepository(
        [
          { path: "/other", lastOpenedAt: "earlier" },
          { path: "/repo", lastOpenedAt: "old" },
        ],
        "/repo",
        "now",
      ),
    ).toEqual([
      { path: "/repo", lastOpenedAt: "now" },
      { path: "/other", lastOpenedAt: "earlier" },
    ]);
  });

  it("forgets repositories and writes a versioned JSON document", () => {
    const repositories = forgetRecentRepository(
      [
        { path: "/repo", lastOpenedAt: "now" },
        { path: "/other", lastOpenedAt: "earlier" },
      ],
      "/repo",
    );

    expect(JSON.parse(serializeRecentRepositories(repositories))).toEqual({
      version: 1,
      repositories: [{ path: "/other", lastOpenedAt: "earlier" }],
    });
  });
});
