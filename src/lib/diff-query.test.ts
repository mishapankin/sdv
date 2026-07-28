import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  getFileDiffQueryKey,
  invalidateFileDiffQueries,
} from "@/lib/diff-query";

describe("file diff query invalidation", () => {
  it("invalidates every cached file for the refreshed comparison only", async () => {
    const queryClient = new QueryClient();
    const changed = { mode: "changed" } as const;
    const staged = { mode: "staged" } as const;
    const changedA = getFileDiffQueryKey(".", changed, "a.ts");
    const changedB = getFileDiffQueryKey(".", changed, "b.ts");
    const stagedA = getFileDiffQueryKey(".", staged, "a.ts");

    queryClient.setQueryData(changedA, "old a");
    queryClient.setQueryData(changedB, "old b");
    queryClient.setQueryData(stagedA, "staged a");

    await invalidateFileDiffQueries(queryClient, ".", changed);

    expect(queryClient.getQueryState(changedA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(changedB)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(stagedA)?.isInvalidated).toBe(false);
  });
});
