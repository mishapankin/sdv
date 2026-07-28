"use client";

import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { FileCode2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import {
  DiffHorizontalScrollbars,
  HunkNavigation,
  shouldIgnoreNavigationKey,
  useHunkNavigation,
} from "@/components/diff-navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getComparisonLabel } from "@/lib/comparison";
import { shouldExpandUnchanged } from "@/lib/diff-rendering";
import type { Comparison } from "@/lib/sem-types";

export function FileDiffView({
  filePath,
  oldFilePath,
  oldContent,
  newContent,
  cacheKey,
  theme,
  comparison,
}: {
  filePath: string;
  oldFilePath: string;
  oldContent: string;
  newContent: string;
  cacheKey: string;
  theme: "light" | "dark";
  comparison: Comparison;
}) {
  const fileDiff = useMemo(
    () => {
      if (oldContent === newContent) {
        return null;
      }

      return parseDiffFromFile(
        {
          name: oldFilePath,
          contents: oldContent,
          cacheKey: `${cacheKey}:old`,
        },
        {
          name: filePath,
          contents: newContent,
          cacheKey: `${cacheKey}:new`,
        },
        { context: 3 },
      );
    },
    [cacheKey, filePath, newContent, oldContent, oldFilePath],
  );
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(fileDiff?.hunks ?? [], diffRootRef);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreNavigationKey(event)) return;

      if (
        (event.key === "ArrowUp" || event.key === "k") &&
        hunkNavigation.hasPreviousHunk
      ) {
        event.preventDefault();
        hunkNavigation.jumpToHunk(hunkNavigation.currentHunk - 1);
        return;
      }

      if (
        (event.key === "ArrowDown" || event.key === "j") &&
        hunkNavigation.hasNextHunk
      ) {
        event.preventDefault();
        hunkNavigation.jumpToHunk(hunkNavigation.currentHunk + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hunkNavigation]);

  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <FileCode2 className="size-5 text-foreground" />
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {filePath}
            </h1>
            <Badge
              variant="outline"
              className="rounded-md font-mono text-[10px] tracking-wide uppercase"
            >
              Full file
            </Badge>
          </div>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            Ordinary Git diff · {getComparisonLabel(comparison)}
          </p>
        </div>
        <HunkNavigation
          hunks={fileDiff?.hunks ?? []}
          {...hunkNavigation}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          {fileDiff ? (
            <>
              <div
                ref={diffRootRef}
                className="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <FileDiff
                  fileDiff={fileDiff}
                  options={{
                    diffStyle: "split",
                    diffIndicators: "bars",
                    lineDiffType: "word-alt",
                    theme: theme === "dark" ? "pierre-dark" : "pierre-light",
                    overflow: "scroll",
                    disableFileHeader: true,
                    expandUnchanged: shouldExpandUnchanged(fileDiff),
                  }}
                />
              </div>
              <DiffHorizontalScrollbars
                diffRootRef={diffRootRef}
                syncKey={cacheKey}
              />
            </>
          ) : (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              No line changes in this file for{" "}
              {getComparisonLabel(comparison).toLowerCase()}.
            </div>
          )}
        </div>
      </ScrollArea>
    </main>
  );
}

export function BinaryFileView({
  filePath,
  oldFilePath,
  comparison,
}: {
  filePath: string;
  oldFilePath: string;
  comparison: Comparison;
}) {
  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center gap-4 border-b bg-card px-6 py-3">
        <FileCode2 className="size-5 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {filePath}
            </h1>
            <Badge
              variant="outline"
              className="rounded-md font-mono text-[10px] tracking-wide uppercase"
            >
              Binary file
            </Badge>
          </div>
          <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
            {oldFilePath !== filePath ? `${oldFilePath} → ${filePath} · ` : ""}
            {getComparisonLabel(comparison)}
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div className="max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <FileCode2 className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">Binary content changed</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            A line-level preview is not available for binary files.
          </p>
        </div>
      </div>
    </main>
  );
}
