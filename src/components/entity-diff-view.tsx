"use client";

import {
  parseDiffFromFile,
  type FileDiffMetadata,
} from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { changeStyles } from "@/components/change-badge";
import {
  DiffHorizontalScrollbars,
  HunkNavigation,
  shouldIgnoreNavigationKey,
  useHunkNavigation,
} from "@/components/diff-navigation";
import { EntityIcon } from "@/components/entity-icons";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SemanticChange } from "@/lib/sem-types";
import { cn } from "@/lib/utils";

function createEntityFileDiff(
  change: SemanticChange,
  renderVersion: string,
): FileDiffMetadata {
  const oldName = change.oldFilePath || change.filePath;
  const oldFile = {
    name: oldName,
    contents: change.beforeContent ?? "",
    cacheKey: `${change.entityId}:${renderVersion}:before`,
  };
  const newFile = {
    name: change.filePath,
    contents: change.afterContent ?? "",
    cacheKey: `${change.entityId}:${renderVersion}:after`,
  };
  const fileDiff = parseDiffFromFile(oldFile, newFile, {
    context: 3,
  });
  const oldOffset = Math.max((change.oldStartLine ?? 1) - 1, 0);
  const newOffset = Math.max((change.startLine ?? 1) - 1, 0);

  for (const hunk of fileDiff.hunks) {
    hunk.deletionStart += oldOffset;
    hunk.additionStart += newOffset;
    hunk.hunkSpecs = `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`;
  }

  return fileDiff;
}

export function EntityDiffView({
  change,
  theme,
  renderVersion,
  onPreviousEntity,
  onNextEntity,
}: {
  change: SemanticChange;
  theme: "light" | "dark";
  renderVersion: string;
  onPreviousEntity?: () => void;
  onNextEntity?: () => void;
}) {
  const status = changeStyles[change.changeType];
  const fileDiff = useMemo(
    () => createEntityFileDiff(change, renderVersion),
    [change, renderVersion],
  );
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(
    fileDiff.hunks,
    diffRootRef,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreNavigationKey(event)) return;

      if (
        (event.key === "ArrowLeft" || event.key === "h") &&
        onPreviousEntity
      ) {
        event.preventDefault();
        onPreviousEntity();
        return;
      }

      if (
        (event.key === "ArrowRight" || event.key === "l") &&
        onNextEntity
      ) {
        event.preventDefault();
        onNextEntity();
        return;
      }

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
  }, [hunkNavigation, onNextEntity, onPreviousEntity]);

  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <EntityIcon
              entityType={change.entityType}
              className="size-5 text-foreground"
            />
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {change.entityName || "(anonymous)"}
            </h1>
            <Badge
              variant="outline"
              className="rounded-md font-mono text-[10px] tracking-wide uppercase"
            >
              {change.entityType}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md text-[10px] uppercase",
                status.className,
              )}
            >
              {status.label}
            </Badge>
          </div>
          <div className="mt-1.5 flex items-center gap-2 truncate font-mono text-xs text-muted-foreground">
            {change.oldFilePath && change.oldFilePath !== change.filePath ? (
              <>
                <span className="truncate">{change.oldFilePath}</span>
                <ArrowRight className="size-3 shrink-0" />
              </>
            ) : null}
            <span className="truncate">{change.filePath}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          {change.structuralChange === false ? (
            <span className="hidden items-center gap-1.5 xl:flex">
              <Sparkles className="size-3.5" />
              cosmetic
            </span>
          ) : null}
          <HunkNavigation
            hunks={fileDiff.hunks}
            {...hunkNavigation}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
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
              }}
            />
          </div>
          <DiffHorizontalScrollbars
            diffRootRef={diffRootRef}
            syncKey={`${change.entityId}:${renderVersion}`}
          />
        </div>
      </ScrollArea>
    </main>
  );
}
