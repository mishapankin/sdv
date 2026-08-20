import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { watch, type FSWatcher } from "chokidar";

import { resolveRepositoryDirectory } from "@/lib/workspace";

const execFileAsync = promisify(execFile);
// Editors often produce several events for one atomic save.
const DEBOUNCE_MS = 300;
const MAX_WAIT_MS = 1_500;

export type RepositoryWatchEvent =
  | { type: "change"; generation: number }
  | { type: "error"; message: string };

type Listener = (event: RepositoryWatchEvent) => void;

type WatchEntry = {
  directory: string;
  generation: number;
  listeners: Set<Listener>;
  worktreeWatcher: FSWatcher;
  gitWatcher: FSWatcher;
  debounceTimer?: ReturnType<typeof setTimeout>;
  maxWaitTimer?: ReturnType<typeof setTimeout>;
};

const watchEntries = new Map<string, Promise<WatchEntry>>();

function resolveGitPath(directory: string, value: string) {
  return path.resolve(directory, value.trim());
}

async function readGitDirectories(directory: string) {
  const environment = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  const [gitDirectoryResult, commonDirectoryResult, statusResult] =
    await Promise.all([
      execFileAsync("git", ["rev-parse", "--git-dir"], {
        cwd: directory,
        encoding: "utf8",
        env: environment,
      }),
      execFileAsync("git", ["rev-parse", "--git-common-dir"], {
        cwd: directory,
        encoding: "utf8",
        env: environment,
      }),
      execFileAsync(
        "git",
        [
          "status",
          "--porcelain=v1",
          "-z",
          "--ignored",
          "--untracked-files=normal",
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: environment,
          maxBuffer: 20 * 1024 * 1024,
        },
      ),
    ]);

  const ignoredDirectories = statusResult.stdout
    .split("\0")
    .filter((record) => record.startsWith("!! ") && record.endsWith("/"))
    .map((record) => path.resolve(directory, record.slice(3, -1)));

  return {
    gitDirectory: resolveGitPath(directory, gitDirectoryResult.stdout),
    commonDirectory: resolveGitPath(directory, commonDirectoryResult.stdout),
    ignoredDirectories,
  };
}

function notify(entry: WatchEntry, event: RepositoryWatchEvent) {
  for (const listener of entry.listeners) {
    listener(event);
  }
}

function flush(entry: WatchEntry) {
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  if (entry.maxWaitTimer) clearTimeout(entry.maxWaitTimer);
  entry.debounceTimer = undefined;
  entry.maxWaitTimer = undefined;
  entry.generation += 1;
  notify(entry, { type: "change", generation: entry.generation });
}

function schedule(entry: WatchEntry) {
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.debounceTimer = setTimeout(() => flush(entry), DEBOUNCE_MS);

  if (!entry.maxWaitTimer) {
    entry.maxWaitTimer = setTimeout(() => flush(entry), MAX_WAIT_MS);
  }
}

async function createWatchEntry(directory: string): Promise<WatchEntry> {
  const { gitDirectory, commonDirectory, ignoredDirectories } =
    await readGitDirectories(directory);
  const gitPrefix = `${gitDirectory}${path.sep}`;
  const worktreeWatcher = watch(directory, {
    ignoreInitial: true,
    ignored: (candidate) =>
      candidate === gitDirectory ||
      candidate.startsWith(gitPrefix) ||
      ignoredDirectories.some(
        (ignoredDirectory) =>
          candidate === ignoredDirectory ||
          candidate.startsWith(`${ignoredDirectory}${path.sep}`),
      ),
  });
  const gitWatcher = watch(
    [
      path.join(gitDirectory, "index"),
      path.join(gitDirectory, "HEAD"),
      path.join(commonDirectory, "refs"),
      path.join(commonDirectory, "packed-refs"),
    ],
    { ignoreInitial: true },
  );
  const entry: WatchEntry = {
    directory,
    generation: 0,
    listeners: new Set(),
    worktreeWatcher,
    gitWatcher,
  };

  worktreeWatcher.on("all", () => schedule(entry));
  gitWatcher.on("all", () => schedule(entry));

  function waitUntilReady(watcher: FSWatcher) {
    return new Promise<void>((resolve, reject) => {
      watcher.once("ready", resolve);
      watcher.once("error", reject);
    });
  }

  try {
    await Promise.all([
      waitUntilReady(worktreeWatcher),
      waitUntilReady(gitWatcher),
    ]);
  } catch (error) {
    await Promise.all([worktreeWatcher.close(), gitWatcher.close()]);
    throw error;
  }

  function reportWatcherError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    notify(entry, { type: "error", message });
  }

  worktreeWatcher.on("error", reportWatcherError);
  gitWatcher.on("error", reportWatcherError);

  return entry;
}

async function closeEntry(entry: WatchEntry) {
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  if (entry.maxWaitTimer) clearTimeout(entry.maxWaitTimer);
  await Promise.all([entry.worktreeWatcher.close(), entry.gitWatcher.close()]);
}

export async function subscribeToRepositoryChanges(
  repoId: string | undefined,
  listener: Listener,
) {
  const directory = await resolveRepositoryDirectory(repoId);
  let entryPromise = watchEntries.get(directory);

  if (!entryPromise) {
    entryPromise = createWatchEntry(directory);
    watchEntries.set(directory, entryPromise);
  }

  let entry: WatchEntry;

  try {
    entry = await entryPromise;
  } catch (error) {
    if (watchEntries.get(directory) === entryPromise) {
      watchEntries.delete(directory);
    }
    throw error;
  }

  entry.listeners.add(listener);
  let subscribed = true;

  return async () => {
    if (!subscribed) return;
    subscribed = false;
    entry.listeners.delete(listener);

    if (
      entry.listeners.size === 0 &&
      watchEntries.get(directory) === entryPromise
    ) {
      watchEntries.delete(directory);
      await closeEntry(entry);
    }
  };
}
