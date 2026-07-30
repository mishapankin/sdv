#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { constants as osConstants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, InvalidArgumentError } from "commander";

import { preflightWorkspace } from "../runtime/preflight.mjs";
import {
  checkPortAvailable,
  createServerEnvironment,
  formatListenAddress,
  formatServerUrl,
  resolveStandaloneServerPath,
  spawnNodeServer,
  waitForServer,
} from "../runtime/server-runtime.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8"),
);

function parsePort(value) {
  const port = Number.parseInt(value, 10);

  if (
    !Number.isInteger(port) ||
    String(port) !== value ||
    port < 1 ||
    port > 65535
  ) {
    throw new InvalidArgumentError("must be an integer between 1 and 65535");
  }

  return port;
}

const program = new Command()
  .name("sdv")
  .description("Run a local browser UI for Git diffs")
  .version(packageJson.version)
  .option("-p, --port <number>", "server port", parsePort, 1555)
  .option("--host <host>", "server host", "127.0.0.1")
  .option("--open", "open the browser automatically")
  .showHelpAfterError()
  .parse();

const options = program.opts();
const repositoryDirectory = process.cwd();
const preflight = preflightWorkspace(repositoryDirectory);

if (!preflight.ok) {
  const message =
    preflight.code === "invalid-repository"
      ? "sdv: current directory is not a Git worktree"
      : preflight.error;
  console.error(message);
  process.exit(1);
}

try {
  await checkPortAvailable(options.host, options.port);
} catch (error) {
  const address = formatListenAddress(options.host, options.port);

  if (error?.code === "EADDRINUSE") {
    const suggestedPort = options.port === 65535 ? 65534 : options.port + 1;

    console.error(`sdv: ${address} is already in use`);
    console.error("Stop the existing process or choose another port:");
    console.error(`  sdv --port ${suggestedPort}`);
  } else {
    console.error(`sdv: unable to listen on ${address}: ${error.message}`);
  }

  process.exit(1);
}

let serverPath;

try {
  serverPath = await resolveStandaloneServerPath(packageRoot);
} catch (error) {
  console.error(`sdv: ${error.message}`);
  process.exit(1);
}

const displayHost = options.host === "127.0.0.1" ? "localhost" : options.host;
const serverUrl = formatServerUrl(options.host, options.port);
const serverEnvironment = createServerEnvironment({
  environment: preflight.environment,
  host: options.host,
  port: options.port,
  workspaceDirectory: preflight.directory,
});

console.log(`Running on ${displayHost}:${options.port}`);

const server = spawnNodeServer({
  serverPath,
  environment: serverEnvironment,
});

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

let shutdownSignal;
let shutdownTimer;

if (options.open) {
  waitForServer(serverUrl)
    .then(() => openBrowser(serverUrl))
    .catch((error) => {
      if (!shutdownSignal) {
        console.error(`sdv: ${error.message}`);
      }
    });
}

function getSignalExitCode(signal) {
  return 128 + (osConstants.signals[signal] ?? 0);
}

function killServer(signal) {
  if (!server.pid || server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  try {
    if (process.platform === "win32") {
      server.kill(signal);
    } else {
      process.kill(-server.pid, signal);
    }
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
