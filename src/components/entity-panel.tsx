"use client";

import { FileCode2 } from "lucide-react";

import { ChangeBadge } from "@/components/change-badge";
import { EntityIcon } from "@/components/entity-icons";
import { FileTypeIcon } from "@/components/file-type-icon";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileGroup } from "@/lib/group-changes";
import { cn } from "@/lib/utils";

export function EntityPanel({
  fileGroup,
  selectedEntityId,
  onSelectFullFile,
  onSelectEntity,
}: {
  fileGroup: FileGroup;
  selectedEntityId?: string;
  onSelectFullFile: () => void;
  onSelectEntity: (entityId: string) => void;
}) {
  const fileName = fileGroup.filePath.split("/").at(-1) ?? fileGroup.filePath;

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar/60">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <FileTypeIcon
          filePath={fileGroup.filePath}
          className="size-4 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Changes in
          </div>
          <div
            className="truncate text-xs font-medium"
            title={fileGroup.filePath}
          >
            {fileName}
          </div>
        </div>
        <Badge
          variant="secondary"
          className="h-5 rounded-md px-1.5 font-mono text-[10px]"
        >
          {fileGroup.changes.length}
        </Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label={`Changes in ${fileGroup.filePath}`} className="py-2">
          <button
            type="button"
            onClick={onSelectFullFile}
            className={cn(
              "flex h-10 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
              selectedEntityId === undefined &&
                "bg-card text-foreground shadow-xs",
            )}
          >
            <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                Full file diff
              </span>
              <span className="block font-mono text-[9px] leading-3 text-muted-foreground">
                Git patch
              </span>
            </span>
          </button>

          {fileGroup.changes.map((change) => (
            <button
              key={change.entityId}
              type="button"
              onClick={() => onSelectEntity(change.entityId)}
              className={cn(
                "flex h-10 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                selectedEntityId === change.entityId &&
                  "bg-card text-foreground shadow-xs",
              )}
              title={`${change.entityType}: ${change.entityName || "(anonymous)"}`}
            >
              <EntityIcon
                entityType={change.entityType}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {change.entityName || "(anonymous)"}
                </span>
                <span className="block truncate font-mono text-[9px] leading-3 text-muted-foreground">
                  {change.entityType}
                  {change.startLine ? ` · L${change.startLine}` : ""}
                </span>
              </span>
              <ChangeBadge changeType={change.changeType} />
            </button>
          ))}
        </nav>

        {fileGroup.changes.length === 0 ? (
          <p className="px-3 py-4 text-xs leading-5 text-muted-foreground">
            No semantic entity changes were reported for this file.
          </p>
        ) : null}
      </ScrollArea>
    </aside>
  );
}
