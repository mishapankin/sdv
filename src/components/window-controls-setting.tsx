"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WindowControlsMode = "native" | "left" | "right" | "hidden";

const options: Array<{ value: WindowControlsMode; label: string }> = [
  { value: "native", label: "Native decorations" },
  { value: "left", label: "Controls on left" },
  { value: "right", label: "Controls on right" },
  { value: "hidden", label: "No window controls" },
];

function subscribe() {
  return () => {};
}

function isConfigurableDesktop() {
  return (
    window.sdvDesktop !== undefined &&
    window.sdvDesktop.platform !== "darwin"
  );
}

export function WindowControlsSetting() {
  const enabled = useSyncExternalStore(
    subscribe,
    isConfigurableDesktop,
    () => false,
  );
  const query = useQuery({
    queryKey: ["desktop-window-controls"],
    queryFn: () => window.sdvDesktop!.getWindowControls(),
    enabled,
  });

  if (!enabled || !query.data) return null;

  const description =
    query.data.platform === "linux"
      ? "Native follows your window manager and is the default on Linux."
      : "Right-side controls are the default on Windows.";

  function changeMode(value: string) {
    const mode = value as WindowControlsMode;
    void window.sdvDesktop?.setWindowControls(mode);
  }

  return (
    <div className="border-t py-3">
      <div className="flex items-center justify-between gap-4">
        <label className="text-xs font-medium" htmlFor="window-controls">
          Window controls
        </label>
        <Select value={query.data.mode} onValueChange={changeMode}>
          <SelectTrigger id="window-controls" size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                {option.value === query.data.defaultMode ? " (default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
