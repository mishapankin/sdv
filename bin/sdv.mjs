#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import http from "node:http";
import { constants as osConstants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, InvalidArgumentError } from "commander";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8"),
);

function parsePort(value) {
  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || String(port) !== value || port < 1 || port > 65535) {
    throw new InvalidArgumentError("must be an integer between 1 and 65535");
  }

  return port;
}

function parseSearchDepth(value) {
  if (value === "unlimited") {
    return value;
  }

  const depth = Number.parseInt(value, 10);

  if (!Number.isInteger(depth) || String(depth) !== value || depth < 0) {
    throw new InvalidArgumentError(
      'must be a non-negative integer or "unlimited"',
    );
  }

  return depth;
}

const program = new Command()
  .name("sdv")
  .description("Run a local browser UI for semantic Git diffs")
  .version(packageJson.version)
  .option("-p, --port <number>", "server port", parsePort, 1555)
  .option("--host <host>", "server host", "127.0.0.1")
  .option(
    "--search-depth <depth>",
    'repository search depth: 0 only checks cwd, 1 checks direct children, "unlimited" recurses without a cap',
    parseSearchDepth,
    "unlimited",
  )
  .option("--no-open", "do not open the browser automatically")
  .showHelpAfterError()
  .parse();

const options = program.opts();
const repositoryDirectory = process.cwd();
const browserHost =
  options.host === "0.0.0.0"
    ? "127.0.0.1"
    : options.host === "::"
      ? "::1"
      : options.host;
const formattedBrowserHost = browserHost.includes(":")
  ? `[${browserHost}]`
  : browserHost;
const serverUrl = `http://${formattedBrowserHost}:${options.port}`;
const displayHost = options.host === "127.0.0.1" ? "localhost" : options.host;
const nextBinary = path.join(
  packageRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const semCheck = spawnSync("sem", ["--version"], {
  cwd: repositoryDirectory,
  encoding: "utf8",
});

if (semCheck.error?.code === "ENOENT") {
  console.error("sdv: sem is missing from PATH");
  process.exit(1);
}

if (semCheck.status !== 0) {
  console.error((semCheck.stderr || "sdv: unable to run sem").trim());
  process.exit(1);
}

const gitVersionCheck = spawnSync("git", ["--version"], {
  cwd: repositoryDirectory,
  encoding: "utf8",
});

if (gitVersionCheck.status !== 0) {
  console.error((gitVersionCheck.stderr || "sdv: unable to run git").trim());
  process.exit(1);
}

function isGitRepository(directory) {
  const gitCheck = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: directory,
    encoding: "utf8",
  });

  return gitCheck.status === 0 && gitCheck.stdout.trim() === "true";
}

function getChildDirectories(directory) {
  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(directory, entry.name));
}

function hasGitRepositoryWithinDepth(directory, maxDepth, currentDepth = 0) {
  if (isGitRepository(directory)) {
    return true;
  }

  if (maxDepth !== "unlimited" && currentDepth >= maxDepth) {
    return false;
  }

  return getChildDirectories(directory).some((childDirectory) =>
    hasGitRepositoryWithinDepth(childDirectory, maxDepth, currentDepth + 1),
  );
}

if (!hasGitRepositoryWithinDepth(repositoryDirectory, options.searchDepth)) {
  console.error(
    "sdv: no Git repositories found within the configured search depth",
  );
  process.exit(1);
}

const serverEnvironment = {
  ...process.env,
  SDV_WORKSPACE_CWD: repositoryDirectory,
  SDV_SEARCH_DEPTH: String(options.searchDepth),
};

console.log(`Running on ${displayHost}:${options.port}`);

const server = spawn(
  process.execPath,
  [
    nextBinary,
    "start",
    packageRoot,
    "--hostname",
    options.host,
    "--port",
    String(options.port),
  ],
  {
    cwd: repositoryDirectory,
    detached: true,
    env: serverEnvironment,
    stdio: "inherit",
  },
);

function waitForServer(url, attempts = 100) {
  return new Promise((resolve, reject) => {
    function check(remainingAttempts) {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.setTimeout(500, () => request.destroy());
      request.on("error", () => {
        if (remainingAttempts <= 1) {
          reject(new Error("server did not become ready in time"));
          return;
        }

        setTimeout(() => check(remainingAttempts - 1), 100);
      });
    }

    check(attempts);
  });
}

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "linux"
        ? "xdg-open"
        : undefined;

  if (!command) {
    console.error(`sdv: unable to open a browser on ${process.platform}`);
    return;
  }

  const opener = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
  });

  opener.on("error", (error) => {
    console.error(`sdv: unable to open browser: ${error.message}`);
  });
  opener.unref();
}

if (options.open) {
  waitForServer(serverUrl)
    .then(() => openBrowser(serverUrl))
    .catch((error) => {
      if (!shutdownSignal) {
        console.error(`sdv: ${error.message}`);
      }
    });
}

let shutdownSignal;
let shutdownTimer;

function getSignalExitCode(signal) {
  return 128 + (osConstants.signals[signal] ?? 0);
}

function killServer(signal) {
  if (!server.pid || server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  try {
    process.kill(-server.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      console.error(`sdv: failed to stop server: ${error.message}`);
    }
  }
}

function shutdown(signal) {
  if (shutdownSignal) {
    killServer("SIGKILL");
    process.exit(getSignalExitCode(signal));
  }

  shutdownSignal = signal;
  killServer(signal);

  shutdownTimer = setTimeout(() => {
    console.error("sdv: server did not stop in time; forcing shutdown");
    killServer("SIGKILL");
    process.exit(getSignalExitCode(signal));
  }, 2_000);
  shutdownTimer.unref();
}

server.on("error", (error) => {
  console.error(`sdv: failed to start server: ${error.message}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

server.on("exit", (code, signal) => {
  if (shutdownTimer) clearTimeout(shutdownTimer);

  if (shutdownSignal) {
    process.exit(getSignalExitCode(shutdownSignal));
  }

  process.exit(code ?? (signal ? getSignalExitCode(signal) : 1));
});
