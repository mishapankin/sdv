"use client";

import { useMemo } from "react";

import { FileTree } from "@/components/file-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { groupByFile } from "@/lib/group-changes";
import type {
  FileOnlyChange,
  GitDiffSummary,
  SemanticChange,
} from "@/lib/sem-types";

export function DiffSidebar({
  changes,
  fileChanges,
  gitSummary,
  selectedFilePath,
  onSelectFile,
}: {
  changes: SemanticChange[];
  fileChanges: FileOnlyChange[];
  gitSummary: GitDiffSummary;
  selectedFilePath?: string;
  onSelectFile: (filePath: string) => void;
}) {
  const fileGroups = useMemo(
    () => groupByFile(changes, fileChanges),
    [changes, fileChanges],
  );

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <div
        className="flex h-12 shrink-0 items-center gap-2 px-4 font-mono text-[11px]"
        aria-label={`${gitSummary.fileCount} files changed, ${gitSummary.additions} additions, ${gitSummary.deletions} deletions`}
      >
        <span className="text-muted-foreground">
          {gitSummary.fileCount}{" "}
          {gitSummary.fileCount === 1 ? "file changed" : "files changed"}
        </span>
        <span className="font-medium text-emerald-700 dark:text-emerald-400">
          +{gitSummary.additions}
        </span>
        <span className="font-medium text-rose-700 dark:text-rose-400">
          −{gitSummary.deletions}
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <FileTree
          fileGroups={fileGroups}
          selectedFilePath={selectedFilePath}
          onSelectFile={onSelectFile}
        />
      </ScrollArea>
    </aside>
  );
}
