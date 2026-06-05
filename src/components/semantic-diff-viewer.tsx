"use client";

import {
  getSingularPatch,
  parseDiffFromFile,
  type FileDiffMetadata,
} from "@pierre/diffs";
import { FileDiff, PatchDiff } from "@pierre/diffs/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CirclePlus,
  FileCode2,
  GitBranch,
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

import { getFileDiff, getSemanticDiff } from "@/app/actions";
import { EntityIcon } from "@/components/entity-icons";
import { ThemeToggle, useTheme } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChangeType, SemanticChange } from "@/lib/sem-types";
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

function groupByFile(changes: SemanticChange[]) {
  const groups = new Map<string, SemanticChange[]>();

  for (const change of changes) {
    const current = groups.get(change.filePath) ?? [];
    current.push(change);
    groups.set(change.filePath, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, fileChanges]) => ({
      filePath,
      changes: fileChanges.sort((left, right) => {
        const leftLine = left.startLine ?? left.oldStartLine ?? 0;
        const rightLine = right.startLine ?? right.oldStartLine ?? 0;
        return leftLine - rightLine;
      }),
    }));
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

function Sidebar({
  changes,
  selectedEntityId,
  selectedFilePath,
  onSelectEntity,
  onSelectFile,
}: {
  changes: SemanticChange[];
  selectedEntityId?: string;
  selectedFilePath?: string;
  onSelectEntity: (entityId: string) => void;
  onSelectFile: (filePath: string) => void;
}) {
  const fileGroups = useMemo(() => groupByFile(changes), [changes]);

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
            <details key={group.filePath} open className="group/file mb-1">
              <summary
                className={cn(
                  "flex h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium transition-colors select-none hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
                  selectedFilePath === group.filePath &&
                    "bg-card text-foreground shadow-xs",
                )}
              >
                <ChevronDown className="size-3.5 shrink-0 -rotate-90 text-muted-foreground transition-transform group-open/file:rotate-0" />
                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left hover:underline hover:underline-offset-2 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  title={`View full diff for ${group.filePath}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFile(group.filePath);
                  }}
                >
                  {group.filePath}
                </button>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {group.changes.length}
                </span>
              </summary>
              <div className="space-y-0.5 pr-1.5 pl-12">
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
        <div className="min-w-[720px] p-5">
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
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </main>
  );
}

function FileDiffView({
  filePath,
  patch,
  theme,
}: {
  filePath: string;
  patch: string;
  theme: "light" | "dark";
}) {
  const fileDiff = useMemo(() => getSingularPatch(patch), [patch]);
  const diffRootRef = useRef<HTMLDivElement>(null);
  const hunkNavigation = useHunkNavigation(fileDiff.hunks, diffRootRef);

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
            Ordinary Git diff · unstaged changes
          </p>
        </div>
        <HunkNavigation
          hunks={fileDiff.hunks}
          {...hunkNavigation}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="min-w-[720px] p-5">
          <div
            ref={diffRootRef}
            className="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <PatchDiff
              patch={patch}
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
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Working tree is clean</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          No semantic entities changed in tracked, unstaged files. Edit a file
          and refresh to inspect its semantic diff.
        </p>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  isFetching,
  title = "Unable to run semantic diff",
}: {
  error: string;
  onRetry: () => void;
  isFetching: boolean;
  title?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-background p-8">
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
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Running sem diff
      </div>
    </div>
  );
}

export function SemanticDiffViewer() {
  const theme = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("entity") ?? undefined;
  const selectedFilePath = searchParams.get("file") ?? undefined;
  const mergeModuleChanges = searchParams.get("merge-module") !== "off";
  const query = useQuery({
    queryKey: ["semantic-diff", "unstaged"],
    queryFn: getSemanticDiff,
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
  const navigableChanges = useMemo(
    () => groupByFile(visibleChanges).flatMap((group) => group.changes),
    [visibleChanges],
  );
  const selectedChange =
    selectedFilePath === undefined
      ? (navigableChanges.find(
          (change) => change.entityId === selectedFromUrl,
        ) ?? navigableChanges[0])
      : undefined;
  const selectedEntityId = selectedChange?.entityId;
  const selectedEntityIndex = selectedChange
    ? navigableChanges.findIndex(
        (change) => change.entityId === selectedChange.entityId,
      )
    : -1;
  const fileQuery = useQuery({
    queryKey: ["file-diff", "unstaged", selectedFilePath],
    queryFn: () => getFileDiff(selectedFilePath!),
    enabled: selectedFilePath !== undefined && diff !== undefined,
  });
  const isRefreshing = query.isFetching || fileQuery.isFetching;

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

  function selectFile(filePath: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("entity");
    params.set("file", filePath);
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

    if (selectedFilePath) {
      if (
        refreshed.data?.ok &&
        !refreshed.data.data.changes.some(
          (change) => change.filePath === selectedFilePath,
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

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex min-w-0 items-center gap-4">
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

          <div className="flex items-center gap-3">
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
            <Badge
              variant="outline"
              className="hidden h-7 rounded-md px-2.5 font-mono text-[10px] tracking-wide uppercase sm:flex"
            >
              Unstaged
            </Badge>
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
                  aria-label="Refresh semantic diff"
                  onClick={refreshDiff}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn(isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rerun sem diff</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {query.isPending ? <LoadingState /> : null}
          {result && !result.ok ? (
            <ErrorState
              error={result.error}
              onRetry={() => query.refetch()}
              isFetching={query.isFetching}
            />
          ) : null}
          {diff && visibleChanges.length === 0 ? <EmptyState /> : null}
          {diff &&
          visibleChanges.length > 0 &&
          (selectedFilePath || selectedChange) ? (
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize="27%" minSize="220px" maxSize="42%">
                <Sidebar
                  changes={visibleChanges}
                  selectedEntityId={selectedEntityId}
                  selectedFilePath={selectedFilePath}
                  onSelectEntity={selectEntity}
                  onSelectFile={selectFile}
                />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="73%" minSize="480px">
                {selectedFilePath && fileQuery.isPending ? (
                  <LoadingState />
                ) : null}
                {selectedFilePath && fileQuery.data && !fileQuery.data.ok ? (
                  <ErrorState
                    error={fileQuery.data.error}
                    onRetry={() => fileQuery.refetch()}
                    isFetching={fileQuery.isFetching}
                    title="Unable to load file diff"
                  />
                ) : null}
                {selectedFilePath && fileQuery.data?.ok ? (
                  <FileDiffView
                    key={`${fileQuery.data.data.filePath}:${fileQuery.data.data.patch}`}
                    filePath={fileQuery.data.data.filePath}
                    patch={fileQuery.data.data.patch}
                    theme={theme}
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

        <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-card px-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CirclePlus className="size-3" />
            sem diff --verbose --format json
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
