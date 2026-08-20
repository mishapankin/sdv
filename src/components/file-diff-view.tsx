"use client";

import { parseDiffFromFile } from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { FileCode2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { DiffCodeView } from "@/components/diff-code-view";
import {
  HunkNavigation,
  shouldIgnoreNavigationKey,
  useHunkNavigation,
} from "@/components/diff-navigation";
import { Badge } from "@/components/ui/badge";
import { getComparisonLabel } from "@/lib/comparison";
import type { DiffLineTarget } from "@/lib/diff-selection";
import type { DiffLayout } from "@/components/use-viewer-url-state";
import type { Comparison } from "@/lib/sem-types";

export function FileDiffView({
  filePath,
  oldFilePath,
  oldContent,
  newContent,
  cacheKey,
  comparison,
  target,
  diffLayout,
  wrapLongLines,
}: {
  filePath: string;
  oldFilePath: string;
  oldContent: string;
  newContent: string;
  cacheKey: string;
  comparison: Comparison;
  target?: DiffLineTarget;
  diffLayout: DiffLayout;
  wrapLongLines: boolean;
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
  const itemId = `file:${filePath}`;
  const codeViewRef = useRef<CodeViewHandle<undefined>>(null);
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(
    fileDiff?.hunks ?? [],
    codeViewRef,
    itemId,
  );

  useEffect(() => {
    if (!target || !fileDiff) return;

    codeViewRef.current?.scrollTo({
      type: "line",
      id: itemId,
      lineNumber: target.lineNumber,
      side: target.side,
      align: "center",
      behavior: "instant",
    });
  }, [fileDiff, itemId, target]);

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

      {fileDiff ? (
        <DiffCodeView
          codeViewRef={codeViewRef}
          containerRef={diffRootRef}
          fileDiff={fileDiff}
          itemId={itemId}
          syncKey={cacheKey}
          diffLayout={diffLayout}
          wrapLongLines={wrapLongLines}
        />
      ) : (
        <div className="min-h-0 flex-1 p-5">
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No line changes in this file for{" "}
            {getComparisonLabel(comparison).toLowerCase()}.
          </div>
        </div>
      )}
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
