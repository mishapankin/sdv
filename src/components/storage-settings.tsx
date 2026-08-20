"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, CircleHelp, Copy } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function subscribe() {
  return () => {};
}

function isDesktop() {
  return window.sdvDesktop !== undefined;
}

export function StorageSettings() {
  const enabled = useSyncExternalStore(subscribe, isDesktop, () => false);
  const pathQuery = useQuery({
    queryKey: ["desktop-settings-path"],
    queryFn: () => window.sdvDesktop!.getSettingsPath(),
    enabled,
  });
  const [copied, setCopied] = useState(false);
  const feedbackTimer = useRef<number>(undefined);

  if (!enabled || !pathQuery.data) return null;

  async function copyPath() {
    await window.sdvDesktop!.copySettingsPath();
    setCopied(true);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section aria-labelledby="storage-heading" className="mt-12">
      <div className="flex items-center gap-1.5">
        <h2 id="storage-heading" className="text-base font-semibold">
          Storage
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="About storage settings"
            >
              <CircleHelp className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            Files SDV stores on this device.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-5 border-y">
        <div className="flex min-h-16 items-center gap-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">Settings file</div>
            <code
              className="mt-1 block truncate font-mono text-[11px] text-muted-foreground"
              title={pathQuery.data}
            >
              {pathQuery.data}
            </code>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void copyPath()}
            aria-label="Copy settings file path"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}
