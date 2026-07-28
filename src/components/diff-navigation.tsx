"use client";

import type { FileDiffMetadata } from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function shouldIgnoreNavigationKey(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return true;
  }

  const target = event.target;

  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

export function useHunkNavigation(
  hunks: FileDiffMetadata["hunks"],
  codeViewRef: React.RefObject<CodeViewHandle<undefined> | null>,
  itemId: string,
) {
  const [currentHunk, setCurrentHunk] = useState(0);

  const jumpToHunk = useCallback(
    (index: number) => {
      const hunk = hunks[index];
      if (!hunk) return;

      const hasAdditions = hunk.additionCount > 0;
      codeViewRef.current?.scrollTo({
        type: "line",
        id: itemId,
        lineNumber: hasAdditions ? hunk.additionStart : hunk.deletionStart,
        side: hasAdditions ? "additions" : "deletions",
        align: "start",
        behavior: "smooth",
      });
      setCurrentHunk(index);
    },
    [codeViewRef, hunks, itemId],
  );

  return {
    currentHunk,
    hasPreviousHunk: currentHunk > 0,
    hasNextHunk: currentHunk < hunks.length - 1,
    jumpToHunk,
  };
}

export function HunkNavigation({
  hunks,
  currentHunk,
  hasPreviousHunk,
  hasNextHunk,
  jumpToHunk,
}: {
  hunks: FileDiffMetadata["hunks"];
  currentHunk: number;
  hasPreviousHunk: boolean;
  hasNextHunk: boolean;
  jumpToHunk: (index: number) => void;
}) {
  const hasMultipleHunks = hunks.length > 1;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {hasMultipleHunks ? (
        <span className="mr-1 font-mono text-[10px] text-muted-foreground">
          {currentHunk + 1}/{hunks.length}
        </span>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous hunk"
            disabled={!hasPreviousHunk}
            onClick={() => jumpToHunk(currentHunk - 1)}
          >
            <ArrowUp />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous hunk</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next hunk"
            disabled={!hasNextHunk}
            onClick={() => jumpToHunk(currentHunk + 1)}
          >
            <ArrowDown />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next hunk</TooltipContent>
      </Tooltip>
    </div>
  );
}

type DiffPaneMetrics = {
  deletionClientWidth: number;
  deletionScrollWidth: number;
  additionClientWidth: number;
  additionScrollWidth: number;
};

const EMPTY_DIFF_PANE_METRICS: DiffPaneMetrics = {
  deletionClientWidth: 0,
  deletionScrollWidth: 0,
  additionClientWidth: 0,
  additionScrollWidth: 0,
};

function findDiffScrollPanes(diffRoot: HTMLDivElement | null) {
  const diffContainer = diffRoot?.querySelector<HTMLElement>("diffs-container");
  const shadowRoot = diffContainer?.shadowRoot;

  if (!shadowRoot) return null;

  const deletionPane = shadowRoot.querySelector<HTMLElement>("[data-deletions]");
  const additionPane = shadowRoot.querySelector<HTMLElement>("[data-additions]");

  if (!deletionPane || !additionPane) return null;

  return { deletionPane, additionPane };
}

export function DiffHorizontalScrollbars({
  diffRootRef,
  syncKey,
}: {
  diffRootRef: React.RefObject<HTMLDivElement | null>;
  syncKey: string;
}) {
  const deletionProxyRef = useRef<HTMLDivElement>(null);
  const additionProxyRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<DiffPaneMetrics>(
    EMPTY_DIFF_PANE_METRICS,
  );
  const hasDeletionOverflow =
    metrics.deletionScrollWidth > metrics.deletionClientWidth + 1;
  const hasAdditionOverflow =
    metrics.additionScrollWidth > metrics.additionClientWidth + 1;
  const hasOverflow = hasDeletionOverflow || hasAdditionOverflow;

  useEffect(() => {
    let rafId = 0;
    let attempts = 0;
    let cleanup = () => {};

    function connect() {
      const panes = findDiffScrollPanes(diffRootRef.current);

      if (!panes) {
        attempts += 1;

        if (attempts < 60) {
          rafId = window.requestAnimationFrame(connect);
        }

        return;
      }

      const { deletionPane, additionPane } = panes;
      if (!deletionProxyRef.current || !additionProxyRef.current) return;

      const deletionProxy = deletionProxyRef.current;
      const additionProxy = additionProxyRef.current;

      let isSyncing = false;

      function updateMetrics() {
        setMetrics({
          deletionClientWidth: deletionPane.clientWidth,
          deletionScrollWidth: deletionPane.scrollWidth,
          additionClientWidth: additionPane.clientWidth,
          additionScrollWidth: additionPane.scrollWidth,
        });
      }

      function syncProxyFromPane(pane: HTMLElement, proxy: HTMLDivElement) {
        if (Math.abs(proxy.scrollLeft - pane.scrollLeft) > 1) {
          proxy.scrollLeft = pane.scrollLeft;
        }
      }

      function syncPaneFromProxy(proxy: HTMLDivElement, pane: HTMLElement) {
        if (Math.abs(pane.scrollLeft - proxy.scrollLeft) > 1) {
          pane.scrollLeft = proxy.scrollLeft;
        }
      }

      function handlePaneScroll() {
        if (isSyncing) return;
        isSyncing = true;
        syncProxyFromPane(deletionPane, deletionProxy);
        syncProxyFromPane(additionPane, additionProxy);
        isSyncing = false;
      }

      function handleDeletionProxyScroll() {
        if (isSyncing) return;
        isSyncing = true;
        syncPaneFromProxy(deletionProxy, deletionPane);
        isSyncing = false;
      }

      function handleAdditionProxyScroll() {
        if (isSyncing) return;
        isSyncing = true;
        syncPaneFromProxy(additionProxy, additionPane);
        isSyncing = false;
      }

      const resizeObserver = new ResizeObserver(updateMetrics);
      resizeObserver.observe(deletionPane);
      resizeObserver.observe(additionPane);
      deletionPane.addEventListener("scroll", handlePaneScroll, {
        passive: true,
      });
      additionPane.addEventListener("scroll", handlePaneScroll, {
        passive: true,
      });
      deletionProxy.addEventListener("scroll", handleDeletionProxyScroll, {
        passive: true,
      });
      additionProxy.addEventListener("scroll", handleAdditionProxyScroll, {
        passive: true,
      });
      updateMetrics();
      handlePaneScroll();

      cleanup = () => {
        resizeObserver.disconnect();
        deletionPane.removeEventListener("scroll", handlePaneScroll);
        additionPane.removeEventListener("scroll", handlePaneScroll);
        deletionProxy.removeEventListener("scroll", handleDeletionProxyScroll);
        additionProxy.removeEventListener("scroll", handleAdditionProxyScroll);
      };
    }

    rafId = window.requestAnimationFrame(connect);

    return () => {
      window.cancelAnimationFrame(rafId);
      cleanup();
    };
  }, [diffRootRef, syncKey]);

  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-2 grid grid-cols-2 gap-px rounded-md border bg-card/95 p-1 shadow-sm backdrop-blur",
        !hasOverflow &&
          "pointer-events-none mt-0 h-0 overflow-hidden border-transparent p-0 opacity-0",
      )}
    >
      <div
        ref={deletionProxyRef}
        aria-label="Scroll previous version horizontally"
        className={cn(
          "h-3 overflow-x-auto overflow-y-hidden",
          !hasDeletionOverflow && "invisible",
        )}
      >
        <div
          className="h-px"
          style={{ width: metrics.deletionScrollWidth }}
        />
      </div>
      <div
        ref={additionProxyRef}
        aria-label="Scroll current version horizontally"
        className={cn(
          "h-3 overflow-x-auto overflow-y-hidden",
          !hasAdditionOverflow && "invisible",
        )}
      >
        <div
          className="h-px"
          style={{ width: metrics.additionScrollWidth }}
        />
      </div>
    </div>
  );
}
