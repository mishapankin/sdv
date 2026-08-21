"use client";

import type { CodeViewHandle } from "@pierre/diffs/react";
import {
  ArrowRight,
  Maximize2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { DiffCodeView } from "@/components/diff-code-view";
import {
  HunkNavigation,
  shouldIgnoreNavigationKey,
  useHunkNavigation,
} from "@/components/diff-navigation";
import { EntityIcon } from "@/components/entity-icons";
import { EntityMetadataTooltip } from "@/components/entity-metadata-tooltip";
import { RiskDots } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { createEntityFileDiff } from "@/lib/entity-metadata";
import type { DiffLineTarget } from "@/lib/diff-selection";
import type { DiffLayout } from "@/components/use-viewer-url-state";
import type { InspectEntityReview } from "@/lib/inspect-types";
import type { SemanticChange } from "@/lib/sem-types";

export function EntityDiffView({
  change,
  inspectReview,
  renderVersion,
  onPreviousEntity,
  onNextEntity,
  onViewInContext,
  diffLayout,
  wrapLongLines,
}: {
  change: SemanticChange;
  inspectReview?: InspectEntityReview;
  renderVersion: string;
  onPreviousEntity?: () => void;
  onNextEntity?: () => void;
  onViewInContext: (target?: DiffLineTarget) => void;
  diffLayout: DiffLayout;
  wrapLongLines: boolean;
}) {
  const fileDiff = useMemo(
    () => createEntityFileDiff(change, renderVersion),
    [change, renderVersion],
  );
  const itemId = `entity:${change.entityId}`;
  const codeViewRef = useRef<CodeViewHandle<undefined>>(null);
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(
    fileDiff.hunks,
    codeViewRef,
    itemId,
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
      <header className="shrink-0 border-b bg-card">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-2.5">
          <div className="min-w-0">
            <EntityMetadataTooltip
              change={change}
              inspectReview={inspectReview}
              side="bottom"
            >
              <div
                tabIndex={0}
                className="flex w-fit max-w-full items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <EntityIcon
                  entityType={change.entityType}
                  className="size-5 shrink-0 text-foreground"
                />
                <h1 className="truncate text-base font-semibold tracking-tight">
                  {change.entityName || "(anonymous)"}
                </h1>
                {inspectReview ? (
                  <RiskDots riskLevel={inspectReview.riskLevel} />
                ) : null}
                {inspectReview?.publicApi ? (
                  <ShieldCheck
                    className="size-3.5 shrink-0 text-orange-700 dark:text-orange-300"
                    aria-label="Public API"
                  />
                ) : null}
              </div>
            </EntityMetadataTooltip>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const lineNumber = change.startLine ?? change.oldStartLine;

                onViewInContext(
                  lineNumber
                    ? {
                        lineNumber,
                        side:
                          change.startLine != null
                            ? "additions"
                            : "deletions",
                      }
                    : undefined,
                );
              }}
            >
              <Maximize2 />
              View in context
            </Button>
            <HunkNavigation
              hunks={fileDiff.hunks}
              {...hunkNavigation}
            />
          </div>
        </div>

      </header>

      <DiffCodeView
        codeViewRef={codeViewRef}
        containerRef={diffRootRef}
        fileDiff={fileDiff}
        itemId={itemId}
        syncKey={`${change.entityId}:${renderVersion}`}
        diffLayout={diffLayout}
        wrapLongLines={wrapLongLines}
      />
    </main>
  );
}
