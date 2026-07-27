"use client";

import {
  parseDiffFromFile,
  type FileDiffMetadata,
} from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CirclePlus,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitCompareArrows,
  GitMerge,
  LoaderCircle,
  Minus,
  RefreshCw,
  RotateCcw,
  SearchX,
  Sparkles,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getFileDiff,
  getRecentCommits,
  getSemanticDiff,
  getWorkspaceRepositories,
} from "@/app/actions";
import { EntityIcon } from "@/components/entity-icons";
import { ThemeToggle, useTheme } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ChangeType,
  Comparison,
  FileOnlyChange,
  GitCommit,
  SemanticChange,
  WorkspaceRepository,
} from "@/lib/sem-types";
import { groupByFile, hasFileInDiff } from "@/lib/group-changes";
import { mergeModuleLevelChanges } from "@/lib/merge-module-changes";
import { cn } from "@/lib/utils";

const changeStyles: Record<
  ChangeType,
  { label: string; shortLabel: string; className: string }
> = {
  added: {
    label: "Added",
    shortLabel: "A",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  modified: {
    label: "Modified",
    shortLabel: "M",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  deleted: {
    label: "Deleted",
    shortLabel: "D",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  moved: {
    label: "Moved",
    shortLabel: "V",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  renamed: {
    label: "Renamed",
    shortLabel: "R",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  reordered: {
    label: "Reordered",
    shortLabel: "O",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  },
};

const EMPTY_FILE_CHANGES: FileOnlyChange[] = [];

function getComparisonFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): Comparison {
  const mode = searchParams.get("mode");

  if (mode === "staged") {
    return { mode: "staged" };
  }

  if (mode === "commits") {
    return {
      mode: "commits",
      from: searchParams.get("from") || "HEAD~1",
      to: searchParams.get("to") || "HEAD",
    };
  }

  return { mode: "changed" };
}

function getComparisonLabel(comparison: Comparison) {
  if (comparison.mode === "staged") return "Staged";
  if (comparison.mode === "commits") {
    return `${comparison.from} → ${comparison.to}`;
  }
  return "Changed";
}

function getSemCommand(comparison: Comparison) {
  if (comparison.mode === "staged") {
    return "sem diff --staged --verbose --format json";
  }

  if (comparison.mode === "commits") {
    return `sem diff --from ${comparison.from} --to ${comparison.to} --verbose --format json`;
  }

  return "sem diff HEAD --verbose --format json";
}

function CommitSuggestions({
  id,
  commits,
}: {
  id: string;
  commits: GitCommit[];
}) {
  return (
    <datalist id={id}>
      {commits.map((commit) => (
        <option
          key={commit.hash}
          value={commit.shortHash}
          label={`${commit.subject} · ${commit.relativeDate}${commit.refs ? ` · ${commit.refs}` : ""}`}
        />
      ))}
    </datalist>
  );
}

function ComparisonSelector({
  comparison,
  commits,
  onModeChange,
  onCompare,
}: {
  comparison: Comparison;
  commits: GitCommit[];
  onModeChange: (mode: Comparison["mode"]) => void;
  onCompare: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(
    comparison.mode === "commits" ? comparison.from : "HEAD~1",
  );
  const [to, setTo] = useState(
    comparison.mode === "commits" ? comparison.to : "HEAD",
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={comparison.mode}
        onValueChange={(value) =>
          onModeChange(value as Comparison["mode"])
        }
      >
        <SelectTrigger
          size="sm"
          aria-label="Changes to view"
          className="w-[150px] bg-background"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="changed">Changed</SelectItem>
          <SelectItem value="staged">Staged</SelectItem>
          <SelectItem value="commits">Compare refs</SelectItem>
        </SelectContent>
      </Select>

      {comparison.mode === "commits" ? (
        <form
          className="flex min-w-0 items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (from.trim() && to.trim()) {
              onCompare(from.trim(), to.trim());
            }
          }}
        >
          <Input
            list="sdv-from-commits"
            aria-label="Base commit"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            placeholder="Base ref"
            className="h-7 w-32 font-mono text-xs"
          />
          <span className="text-xs text-muted-foreground">...</span>
          <Input
            list="sdv-to-commits"
            aria-label="Head commit"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="Head ref"
            className="h-7 w-32 font-mono text-xs"
          />
          <CommitSuggestions id="sdv-from-commits" commits={commits} />
          <CommitSuggestions id="sdv-to-commits" commits={commits} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!from.trim() || !to.trim()}
          >
            Compare
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function createEntityFileDiff(
  change: SemanticChange,
  renderVersion: string,
): FileDiffMetadata {
  const oldName = change.oldFilePath || change.filePath;
  const oldFile = {
    name: oldName,
    contents: change.beforeContent ?? "",
    cacheKey: `${change.entityId}:${renderVersion}:before`,
  };
  const newFile = {
    name: change.filePath,
    contents: change.afterContent ?? "",
    cacheKey: `${change.entityId}:${renderVersion}:after`,
  };
  const fileDiff = parseDiffFromFile(oldFile, newFile, {
    context: 3,
  });
  const oldOffset = Math.max((change.oldStartLine ?? 1) - 1, 0);
  const newOffset = Math.max((change.startLine ?? 1) - 1, 0);

  for (const hunk of fileDiff.hunks) {
    hunk.deletionStart += oldOffset;
    hunk.additionStart += newOffset;
    hunk.hunkSpecs = `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`;
  }

  return fileDiff;
}

function ChangeBadge({ changeType }: { changeType: ChangeType }) {
  const style = changeStyles[changeType];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={style.label}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-bold",
            style.className,
          )}
        >
          {style.shortLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{style.label}</TooltipContent>
    </Tooltip>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "negative";
}) {
  if (!value) return null;

  return (
    <span
      className={cn(
        "font-mono text-xs",
        tone === "positive" && "text-emerald-700",
        tone === "negative" && "text-rose-700",
        !tone && "text-muted-foreground",
      )}
    >
      {value} {label}
    </span>
  );
}

function RepositoryRail({
  workspaceName,
  repositories,
  selectedRepoId,
  onSelectRepo,
  onRefreshAll,
  isRefreshing,
}: {
  workspaceName: string;
  repositories: WorkspaceRepository[];
  selectedRepoId?: string;
  onSelectRepo: (repoId: string) => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}) {
  const dirtyCount = repositories.filter((repo) => repo.hasChanges).length;

  return (
    <aside className="flex h-full w-[286px] shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-semibold">
              {workspaceName}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {dirtyCount}/{repositories.length} changed
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Refresh all repositories"
              onClick={onRefreshAll}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn(isRefreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh all repositories</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Workspace repositories" className="space-y-1 p-2">
          {repositories.map((repo) => {
            const repoLabel =
              repo.relativePath === "." ? repo.name : repo.relativePath;

            return (
              <button
                key={repo.id}
                type="button"
                onClick={() => onSelectRepo(repo.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                  selectedRepoId === repo.id
                    ? "border-border bg-card shadow-xs"
                    : "border-transparent hover:bg-sidebar-accent",
                )}
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border",
                    repo.error
                      ? "border-rose-500 bg-rose-500"
                      : repo.hasChanges
                        ? "border-amber-500 bg-amber-500"
                        : "border-emerald-600 bg-emerald-600",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-medium"
                    title={repoLabel}
                  >
                    {repoLabel}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate font-mono text-[10px] text-muted-foreground">
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate">{repo.branchName}</span>
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-5 min-w-5 shrink-0 items-center justify-center rounded border px-1 font-mono text-[10px] font-bold",
                    repo.error
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                      : repo.hasChanges
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                  )}
                  title={
                    repo.error
                      ? repo.error
                      : `${repo.changedFileCount} changed files`
                  }
                >
                  {repo.error ? "!" : repo.changedFileCount}
                </span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function shouldIgnoreNavigationKey(event: KeyboardEvent) {
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

function useHunkNavigation(
  hunks: FileDiffMetadata["hunks"],
  diffRootRef: React.RefObject<HTMLDivElement | null>,
) {
  const [currentHunk, setCurrentHunk] = useState(0);

  const jumpToHunk = useCallback(
    (index: number) => {
      const hunk = hunks[index];
      const diffContainer =
        diffRootRef.current?.querySelector<HTMLElement>("diffs-container");
      const shadowRoot = diffContainer?.shadowRoot;

      if (!hunk || !shadowRoot) return;

      const lineNumber =
        hunk.additionStart > 0 ? hunk.additionStart : hunk.deletionStart;
      const line =
        shadowRoot.querySelector<HTMLElement>(
          `[data-line="${lineNumber}"]`,
        ) ??
        shadowRoot.querySelector<HTMLElement>(
          `[data-column-number="${lineNumber}"]`,
        );

      if (!line) return;

      line.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentHunk(index);
    },
    [diffRootRef, hunks],
  );

  return {
    currentHunk,
    hasPreviousHunk: currentHunk > 0,
    hasNextHunk: currentHunk < hunks.length - 1,
    jumpToHunk,
  };
}

function HunkNavigation({
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

function DiffHorizontalScrollbars({
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

function Sidebar({
  changes,
  fileChanges,
  selectedEntityId,
  selectedFilePath,
  onSelectEntity,
  onSelectFile,
}: {
  changes: SemanticChange[];
  fileChanges: FileOnlyChange[];
  selectedEntityId?: string;
  selectedFilePath?: string;
  onSelectEntity: (entityId: string) => void;
  onSelectFile: (filePath: string) => void;
}) {
  const fileGroups = useMemo(
    () => groupByFile(changes, fileChanges),
    [changes, fileChanges],
  );

  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Changed files
          </span>
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-1.5 font-mono text-[10px]"
          >
            {fileGroups.length}
          </Badge>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {changes.length} entities
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Changed semantic entities" className="py-2">
          {fileGroups.map((group) => (
            <details key={group.filePath} className="group/file mb-1">
              <summary
                className={cn(
                  "flex h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium transition-colors select-none hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
                  selectedFilePath === group.filePath &&
                    "bg-card text-foreground shadow-xs",
                )}
              >
                <ChevronDown className="size-3.5 shrink-0 -rotate-90 text-muted-foreground transition-transform group-open/file:rotate-0" />
                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                <ChangeBadge changeType={group.changeType} />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left hover:underline hover:underline-offset-2 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  title={
                    group.oldFilePath
                      ? `View full diff for ${group.oldFilePath} → ${group.filePath}`
                      : `View full diff for ${group.filePath}`
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFile(group.filePath);
                  }}
                >
                  {group.oldFilePath ? (
                    <>
                      <span className="text-muted-foreground">
                        {group.oldFilePath}
                      </span>{" "}
                      <span aria-hidden="true">→</span>{" "}
                    </>
                  ) : null}
                  {group.filePath}
                </button>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {group.changes.length}
                </span>
              </summary>
              <div className="space-y-0.5 pr-1.5 pl-12">
                {group.fileChange && group.changes.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelectFile(group.filePath)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-colors",
                      selectedFilePath === group.filePath
                        ? "border-border bg-card shadow-xs"
                        : "hover:bg-sidebar-accent",
                    )}
                  >
                    <FileCode2
                      className={cn(
                        "size-4 shrink-0",
                        selectedFilePath === group.filePath
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {group.fileChange.changeType === "binary"
                          ? "Binary file"
                          : "Untracked file"}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {group.fileChange.fileStatus}
                      </span>
                    </span>
                    <ChangeBadge changeType={group.changeType} />
                  </button>
                ) : null}
                {group.changes.map((change) => (
                  <button
                    key={change.entityId}
                    type="button"
                    onClick={() => onSelectEntity(change.entityId)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-colors",
                      selectedEntityId === change.entityId
                        ? "border-border bg-card shadow-xs"
                        : "hover:bg-sidebar-accent",
                    )}
                  >
                    <EntityIcon
                      entityType={change.entityType}
                      className={cn(
                        "size-4 shrink-0",
                        selectedEntityId === change.entityId
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {change.entityName || "(anonymous)"}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {change.entityType}
                        {change.startLine ? ` · L${change.startLine}` : ""}
                      </span>
                    </span>
                    <ChangeBadge changeType={change.changeType} />
                  </button>
                ))}
              </div>
            </details>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function EntityDiff({
  change,
  theme,
  renderVersion,
  onPreviousEntity,
  onNextEntity,
}: {
  change: SemanticChange;
  theme: "light" | "dark";
  renderVersion: string;
  onPreviousEntity?: () => void;
  onNextEntity?: () => void;
}) {
  const status = changeStyles[change.changeType];
  const fileDiff = useMemo(
    () => createEntityFileDiff(change, renderVersion),
    [change, renderVersion],
  );
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(
    fileDiff.hunks,
    diffRootRef,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreNavigationKey(event)) return;

      if (
        (event.key === "ArrowLeft" || event.key === "h") &&
        onPreviousEntity
      ) {
        event.preventDefault();
        onPreviousEntity();
        return;
      }

      if (
        (event.key === "ArrowRight" || event.key === "l") &&
        onNextEntity
      ) {
        event.preventDefault();
        onNextEntity();
        return;
      }

      if (
        (event.key === "ArrowUp" || event.key === "k") &&
        hunkNavigation.hasPreviousHunk
      ) {
        event.preventDefault();
        hunkNavigation.jumpToHunk(hunkNavigation.currentHunk - 1);
        return;
      }

      if (
        (event.key === "ArrowDown" || event.key === "j") &&
        hunkNavigation.hasNextHunk
      ) {
        event.preventDefault();
        hunkNavigation.jumpToHunk(hunkNavigation.currentHunk + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hunkNavigation, onNextEntity, onPreviousEntity]);

  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <EntityIcon
              entityType={change.entityType}
              className="size-5 text-foreground"
            />
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {change.entityName || "(anonymous)"}
            </h1>
            <Badge
              variant="outline"
              className="rounded-md font-mono text-[10px] tracking-wide uppercase"
            >
              {change.entityType}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md text-[10px] uppercase",
                status.className,
              )}
            >
              {status.label}
            </Badge>
          </div>
          <div className="mt-1.5 flex items-center gap-2 truncate font-mono text-xs text-muted-foreground">
            {change.oldFilePath && change.oldFilePath !== change.filePath ? (
              <>
                <span className="truncate">{change.oldFilePath}</span>
                <ArrowRight className="size-3 shrink-0" />
              </>
            ) : null}
            <span className="truncate">{change.filePath}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          {change.structuralChange === false ? (
            <span className="hidden items-center gap-1.5 xl:flex">
              <Sparkles className="size-3.5" />
              cosmetic
            </span>
          ) : null}
          <HunkNavigation
            hunks={fileDiff.hunks}
            {...hunkNavigation}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          <div
            ref={diffRootRef}
            className="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <FileDiff
              fileDiff={fileDiff}
              options={{
                diffStyle: "split",
                diffIndicators: "bars",
                lineDiffType: "word-alt",
                theme: theme === "dark" ? "pierre-dark" : "pierre-light",
                overflow: "scroll",
                disableFileHeader: true,
              }}
              disableWorkerPool
            />
          </div>
          <DiffHorizontalScrollbars
            diffRootRef={diffRootRef}
            syncKey={`${change.entityId}:${renderVersion}`}
          />
        </div>
      </ScrollArea>
    </main>
  );
}

function FileDiffView({
  filePath,
  oldFilePath,
  oldContent,
  newContent,
  cacheKey,
  theme,
  comparison,
}: {
  filePath: string;
  oldFilePath: string;
  oldContent: string;
  newContent: string;
  cacheKey: string;
  theme: "light" | "dark";
  comparison: Comparison;
}) {
  const fileDiff = useMemo(
    () => {
      if (oldContent === newContent) {
        return null;
      }

      return parseDiffFromFile(
        {
          name: oldFilePath,
          contents: oldContent,
          cacheKey: `${cacheKey}:old`,
        },
        {
          name: filePath,
          contents: newContent,
          cacheKey: `${cacheKey}:new`,
        },
        { context: 3 },
      );
    },
    [cacheKey, filePath, newContent, oldContent, oldFilePath],
  );
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(fileDiff?.hunks ?? [], diffRootRef);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreNavigationKey(event)) return;

      if (
        (event.key === "ArrowUp" || event.key === "k") &&
        hunkNavigation.hasPreviousHunk
      ) {
        event.preventDefault();
        hunkNavigation.jumpToHunk(hunkNavigation.currentHunk - 1);
        return;
      }

      if (
        (event.key === "ArrowDown" || event.key === "j") &&
        hunkNavigation.hasNextHunk
      ) {
        event.preventDefault();
        hunkNavigation.jumpToHunk(hunkNavigation.currentHunk + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hunkNavigation]);

  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <FileCode2 className="size-5 text-foreground" />
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {filePath}
            </h1>
            <Badge
              variant="outline"
              className="rounded-md font-mono text-[10px] tracking-wide uppercase"
            >
              Full file
            </Badge>
          </div>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            Ordinary Git diff · {getComparisonLabel(comparison)}
          </p>
        </div>
        <HunkNavigation
          hunks={fileDiff?.hunks ?? []}
          {...hunkNavigation}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          {fileDiff ? (
            <>
              <div
                ref={diffRootRef}
                className="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <FileDiff
                  fileDiff={fileDiff}
                  options={{
                    diffStyle: "split",
                    diffIndicators: "bars",
                    lineDiffType: "word-alt",
                    theme: theme === "dark" ? "pierre-dark" : "pierre-light",
                    overflow: "scroll",
                    disableFileHeader: true,
                  }}
                  disableWorkerPool
                />
              </div>
              <DiffHorizontalScrollbars
                diffRootRef={diffRootRef}
                syncKey={cacheKey}
              />
            </>
          ) : (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              No line changes in this file for {getComparisonLabel(comparison).toLowerCase()}.
            </div>
          )}
        </div>
      </ScrollArea>
    </main>
  );
}

function BinaryFileView({
  filePath,
  oldFilePath,
  comparison,
}: {
  filePath: string;
  oldFilePath: string;
  comparison: Comparison;
}) {
  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center gap-4 border-b bg-card px-6 py-3">
        <FileCode2 className="size-5 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {filePath}
            </h1>
            <Badge
              variant="outline"
              className="rounded-md font-mono text-[10px] tracking-wide uppercase"
            >
              Binary file
            </Badge>
          </div>
          <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
            {oldFilePath !== filePath ? `${oldFilePath} → ${filePath} · ` : ""}
            {getComparisonLabel(comparison)}
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div className="max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <FileCode2 className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">Binary content changed</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            A line-level preview is not available for binary files.
          </p>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ comparison }: { comparison: Comparison }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No changes found</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          `sem` found no semantic entity changes for{" "}
          {getComparisonLabel(comparison).toLowerCase()}.
        </p>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  isFetching,
  title = "Unable to run diff",
}: {
  error: string;
  onRetry: () => void;
  isFetching: boolean;
  title?: string;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg rounded-xl border border-rose-200 bg-card p-5 shadow-sm dark:border-rose-900">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title}</h2>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200">
              {error}
            </pre>
            <Button
              className="mt-4"
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={isFetching}
            >
              <RotateCcw className={cn(isFetching && "animate-spin")} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Running sem diff
      </div>
    </div>
  );
}

function NoRepositoriesState() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <FolderGit2 className="size-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold">
          No repositories found
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Run `sdv` inside a Git repository or from a folder containing Git
          repositories as direct child directories.
        </p>
      </div>
    </div>
  );
}

export function SemanticDiffViewer() {
  const theme = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const comparison = getComparisonFromSearchParams(searchParams);
  const requestedRepoId = searchParams.get("repo") ?? undefined;
  const selectedFromUrl = searchParams.get("entity") ?? undefined;
  const selectedFilePath = searchParams.get("file") ?? undefined;
  const mergeModuleChanges = searchParams.get("merge-module") !== "off";
  const repositoriesQuery = useQuery({
    queryKey: ["workspace-repositories"],
    queryFn: getWorkspaceRepositories,
  });
  const repositories = useMemo(
    () =>
      repositoriesQuery.data?.ok
        ? repositoriesQuery.data.data.repositories
        : [],
    [repositoriesQuery.data],
  );
  const showRepositoryRail = repositories.some((repo) => repo.id !== ".");
  const selectedRepoId = requestedRepoId ?? repositories[0]?.id;
  const activeRepository =
    repositories.find((repo) => repo.id === selectedRepoId);
  const activeRepoId = activeRepository?.id;
  useEffect(() => {
    if (requestedRepoId || !showRepositoryRail || !repositories[0]) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("repo", repositories[0].id);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }, [pathname, repositories, requestedRepoId, searchParams, showRepositoryRail]);
  const query = useQuery({
    queryKey: ["semantic-diff", activeRepoId, comparison],
    queryFn: () => getSemanticDiff(comparison, activeRepoId),
    enabled: activeRepoId !== undefined,
  });
  const commitsQuery = useQuery({
    queryKey: ["git-commits", activeRepoId],
    queryFn: () => getRecentCommits(activeRepoId),
    enabled: activeRepoId !== undefined,
    staleTime: 30_000,
  });
  const result = query.data;
  const diff = result?.ok ? result.data : undefined;
  const visibleChanges = useMemo(
    () =>
      diff
        ? mergeModuleChanges
          ? mergeModuleLevelChanges(diff.changes)
          : diff.changes
        : [],
    [diff, mergeModuleChanges],
  );
  const visibleFileChanges = diff?.fileChanges ?? EMPTY_FILE_CHANGES;
  const fileGroups = useMemo(
    () => groupByFile(visibleChanges, visibleFileChanges),
    [visibleChanges, visibleFileChanges],
  );
  const navigableChanges = useMemo(
    () => fileGroups.flatMap((group) => group.changes),
    [fileGroups],
  );
  const selectedChange =
    selectedFilePath === undefined
      ? (navigableChanges.find(
          (change) => change.entityId === selectedFromUrl,
        ) ?? navigableChanges[0])
      : undefined;
  const selectedEntityId = selectedChange?.entityId;
  const effectiveSelectedFilePath =
    selectedFilePath ??
    (selectedChange === undefined ? fileGroups[0]?.filePath : undefined);
  const selectedEntityIndex = selectedChange
    ? navigableChanges.findIndex(
        (change) => change.entityId === selectedChange.entityId,
      )
    : -1;
  const fileQuery = useQuery({
    queryKey: ["file-diff", activeRepoId, comparison, effectiveSelectedFilePath],
    queryFn: () =>
      getFileDiff(effectiveSelectedFilePath!, comparison, activeRepoId),
    enabled:
      activeRepoId !== undefined &&
      effectiveSelectedFilePath !== undefined &&
      diff !== undefined,
  });
  const isRefreshing =
    repositoriesQuery.isFetching || query.isFetching || fileQuery.isFetching;

  function replaceSearchParams(params: URLSearchParams) {
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname,
    );
  }

  function selectEntity(entityId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("file");
    params.set("entity", entityId);
    replaceSearchParams(params);
  }

  function selectRepository(repoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("entity");
    params.delete("file");

    if (repoId === ".") {
      params.delete("repo");
    } else {
      params.set("repo", repoId);
    }

    replaceSearchParams(params);
  }

  function selectFile(filePath: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("entity");
    params.set("file", filePath);
    replaceSearchParams(params);
  }

  function selectComparisonMode(mode: Comparison["mode"]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("entity");
    params.delete("file");

    if (mode === "changed") {
      params.delete("mode");
      params.delete("from");
      params.delete("to");
    } else if (mode === "staged") {
      params.set("mode", "staged");
      params.delete("from");
      params.delete("to");
    } else {
      params.set("mode", "commits");
      params.set(
        "from",
        comparison.mode === "commits" ? comparison.from : "HEAD~1",
      );
      params.set(
        "to",
        comparison.mode === "commits" ? comparison.to : "HEAD",
      );
    }

    replaceSearchParams(params);
  }

  function compareCommits(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "commits");
    params.set("from", from);
    params.set("to", to);
    params.delete("entity");
    params.delete("file");
    replaceSearchParams(params);
  }

  function toggleModuleMerge() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("entity");

    if (mergeModuleChanges) {
      params.set("merge-module", "off");
    } else {
      params.delete("merge-module");
    }

    replaceSearchParams(params);
  }

  async function refreshDiff() {
    const refreshed = await query.refetch();
    const filePathToRefresh = effectiveSelectedFilePath;

    if (filePathToRefresh) {
      if (
        selectedFilePath &&
        refreshed.data?.ok &&
        !hasFileInDiff(
          filePathToRefresh,
          refreshed.data.data.changes,
          refreshed.data.data.fileChanges,
        )
      ) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("file");
        replaceSearchParams(params);
        return;
      }

      if (!refreshed.data?.ok) return;
      await fileQuery.refetch();
    }
  }

  async function refreshAll() {
    await repositoriesQuery.refetch();
    await refreshDiff();
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-background">
        <header className="flex h-14 shrink-0 items-center gap-4 overflow-x-auto border-b bg-card px-4">
          <div className="flex min-w-0 shrink-0 items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm">
                <GitCompareArrows className="size-4" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">
                Semantic Diff
              </span>
            </div>

            {diff ? (
              <div className="hidden min-w-0 items-center gap-2 border-l pl-4 text-xs text-muted-foreground sm:flex">
                <span className="max-w-36 truncate font-medium text-foreground">
                  {diff.repositoryName}
                </span>
                <span className="text-muted-foreground/50">/</span>
                <GitBranch className="size-3.5" />
                <span className="max-w-36 truncate font-mono">
                  {diff.branchName}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-max flex-1 items-center gap-3 border-l pl-4">
            <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              <GitCommitHorizontal className="size-4" />
              Compare
            </div>
            <ComparisonSelector
              key={getComparisonLabel(comparison)}
              comparison={comparison}
              commits={commitsQuery.data?.ok ? commitsQuery.data.data : []}
              onModeChange={selectComparisonMode}
              onCompare={compareCommits}
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {diff ? (
              <div className="hidden items-center gap-3 md:flex">
                <SummaryStat
                  label="added"
                  value={
                    visibleChanges.filter(
                      (change) => change.changeType === "added",
                    ).length
                  }
                  tone="positive"
                />
                <SummaryStat
                  label="modified"
                  value={
                    visibleChanges.filter(
                      (change) => change.changeType === "modified",
                    ).length
                  }
                />
                <SummaryStat
                  label="deleted"
                  value={
                    visibleChanges.filter(
                      (change) => change.changeType === "deleted",
                    ).length
                  }
                  tone="negative"
                />
              </div>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={mergeModuleChanges ? "secondary" : "outline"}
                  aria-pressed={mergeModuleChanges}
                  onClick={toggleModuleMerge}
                  className="hidden sm:inline-flex"
                >
                  <GitMerge />
                  Module merge: {mergeModuleChanges ? "on" : "off"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {mergeModuleChanges
                  ? "Show module-level additions and deletions separately"
                  : "Merge matching module-level additions and deletions"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Refresh diff"
                  onClick={refreshDiff}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn(isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh diff</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {repositoriesQuery.isPending ? <LoadingState /> : null}
          {repositoriesQuery.data && !repositoriesQuery.data.ok ? (
            <ErrorState
              error={repositoriesQuery.data.error}
              onRetry={() => repositoriesQuery.refetch()}
              isFetching={repositoriesQuery.isFetching}
              title="Unable to inspect workspace"
            />
          ) : null}
          {repositoriesQuery.data?.ok && repositories.length === 0 ? (
            <NoRepositoriesState />
          ) : null}
          {repositoriesQuery.data?.ok && repositories.length > 0 ? (
            <>
              {showRepositoryRail ? (
                <RepositoryRail
                  workspaceName={repositoriesQuery.data.data.workspaceName}
                  repositories={repositories}
                  selectedRepoId={activeRepoId}
                  onSelectRepo={selectRepository}
                  onRefreshAll={refreshAll}
                  isRefreshing={isRefreshing}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                {query.isPending ? <LoadingState /> : null}
                {result && !result.ok ? (
                  <ErrorState
                    error={result.error}
                    onRetry={() => query.refetch()}
                    isFetching={query.isFetching}
                  />
                ) : null}
                {diff && fileGroups.length === 0 ? (
                  <EmptyState comparison={comparison} />
                ) : null}
                {diff &&
                fileGroups.length > 0 &&
                (effectiveSelectedFilePath || selectedChange) ? (
                  <ResizablePanelGroup orientation="horizontal">
                    <ResizablePanel
                      defaultSize="27%"
                      minSize="220px"
                      maxSize="42%"
                    >
                      <Sidebar
                        changes={visibleChanges}
                        fileChanges={visibleFileChanges}
                        selectedEntityId={selectedEntityId}
                        selectedFilePath={effectiveSelectedFilePath}
                        onSelectEntity={selectEntity}
                        onSelectFile={selectFile}
                      />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize="73%" minSize="480px">
                      {effectiveSelectedFilePath && fileQuery.isPending ? (
                        <LoadingState />
                      ) : null}
                      {effectiveSelectedFilePath &&
                      fileQuery.data &&
                      !fileQuery.data.ok ? (
                        <ErrorState
                          error={fileQuery.data.error}
                          onRetry={() => fileQuery.refetch()}
                          isFetching={fileQuery.isFetching}
                          title="Unable to load file diff"
                        />
                      ) : null}
                      {effectiveSelectedFilePath &&
                      fileQuery.data?.ok &&
                      fileQuery.data.data.kind === "text" ? (
                        <FileDiffView
                          key={fileQuery.data.data.cacheKey}
                          filePath={fileQuery.data.data.filePath}
                          oldFilePath={fileQuery.data.data.oldFilePath}
                          oldContent={fileQuery.data.data.oldContent}
                          newContent={fileQuery.data.data.newContent}
                          cacheKey={fileQuery.data.data.cacheKey}
                          theme={theme}
                          comparison={comparison}
                        />
                      ) : null}
                      {effectiveSelectedFilePath &&
                      fileQuery.data?.ok &&
                      fileQuery.data.data.kind === "binary" ? (
                        <BinaryFileView
                          key={fileQuery.data.data.cacheKey}
                          filePath={fileQuery.data.data.filePath}
                          oldFilePath={fileQuery.data.data.oldFilePath}
                          comparison={comparison}
                        />
                      ) : null}
                      {!selectedFilePath && selectedChange ? (
                        <EntityDiff
                          key={`${selectedChange.entityId}:${diff.refreshedAt}`}
                          change={selectedChange}
                          theme={theme}
                          renderVersion={diff.refreshedAt}
                          onPreviousEntity={
                            selectedEntityIndex > 0
                              ? () =>
                                  selectEntity(
                                    navigableChanges[selectedEntityIndex - 1]
                                      .entityId,
                                  )
                              : undefined
                          }
                          onNextEntity={
                            selectedEntityIndex < navigableChanges.length - 1
                              ? () =>
                                  selectEntity(
                                    navigableChanges[selectedEntityIndex + 1]
                                      .entityId,
                                  )
                              : undefined
                          }
                        />
                      ) : null}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-card px-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CirclePlus className="size-3" />
            {getSemCommand(comparison)}
          </span>
          {diff ? (
            <span className="flex items-center gap-1.5">
              <Minus className="size-3" />
              refreshed {new Date(diff.refreshedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </footer>
      </div>
    </TooltipProvider>
  );
}
