"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  InspectEntityReview,
  InspectRiskLevel,
} from "@/lib/inspect-types";
import { cn } from "@/lib/utils";

const riskLevels: InspectRiskLevel[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const riskMeterColors: Record<InspectRiskLevel, string> = {
  low: "bg-emerald-500 dark:bg-emerald-400",
  medium: "bg-amber-500 dark:bg-amber-400",
  high: "bg-red-500 dark:bg-red-400",
  critical: "bg-red-700 dark:bg-red-500",
};

function RiskDotScale({
  riskLevel,
  compact = false,
}: {
  riskLevel: InspectRiskLevel;
  compact?: boolean;
}) {
  const activeCount = riskLevels.indexOf(riskLevel) + 1;

  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {riskLevels.map((level, index) => (
        <span
          key={level}
          className={cn(
            "rounded-full",
            compact ? "size-[5px]" : "size-1.5",
            index < activeCount
              ? riskMeterColors[riskLevel]
              : "bg-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

export function RiskDots({
  review,
  className,
}: {
  review: Pick<
    InspectEntityReview,
    "riskLevel" | "riskScore" | "blastRadius" | "dependentCount"
  >;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`${review.riskLevel} risk`}
          className={cn("inline-flex shrink-0", className)}
        >
          <RiskDotScale riskLevel={review.riskLevel} compact />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="flex-col items-start gap-0.5 px-2.5 py-2"
      >
        <span className="font-medium capitalize">
          {review.riskLevel} risk · score {review.riskScore.toFixed(2)}
        </span>
        <span className="font-mono text-[10px] opacity-75">
          blast {review.blastRadius} · {review.dependentCount} dependent
          {review.dependentCount === 1 ? "" : "s"}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function RiskMeter({
  riskLevel,
  className,
}: {
  riskLevel: InspectRiskLevel;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${riskLevel} risk`}
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-muted-foreground",
        className,
      )}
    >
      <span>risk</span>
      <RiskDotScale riskLevel={riskLevel} />
    </span>
  );
}
