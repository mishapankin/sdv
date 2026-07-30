"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Theme = "light" | "dark";

const THEME_EVENT = "sdv-theme-change";
const THEME_STORAGE_KEY = "sdv-theme";

function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function getServerTheme(): Theme {
  return "light";
}

export function useTheme() {
  return useSyncExternalStore<Theme>(subscribe, getTheme, getServerTheme);
}

export function ThemeToggle() {
  const theme = useTheme();

  useEffect(() => {
    void window.sdvDesktop?.setTheme(getTheme());
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;

    root.classList.add("theme-switching");
    root.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    void window.sdvDesktop?.setTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
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
