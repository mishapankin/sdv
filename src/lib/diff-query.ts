import type { QueryClient } from "@tanstack/react-query";

import type { Comparison } from "@/lib/sem-types";

export function getFileDiffQueryKey(
  repoId: string,
  comparison: Comparison,
  filePath?: string,
) {
  return ["file-diff", repoId, comparison, filePath] as const;
}

export function getFileDiffComparisonQueryKey(
  repoId: string,
  comparison: Comparison,
) {
  return ["file-diff", repoId, comparison] as const;
}

export function invalidateFileDiffQueries(
  queryClient: QueryClient,
  repoId: string,
  comparison: Comparison,
) {
  return queryClient.invalidateQueries({
    queryKey: getFileDiffComparisonQueryKey(repoId, comparison),
  });
}

export function removeFileDiffQueries(
  queryClient: QueryClient,
  repoId: string,
  comparison: Comparison,
) {
  queryClient.removeQueries({
    queryKey: getFileDiffComparisonQueryKey(repoId, comparison),
  });
}
