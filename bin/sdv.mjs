#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { constants as osConstants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryDirectory = process.cwd();
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
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

const gitCheck = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  cwd: repositoryDirectory,
  encoding: "utf8",
});

if (gitCheck.status !== 0 || gitCheck.stdout.trim() !== "true") {
  console.error("sdv: run this command inside a Git repository");
  process.exit(1);
}

console.log("Running on localhost:1555");

const server = spawn(
  process.execPath,
  [
    nextBinary,
    "start",
    packageRoot,
    "--hostname",
    "127.0.0.1",
    "--port",
    "1555",
  ],
  {
    cwd: repositoryDirectory,
    detached: true,
    env: {
      ...process.env,
      SDV_REPO_CWD: repositoryDirectory,
    },
    stdio: "inherit",
  },
);

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
