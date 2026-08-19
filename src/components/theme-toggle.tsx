"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

type Theme = "system" | "light" | "dark";

const THEME_EVENT = "sdv-theme-change";
const THEME_STORAGE_KEY = "sdv-theme";

function getTheme(): Theme {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  return storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : "system";
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function getServerTheme(): Theme {
  return "system";
}

function subscribeToDesktop() {
  return () => {};
}

function getDesktop() {
  return window.sdvDesktop !== undefined;
}

export function useTheme() {
  return useSyncExternalStore<Theme>(subscribe, getTheme, getServerTheme);
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyResolvedTheme(theme: "light" | "dark") {
  const root = document.documentElement;

  root.classList.add("theme-switching");
  root.classList.toggle("dark", theme === "dark");
  requestAnimationFrame(() => root.classList.remove("theme-switching"));
}

async function applyTheme(theme: Theme) {
  if (window.sdvDesktop) {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  window.dispatchEvent(new Event(THEME_EVENT));

  await window.sdvDesktop?.setTheme(theme);
  applyResolvedTheme(resolveTheme(theme));
}

export function ThemeSwitcher() {
  const queryClient = useQueryClient();
  const localTheme = useTheme();
  const desktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktop,
    () => false,
  );
  const desktopThemeQuery = useQuery({
    queryKey: ["desktop-theme"],
    queryFn: () => window.sdvDesktop!.getTheme(),
    enabled: desktop,
  });
  const theme = desktopThemeQuery.data ?? localTheme;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (theme === "system") {
        applyResolvedTheme(resolveTheme("system"));
      }
    };

    applyResolvedTheme(resolveTheme(theme));
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [theme]);

  async function selectTheme(nextTheme: Theme) {
    await applyTheme(nextTheme);
    if (desktop) {
      queryClient.setQueryData(["desktop-theme"], nextTheme);
    }
  }

  const themes: Theme[] = ["system", "light", "dark"];

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center rounded-lg border bg-muted/30 p-0.5"
    >
      {themes.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={theme === option}
          onClick={() => void selectTheme(option)}
          className={
            theme === option
              ? "bg-background text-foreground shadow-xs hover:bg-background"
              : "text-muted-foreground shadow-none"
          }
        >
          {option[0].toUpperCase() + option.slice(1)}
        </Button>
      ))}
    </div>
  );
}
