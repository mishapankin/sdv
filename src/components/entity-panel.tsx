"use client";

import { FileCode2 } from "lucide-react";

import { ChangeBadge } from "@/components/change-badge";
import { EntityIcon } from "@/components/entity-icons";
import { FileTypeIcon } from "@/components/file-type-icon";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileGroup } from "@/lib/group-changes";
import { cn } from "@/lib/utils";

export function SemanticUnavailablePanel() {
  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar/60">
      <div className="flex h-12 shrink-0 items-center border-b px-3">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Semantic analysis
        </span>
      </div>
      <div className="flex flex-1 items-center px-4">
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="block font-medium text-foreground">
            Semantic analysis is unavailable
          </span>
          Install{" "}
          <a
            href="https://github.com/ataraxy-labs/sem"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sky-700 underline decoration-sky-700/30 underline-offset-2 hover:decoration-sky-700 dark:text-sky-300 dark:decoration-sky-300/30 dark:hover:decoration-sky-300"
          >
            sem
          </a>{" "}
          to <code className="font-mono text-foreground">$PATH</code> to
          enable it
        </p>
      </div>
    </aside>
  );
}

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
  const isFullFileSelected = selectedEntityId === undefined;
  const selectedRowClass =
    "bg-sky-500/10 text-foreground shadow-xs ring-1 ring-inset ring-sky-600/20 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-600 dark:bg-sky-400/10 dark:ring-sky-400/25 dark:before:bg-sky-400";

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
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label={`Views and changes in ${fileGroup.filePath}`}
          className="py-3"
        >
          <div className="px-3 pb-1.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            File view
          </div>
          <button
            type="button"
            onClick={onSelectFullFile}
            aria-current={isFullFileSelected ? "page" : undefined}
            className={cn(
              "relative mx-2 flex h-12 w-[calc(100%_-_1rem)] items-center gap-2 rounded-md px-2.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
              isFullFileSelected && selectedRowClass,
            )}
          >
            <FileCode2
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                isFullFileSelected &&
                  "text-sky-700 dark:text-sky-300",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                Full file diff
              </span>
              <span className="block font-mono text-[9px] leading-3 text-muted-foreground">
                Git patch
              </span>
            </span>
          </button>

          <div className="mt-3 flex items-center justify-between border-t px-3 pt-3 pb-1.5">
            <span className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Semantic entities
            </span>
            <Badge
              variant="secondary"
              className="h-5 rounded-md px-1.5 font-mono text-[9px]"
            >
              {fileGroup.changes.length}
            </Badge>
          </div>

          {fileGroup.changes.map((change) => (
            <button
              key={change.entityId}
              type="button"
              onClick={() => onSelectEntity(change.entityId)}
              aria-current={
                selectedEntityId === change.entityId ? "page" : undefined
              }
              className={cn(
                "relative mx-2 flex h-11 w-[calc(100%_-_1rem)] items-center gap-2 rounded-md px-2.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                selectedEntityId === change.entityId &&
                  selectedRowClass,
              )}
              title={`${change.entityType}: ${change.entityName || "(anonymous)"}`}
            >
              <EntityIcon
                entityType={change.entityType}
                className={cn(
                  "size-4 shrink-0 text-muted-foreground",
                  selectedEntityId === change.entityId &&
                    "text-sky-700 dark:text-sky-300",
                )}
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
          <p className="px-3 py-3 text-xs leading-5 text-muted-foreground">
            No semantic entity changes were reported for this file.
          </p>
        ) : null}
      </ScrollArea>
    </aside>
  );
}
