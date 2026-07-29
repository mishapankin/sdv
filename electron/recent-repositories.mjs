import path from "node:path";

export const RECENT_REPOSITORIES_LIMIT = 10;
export const RECENT_REPOSITORIES_VERSION = 1;

function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return {
      path: entry,
      lastOpenedAt: null,
    };
  }

  if (
    !entry ||
    typeof entry !== "object" ||
    typeof entry.path !== "string"
  ) {
    return undefined;
  }

  return {
    path: entry.path,
    lastOpenedAt:
      typeof entry.lastOpenedAt === "string" ? entry.lastOpenedAt : null,
  };
}

export function parseRecentRepositories(value) {
  const values = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray(value.repositories)
      ? value.repositories
      : [];
  const seen = new Set();

  return values
    .map(normalizeEntry)
    .filter((entry) => {
      if (!entry) return false;

      const normalizedPath = path.resolve(entry.path);
      if (seen.has(normalizedPath)) return false;

      seen.add(normalizedPath);
      entry.path = normalizedPath;
      return true;
    })
    .slice(0, RECENT_REPOSITORIES_LIMIT);
}

export function rememberRecentRepository(
  repositories,
  directory,
  lastOpenedAt = new Date().toISOString(),
) {
  const normalizedDirectory = path.resolve(directory);

  return [
    { path: normalizedDirectory, lastOpenedAt },
    ...parseRecentRepositories(repositories).filter(
      (entry) => entry.path !== normalizedDirectory,
    ),
  ].slice(0, RECENT_REPOSITORIES_LIMIT);
}

export function forgetRecentRepository(repositories, directory) {
  const normalizedDirectory = path.resolve(directory);

  return parseRecentRepositories(repositories).filter(
    (entry) => entry.path !== normalizedDirectory,
  );
}

export function serializeRecentRepositories(repositories) {
  return `${JSON.stringify(
    {
      version: RECENT_REPOSITORIES_VERSION,
      repositories: parseRecentRepositories(repositories),
    },
    null,
    2,
  )}\n`;
}
