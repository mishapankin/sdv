"use client";

import { Shield } from "lucide-react";

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

const riskStyles: Record<
  InspectRiskLevel,
  { label: string; shortLabel: string; className: string }
> = {
  critical: {
    label: "Critical risk",
    shortLabel: "C",
    className:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
  high: {
    label: "High risk",
    shortLabel: "H",
    className:
      "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  medium: {
    label: "Medium risk",
    shortLabel: "M",
    className:
      "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  },
  low: {
    label: "Low risk",
    shortLabel: "L",
    className:
      "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
};

export function RiskBadge({
  review,
  className,
}: {
  review: Pick<
    InspectEntityReview,
    "riskLevel" | "riskScore" | "blastRadius" | "dependentCount"
  >;
  className?: string;
}) {
  const style = riskStyles[review.riskLevel];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={style.label}
          className={cn(
            "inline-flex h-5 w-8 shrink-0 items-center justify-center gap-0.5 rounded border font-mono text-[9px] font-bold",
            style.className,
            className,
          )}
        >
          <Shield className="size-2.5" aria-hidden="true" />
          {style.shortLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="space-y-1">
        <div className="font-medium">{style.label}</div>
        <div className="font-mono text-[10px] opacity-80">
          score {review.riskScore.toFixed(2)} · blast {review.blastRadius} ·{" "}
          {review.dependentCount} dependent
          {review.dependentCount === 1 ? "" : "s"}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
