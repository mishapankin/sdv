import { describe, expect, it } from "vitest";

import { DESKTOP_TOKEN_HEADER } from "./constants.mjs";
import {
  createServerEnvironment,
  formatListenAddress,
  formatServerUrl,
  waitForServer,
} from "./server-runtime.mjs";

describe("server runtime", () => {
  it("formats loopback and IPv6 addresses", () => {
    expect(formatListenAddress("127.0.0.1", 1555)).toBe("localhost:1555");
    expect(formatListenAddress("::1", 1555)).toBe("[::1]:1555");
    expect(formatServerUrl("0.0.0.0", 1555)).toBe(
      "http://127.0.0.1:1555",
    );
  });

  it("builds a scoped standalone-server environment", () => {
    expect(
      createServerEnvironment({
        environment: { PATH: "/bin" },
        host: "127.0.0.1",
        port: 4321,
        workspaceDirectory: "/repo",
        token: "secret",
      }),
    ).toEqual({
      PATH: "/bin",
      HOSTNAME: "127.0.0.1",
      PORT: "4321",
      SDV_WORKSPACE_CWD: "/repo",
      SDV_SEARCH_DEPTH: "0",
      SDV_ACCESS_TOKEN: "secret",
    });
  });

  it("sends the desktop token while probing readiness", async () => {
    let requestHeaders;
    const request = (_url, options, respond) => {
      requestHeaders = options.headers;
      respond({
        statusCode: 200,
        resume() {},
      });

      return {
        destroy() {},
        on() {},
        setTimeout() {},
      };
    };

    await expect(
      waitForServer("http://127.0.0.1:4321", {
        attempts: 1,
        request,
        token: "secret",
      }),
    ).resolves.toBeUndefined();
    expect(requestHeaders).toEqual({
      [DESKTOP_TOKEN_HEADER]: "secret",
    });
  });
});
