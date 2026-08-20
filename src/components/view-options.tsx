"use client";

import { Columns2, Rows2, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DiffLayout } from "@/components/use-viewer-url-state";
import { cn } from "@/lib/utils";

function OptionToggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-2 hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-3.5 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

export function ViewOptions({
  diffLayout,
  wrapLongLines,
  mergeModuleChanges,
  onDiffLayoutChange,
  onToggleWrapLongLines,
  onToggleModuleMerge,
}: {
  diffLayout: DiffLayout;
  wrapLongLines: boolean;
  mergeModuleChanges: boolean;
  onDiffLayoutChange: (layout: DiffLayout) => void;
  onToggleWrapLongLines: () => void;
  onToggleModuleMerge: () => void;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Open view options"
            >
              <SlidersHorizontal />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>View options</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-2">
        <div className="px-1.5 pt-1 pb-2">
          <div className="text-xs font-semibold">View options</div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Adjust how code and semantic changes are displayed.
          </p>
        </div>

        <fieldset className="border-t px-1.5 pt-2">
          <legend className="mb-1.5 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Diff layout
          </legend>
          <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5">
            {([
              ["split", "Side-by-side", Columns2],
              ["unified", "Inline", Rows2],
            ] as const).map(([layout, label, Icon]) => (
              <button
                key={layout}
                type="button"
                aria-pressed={diffLayout === layout}
                onClick={() => onDiffLayoutChange(layout)}
                className={cn(
                  "flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                  diffLayout === layout &&
                    "bg-background text-foreground shadow-xs",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-2 border-t pt-1">
          <OptionToggle
            checked={wrapLongLines}
            label="Wrap long lines"
            description="Fit long code lines within the diff pane."
            onChange={onToggleWrapLongLines}
          />
          <OptionToggle
            checked={mergeModuleChanges}
            label="Combine module-level changes"
            description="Show matching additions and deletions as one modification."
            onChange={onToggleModuleMerge}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
