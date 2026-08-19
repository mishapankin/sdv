"use client";

import { useQuery } from "@tanstack/react-query";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const menus = [
  { id: "file", label: "File", accessKey: "f" },
  { id: "view", label: "View", accessKey: "v" },
  { id: "window", label: "Window", accessKey: "w" },
] as const;

function subscribe() {
  return () => {};
}

function getDesktopMenuVisibility() {
  return (
    window.sdvDesktop !== undefined &&
    window.sdvDesktop.platform !== "darwin"
  );
}

function getServerDesktopMenuVisibility() {
  return false;
}

export function DesktopMenuBar() {
  const visible = useSyncExternalStore(
    subscribe,
    getDesktopMenuVisibility,
    getServerDesktopMenuVisibility,
  );
  const controlsQuery = useQuery({
    queryKey: ["desktop-window-controls"],
    queryFn: () => window.sdvDesktop!.getWindowControls(),
    enabled: visible,
  });
  const controls = controlsQuery.data?.mode;

  useEffect(() => {
    if (!visible) return;

    document.documentElement.style.setProperty(
      "--desktop-titlebar-height",
      "32px",
    );

    return () => {
      document.documentElement.style.removeProperty(
        "--desktop-titlebar-height",
      );
    };
  }, [visible]);

  if (!visible) return null;

  function openMenu(
    menu: (typeof menus)[number]["id"],
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    const bounds = event.currentTarget.getBoundingClientRect();
    void window.sdvDesktop?.showMenu(menu, {
      x: bounds.left,
      y: bounds.bottom,
    });
  }

  function runWindowAction(action: "minimize" | "maximize" | "close") {
    void window.sdvDesktop?.windowAction(action);
  }

  const windowButtons =
    controls === "left" || controls === "right" ? (
      <div
        className={cn(
          "desktop-window-controls",
          controls === "left" ? "left-0" : "right-0",
        )}
      >
        <button
          type="button"
          aria-label="Minimize window"
          onClick={() => runWindowAction("minimize")}
        >
          <Minus />
        </button>
        <button
          type="button"
          aria-label="Maximize or restore window"
          onClick={() => runWindowAction("maximize")}
        >
          <Square />
        </button>
        <button
          type="button"
          aria-label="Close window"
          className="desktop-window-controls__close"
          onClick={() => runWindowAction("close")}
        >
          <X />
        </button>
      </div>
    ) : null;

  return (
    <div className="desktop-menu-bar" role="menubar" aria-label="Application menu">
      <div className="desktop-menu-bar__content">
        {controls === "left" ? windowButtons : null}
        <div
          className={cn(
            "flex h-full items-center px-1.5",
            controls === "left" && "ml-[138px]",
          )}
        >
          {menus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              accessKey={menu.accessKey}
              onClick={(event) => openMenu(menu.id, event)}
              className="desktop-menu-bar__trigger"
            >
              {menu.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-medium text-muted-foreground">
          SDV
        </div>
        {controls === "right" ? windowButtons : null}
      </div>
    </div>
  );
}
