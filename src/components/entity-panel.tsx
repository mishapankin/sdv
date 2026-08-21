"use client";

import { FileCode2 } from "lucide-react";

import { ChangeIndicator } from "@/components/change-badge";
import { EntityIcon } from "@/components/entity-icons";
import { EntityMetadataTooltip } from "@/components/entity-metadata-tooltip";
import { RiskDots } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileGroup } from "@/lib/group-changes";
import { indexInspectReviews } from "@/lib/inspect-view-model";
import type { InspectEntityReview } from "@/lib/inspect-types";
import { cn } from "@/lib/utils";

export function SemanticUnavailablePanel() {
  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar/60">
      <div className="flex h-12 shrink-0 items-center border-b px-3">
        <span className="text-xs font-semibold text-foreground">
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
            className="font-mono text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
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
  inspectReviews,
  selectedEntityId,
  onSelectFullFile,
  onSelectEntity,
}: {
  fileGroup: FileGroup;
  inspectReviews: InspectEntityReview[];
  selectedEntityId?: string;
  onSelectFullFile: () => void;
  onSelectEntity: (entityId: string) => void;
}) {
  const reviewsByEntityId = indexInspectReviews(inspectReviews);
  const isFullFileSelected = selectedEntityId === undefined;
  const selectedRowClass =
    "bg-primary/10 text-foreground shadow-xs ring-1 ring-inset ring-primary/20 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary";

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar/60">
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-semibold text-foreground">
          Semantic entities
        </span>
        <Badge
          variant="secondary"
          className="h-5 rounded-md px-1.5 text-[10px] tabular-nums"
        >
          {fileGroup.changes.length}
        </Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label={`Views and changes in ${fileGroup.filePath}`}
          className="pb-3"
        >
          <button
            type="button"
            onClick={onSelectFullFile}
            aria-current={isFullFileSelected ? "page" : undefined}
            className={cn(
              "relative mx-2 flex h-9 w-[calc(100%_-_1rem)] items-center gap-2 rounded-md px-2.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
              isFullFileSelected && selectedRowClass,
            )}
          >
            <FileCode2
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                isFullFileSelected && "text-primary",
              )}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              Full file diff
            </span>
          </button>

          {fileGroup.changes.map((change) => {
            const review = reviewsByEntityId.get(change.entityId);

            return (
              <EntityMetadataTooltip
                key={change.entityId}
                change={change}
                inspectReview={review}
              >
                <button
                  type="button"
                  onClick={() => onSelectEntity(change.entityId)}
                  aria-current={
                    selectedEntityId === change.entityId ? "page" : undefined
                  }
                  className={cn(
                    "relative ml-2 grid h-9 w-[calc(100%_-_0.5rem)] grid-cols-[1rem_minmax(0,1fr)_1.25rem] items-center gap-x-2 overflow-hidden rounded-l-md rounded-r-none pr-3 pl-2.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                    selectedEntityId === change.entityId && selectedRowClass,
                  )}
                >
                  <EntityIcon
                    entityType={change.entityType}
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground",
                      selectedEntityId === change.entityId && "text-primary",
                    )}
                  />
                  <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                    <span className="truncate text-xs font-medium">
                      {change.entityName || "(anonymous)"}
                    </span>
                    {review ? (
                      <RiskDots riskLevel={review.riskLevel} />
                    ) : null}
                  </span>
                  <span className="flex w-5 items-center justify-end">
                    <ChangeIndicator changeType={change.changeType} />
                  </span>
                </button>
              </EntityMetadataTooltip>
            );
          })}
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
