"use client";

import { MultiFileDiff } from "@pierre/diffs/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  CirclePlus,
  FileCode2,
  GitBranch,
  GitCompareArrows,
  LoaderCircle,
  Minus,
  RefreshCw,
  RotateCcw,
  SearchX,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { getSemanticDiff } from "@/app/actions";
import { EntityIcon } from "@/components/entity-icons";
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
import type {
  ChangeType,
  SemanticChange,
  SemDiff,
} from "@/lib/sem-types";
import { cn } from "@/lib/utils";

const changeStyles: Record<
  ChangeType,
  { label: string; shortLabel: string; className: string }
> = {
  added: {
    label: "Added",
    shortLabel: "A",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  modified: {
    label: "Modified",
    shortLabel: "M",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  deleted: {
    label: "Deleted",
    shortLabel: "D",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  moved: {
    label: "Moved",
    shortLabel: "V",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  renamed: {
    label: "Renamed",
    shortLabel: "R",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  reordered: {
    label: "Reordered",
    shortLabel: "O",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
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

function Sidebar({
  diff,
  selectedId,
  onSelect,
}: {
  diff: SemDiff;
  selectedId?: string;
  onSelect: (entityId: string) => void;
}) {
  const fileGroups = useMemo(() => groupByFile(diff.changes), [diff.changes]);

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
          {diff.summary.total} entities
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Changed semantic entities" className="py-2">
          {fileGroups.map((group) => (
            <section key={group.filePath} className="mb-1">
              <div className="flex h-9 items-center gap-2 px-3 text-xs font-medium">
                <ChevronDown className="size-3.5 text-muted-foreground" />
                <FileCode2 className="size-3.5 text-slate-500" />
                <span className="min-w-0 flex-1 truncate" title={group.filePath}>
                  {group.filePath}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {group.changes.length}
                </span>
              </div>

              <div className="space-y-0.5 px-1.5">
                {group.changes.map((change) => (
                  <button
                    key={change.entityId}
                    type="button"
                    onClick={() => onSelect(change.entityId)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-colors",
                      selectedId === change.entityId
                        ? "border-slate-200 bg-white shadow-xs"
                        : "hover:bg-sidebar-accent",
                    )}
                  >
                    <EntityIcon
                      entityType={change.entityType}
                      className={cn(
                        "size-4 shrink-0",
                        selectedId === change.entityId
                          ? "text-slate-800"
                          : "text-slate-500",
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
            </section>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function EntityDiff({ change }: { change: SemanticChange }) {
  const oldName = change.oldFilePath || change.filePath;
  const status = changeStyles[change.changeType];

  return (
    <main className="flex h-full min-w-0 flex-col bg-[#f8f9fb]">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b bg-white px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <EntityIcon
              entityType={change.entityType}
              className="size-5 text-slate-700"
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

        <div className="hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground xl:flex">
          {change.structuralChange === false ? (
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              cosmetic
            </span>
          ) : null}
          <span className="font-mono">
            {change.oldStartLine ?? "–"}:{change.oldEndLine ?? "–"}
          </span>
          <ArrowRight className="size-3" />
          <span className="font-mono">
            {change.startLine ?? "–"}:{change.endLine ?? "–"}
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="min-w-[720px] p-5">
          <div className="overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <MultiFileDiff
              oldFile={{
                name: oldName,
                contents: change.beforeContent ?? "",
                cacheKey: `${change.entityId}:before`,
              }}
              newFile={{
                name: change.filePath,
                contents: change.afterContent ?? "",
                cacheKey: `${change.entityId}:after`,
              }}
              options={{
                diffStyle: "split",
                diffIndicators: "bars",
                lineDiffType: "word-alt",
                theme: "pierre-light",
                overflow: "scroll",
                disableFileHeader: true,
                expandUnchanged: true,
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
    <div className="flex h-full items-center justify-center bg-[#f8f9fb] p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-white shadow-sm">
          <SearchX className="size-5 text-slate-500" />
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
}: {
  error: string;
  onRetry: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[#f8f9fb] p-8">
      <div className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Unable to run semantic diff</h2>
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
    <div className="flex h-full items-center justify-center bg-[#f8f9fb]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Running sem diff
      </div>
    </div>
  );
}

export function SemanticDiffViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("entity") ?? undefined;
  const query = useQuery({
    queryKey: ["semantic-diff", "unstaged"],
    queryFn: getSemanticDiff,
  });
  const result = query.data;
  const diff = result?.ok ? result.data : undefined;
  const selectedChange =
    diff?.changes.find((change) => change.entityId === selectedFromUrl) ??
    diff?.changes[0];
  const selectedId = selectedChange?.entityId;

  function selectEntity(entityId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("entity", entityId);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
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
                <span className="text-slate-300">/</span>
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
                  value={diff.summary.added}
                  tone="positive"
                />
                <SummaryStat
                  label="modified"
                  value={diff.summary.modified}
                />
                <SummaryStat
                  label="deleted"
                  value={diff.summary.deleted}
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
                  size="icon"
                  variant="outline"
                  aria-label="Refresh semantic diff"
                  onClick={() => query.refetch()}
                  disabled={query.isFetching}
                >
                  <RefreshCw
                    className={cn(query.isFetching && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rerun sem diff</TooltipContent>
            </Tooltip>
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
          {diff && diff.changes.length === 0 ? <EmptyState /> : null}
          {diff && diff.changes.length > 0 && selectedChange ? (
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel
                defaultSize="27%"
                minSize="220px"
                maxSize="42%"
              >
                <Sidebar
                  diff={diff}
                  selectedId={selectedId}
                  onSelect={selectEntity}
                />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="73%" minSize="480px">
                <EntityDiff change={selectedChange} />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : null}
        </div>

        <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-white px-3 font-mono text-[10px] text-muted-foreground">
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
