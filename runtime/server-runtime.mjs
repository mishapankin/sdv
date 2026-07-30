import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";

import { DESKTOP_TOKEN_HEADER } from "./constants.mjs";

export function formatListenAddress(host, port) {
  if (host === "127.0.0.1") {
    return `localhost:${port}`;
  }

  return host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`;
}

export function formatServerUrl(host, port) {
  const browserHost =
    host === "0.0.0.0" ? "127.0.0.1" : host === "::" ? "::1" : host;
  const formattedHost = browserHost.includes(":")
    ? `[${browserHost}]`
    : browserHost;

  return `http://${formattedHost}:${port}`;
}

export function checkPortAvailable(host, port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", reject);
    probe.listen({ host, port }, () => {
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });
}

export function findAvailablePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", reject);
    probe.listen({ host, port: 0 }, () => {
      const address = probe.address();
      const port =
        typeof address === "object" && address !== null
          ? address.port
          : undefined;

      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error("unable to allocate a loopback port"));
          return;
        }

        resolve(port);
      });
    });
  });
}

export function waitForServer(
  url,
  {
    attempts = 100,
    interval = 100,
    request = http.get,
    timeout = 500,
    token,
  } = {},
) {
  return new Promise((resolve, reject) => {
    function check(remainingAttempts) {
      const headers = token ? { [DESKTOP_TOKEN_HEADER]: token } : undefined;
      const serverRequest = request(url, { headers }, (response) => {
        response.resume();

        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }

        retry(remainingAttempts);
      });

      serverRequest.setTimeout(timeout, () => serverRequest.destroy());
      serverRequest.on("error", () => retry(remainingAttempts));
    }

    function retry(remainingAttempts) {
      if (remainingAttempts <= 1) {
        reject(new Error("server did not become ready in time"));
        return;
      }

      setTimeout(() => check(remainingAttempts - 1), interval);
    }

    check(attempts);
  });
}

export function createServerEnvironment({
  environment = process.env,
  host,
  port,
  workspaceDirectory,
  token,
}) {
  return {
    ...environment,
    HOSTNAME: host,
    PORT: String(port),
    SDV_WORKSPACE_CWD: workspaceDirectory,
    SDV_SEARCH_DEPTH: "0",
    ...(token ? { SDV_ACCESS_TOKEN: token } : {}),
  };
}

export async function resolveStandaloneServerPath(packageRoot) {
  const candidates = [
    path.join(packageRoot, ".next", "standalone", "server.js"),
    path.join(packageRoot, "dist", "standalone", "server.js"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported build location.
    }
  }

  throw new Error(
    "standalone server is missing; run `pnpm build` before starting SDV",
  );
}

export function spawnNodeServer({
  serverPath,
  environment,
  detached = process.platform !== "win32",
  stdio = "inherit",
}) {
  return spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    detached,
    env: environment,
    stdio,
  });
}
