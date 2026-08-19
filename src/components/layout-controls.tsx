"use client";

import { PanelLeft, PanelRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function PanelToggle({
  label,
  shortcut,
  expanded,
  disabled = false,
  disabledLabel,
  onToggle,
  children,
}: {
  label: string;
  shortcut: string;
  expanded: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            aria-pressed={disabled ? false : expanded}
            disabled={disabled}
            onClick={onToggle}
            className={cn(
              "rounded-[calc(var(--radius-md)-2px)] text-muted-foreground shadow-none",
              expanded &&
                !disabled &&
                "bg-background text-foreground shadow-xs hover:bg-background",
            )}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span>{disabled ? disabledLabel : label}</span>
        {!disabled ? (
          <kbd
            data-slot="kbd"
            className="border border-background/20 bg-background/15 px-1.5 py-0.5 font-mono text-[10px]"
          >
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function LayoutControls({
  leftExpanded,
  rightExpanded,
  rightAvailable,
  onToggleLeft,
  onToggleRight,
}: {
  leftExpanded: boolean;
  rightExpanded: boolean;
  rightAvailable: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Layout controls"
      className="flex h-8 shrink-0 items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
    >
      <PanelToggle
        label="Toggle file sidebar"
        shortcut="⌘/Ctrl B"
        expanded={leftExpanded}
        onToggle={onToggleLeft}
      >
        <PanelLeft />
      </PanelToggle>
      <PanelToggle
        label="Toggle semantic sidebar"
        shortcut="⌘/Ctrl Alt B"
        expanded={rightExpanded}
        disabled={!rightAvailable}
        disabledLabel="Semantic sidebar unavailable for this file"
        onToggle={onToggleRight}
      >
        <PanelRight />
      </PanelToggle>
    </div>
  );
}
