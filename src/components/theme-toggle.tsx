"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Theme = "light" | "dark";

const THEME_EVENT = "sdv-theme-change";
const THEME_STORAGE_KEY = "sdv-theme";
const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";

function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function subscribe(onChange: () => void) {
  const colorScheme = window.matchMedia(DARK_THEME_QUERY);

  function handleSystemThemeChange(event: MediaQueryListEvent) {
    if (getStoredTheme() !== null) return;
    applyTheme(event.matches ? "dark" : "light");
    onChange();
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    const storedTheme = getStoredTheme();
    applyTheme(
      storedTheme ?? (colorScheme.matches ? "dark" : "light"),
    );
    onChange();
  }

  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", handleStorageChange);
  colorScheme.addEventListener("change", handleSystemThemeChange);

  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", handleStorageChange);
    colorScheme.removeEventListener("change", handleSystemThemeChange);
  };
}

function getServerTheme(): Theme {
  return "light";
}

export function useTheme() {
  return useSyncExternalStore<Theme>(subscribe, getTheme, getServerTheme);
}

export function ThemeToggle() {
  const theme = useTheme();

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Switch to {theme === "dark" ? "light" : "dark"} theme
      </TooltipContent>
    </Tooltip>
  );
}
