#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
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
    env: {
      ...process.env,
      SDV_REPO_CWD: repositoryDirectory,
    },
    stdio: "inherit",
  },
);

server.on("error", (error) => {
  console.error(`sdv: failed to start server: ${error.message}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
