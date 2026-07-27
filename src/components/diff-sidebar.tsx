"use client";

import { useMemo } from "react";

import { FileTree } from "@/components/file-tree";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { groupByFile } from "@/lib/group-changes";
import type { FileOnlyChange, SemanticChange } from "@/lib/sem-types";

export function DiffSidebar({
  changes,
  fileChanges,
  selectedEntityId,
  selectedFilePath,
  onSelectEntity,
  onSelectFile,
}: {
  changes: SemanticChange[];
  fileChanges: FileOnlyChange[];
  selectedEntityId?: string;
  selectedFilePath?: string;
  onSelectEntity: (entityId: string) => void;
  onSelectFile: (filePath: string) => void;
}) {
  const fileGroups = useMemo(
    () => groupByFile(changes, fileChanges),
    [changes, fileChanges],
  );

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Changed files
          </span>
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-1.5 font-mono text-[10px]"
          >
            {fileGroups.length}
          </Badge>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {changes.length} entities
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <FileTree
          fileGroups={fileGroups}
          selectedEntityId={selectedEntityId}
          selectedFilePath={selectedFilePath}
          onSelectEntity={onSelectEntity}
          onSelectFile={onSelectFile}
        />
      </ScrollArea>
    </aside>
  );
}
