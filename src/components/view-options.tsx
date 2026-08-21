"use client";

import {
  CircleHelp,
  Columns2,
  Rows2,
  SlidersHorizontal,
} from "lucide-react";
import { useId } from "react";

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
  const inputId = useId();

  return (
    <div className="flex h-8 items-center gap-2 rounded-md px-1.5 hover:bg-muted/60">
      <input
        id={inputId}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="size-3.5 accent-primary"
      />
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer text-xs font-medium">
        {label}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${label}`}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <CircleHelp className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6} className="max-w-60">
          {description}
        </TooltipContent>
      </Tooltip>
    </div>
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
              variant="ghost"
              aria-label="Open view options"
            >
              <SlidersHorizontal />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>View options</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="w-64 p-2">
        <div className="px-1.5 pt-1 pb-2">
          <div className="text-sm font-semibold">View options</div>
        </div>

        <fieldset className="border-t px-1.5 pt-2">
          <legend className="mb-2 text-[11px] font-semibold text-foreground">
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
