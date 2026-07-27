"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChangeType } from "@/lib/sem-types";
import { cn } from "@/lib/utils";

export const changeStyles: Record<
  ChangeType,
  { label: string; shortLabel: string; className: string }
> = {
  added: {
    label: "Added",
    shortLabel: "A",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  modified: {
    label: "Modified",
    shortLabel: "M",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  deleted: {
    label: "Deleted",
    shortLabel: "D",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  moved: {
    label: "Moved",
    shortLabel: "V",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  renamed: {
    label: "Renamed",
    shortLabel: "R",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  reordered: {
    label: "Reordered",
    shortLabel: "O",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  },
};

export function ChangeBadge({ changeType }: { changeType: ChangeType }) {
  const style = changeStyles[changeType];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={style.label}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-bold",
            style.className,
          )}
        >
          {style.shortLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{style.label}</TooltipContent>
    </Tooltip>
  );
}
