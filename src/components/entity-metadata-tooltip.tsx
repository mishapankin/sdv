import type { ReactNode } from "react";

import {
  ChangeIndicator,
  changeStyles,
} from "@/components/change-badge";
import { EntityIcon } from "@/components/entity-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatLineRange,
  getEntityLineStats,
} from "@/lib/entity-metadata";
import { formatInspectClassification } from "@/lib/inspect-view-model";
import type { InspectEntityReview } from "@/lib/inspect-types";
import type { SemanticChange } from "@/lib/sem-types";

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  );
}

export function EntityMetadataTooltip({
  change,
  inspectReview,
  children,
  side = "left",
}: {
  change: SemanticChange;
  inspectReview?: InspectEntityReview;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const currentRange = formatLineRange(change.startLine, change.endLine);
  const previousRange = formatLineRange(
    change.oldStartLine,
    change.oldEndLine,
  );
  const stats = getEntityLineStats(change);
  const flags = [
    inspectReview?.publicApi ? "Public API" : null,
    change.structuralChange === false
      ? "Cosmetic"
      : change.structuralChange === true
        ? "Structural"
        : null,
  ].filter(Boolean);

  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        arrowClassName="bg-popover fill-popover"
        className="w-80 max-w-none flex-col items-stretch gap-0 overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border bg-muted/25 px-3.5 py-3">
          <EntityIcon entityType={change.entityType} className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {change.entityName || "(anonymous)"}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-1.5 py-1 text-[10px] font-medium">
            <ChangeIndicator changeType={change.changeType} />
            {changeStyles[change.changeType].label}
          </span>
        </div>

        <div className="space-y-2 px-3.5 py-3 text-[11px] leading-4">
          <div className="mb-2 text-xs font-semibold text-foreground">
            Location
          </div>
          <MetadataRow label="Type">{change.entityType}</MetadataRow>
          <MetadataRow label="Current">
            <span className="break-all font-mono text-[10px]">
              {change.filePath}
              {currentRange ? <> · {currentRange}</> : null}
            </span>
          </MetadataRow>
          {previousRange || change.oldFilePath ? (
            <MetadataRow label="Previous">
              <span className="break-all font-mono text-[10px]">
                {change.oldFilePath || change.filePath}
                {previousRange ? <> · {previousRange}</> : null}
              </span>
            </MetadataRow>
          ) : null}
          <MetadataRow label="Changes">
            {stats.additions === 0 && stats.deletions === 0 ? (
              <span className="text-muted-foreground">No line changes</span>
            ) : (
              <span className="font-mono text-[10px] tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">
                  +{stats.additions}
                </span>{" "}
                <span className="text-rose-700 dark:text-rose-400">
                  −{stats.deletions}
                </span>
              </span>
            )}
          </MetadataRow>
        </div>

        {inspectReview ? (
          <div className="space-y-2 border-t border-border px-3.5 py-3 text-[11px] leading-4">
            <div className="mb-2 text-xs font-semibold text-foreground">
              Analysis
            </div>
            <MetadataRow label="Class">
              {formatInspectClassification(inspectReview.classification)}
            </MetadataRow>
            <MetadataRow label="Risk">
              <span className="capitalize">{inspectReview.riskLevel}</span> ·{" "}
              <span className="font-mono text-[10px] tabular-nums">
                {inspectReview.riskScore.toFixed(2)}
              </span>
            </MetadataRow>
            <MetadataRow label="Impact">
              {inspectReview.blastRadius} blast · {inspectReview.dependentCount}{" "}
              dependent{inspectReview.dependentCount === 1 ? "" : "s"} ·{" "}
              {inspectReview.dependencyCount} dependencies
            </MetadataRow>
            {flags.length > 0 ? (
              <MetadataRow label="Flags">{flags.join(" · ")}</MetadataRow>
            ) : null}
            {inspectReview.groupLabel ? (
              <MetadataRow label="Group">{inspectReview.groupLabel}</MetadataRow>
            ) : null}
          </div>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
