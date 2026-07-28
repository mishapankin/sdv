"use client";

import {
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import {
  CirclePlus,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Minus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getFileDiff,
  getRecentCommits,
  getSemanticDiff,
  getWorkspaceRepositories,
} from "@/app/actions";
import { ComparisonSelector } from "@/components/comparison-controls";
import { DiffSidebar } from "@/components/diff-sidebar";
import { EntityDiffView } from "@/components/entity-diff-view";
import { EntityPanel } from "@/components/entity-panel";
import {
  BinaryFileView,
  FileDiffView,
} from "@/components/file-diff-view";
import { RepositoryRail } from "@/components/repository-rail";
import { ThemeToggle, useTheme } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useViewerUrlState } from "@/components/use-viewer-url-state";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoRepositoriesState,
} from "@/components/viewer-states";
import {
  getComparisonLabel,
  getGitFileDiffCommand,
  getSemCommand,
} from "@/lib/comparison";
import {
  resolveDiffSelection,
  type DiffSelection,
} from "@/lib/diff-selection";
import {
  getFileDiffQueryKey,
  invalidateFileDiffQueries,
  removeFileDiffQueries,
} from "@/lib/diff-query";
import { groupByFile, hasFileInDiff } from "@/lib/group-changes";
import { mergeModuleLevelChanges } from "@/lib/merge-module-changes";
import type { FileOnlyChange } from "@/lib/sem-types";
import { cn } from "@/lib/utils";

const EMPTY_FILE_CHANGES: FileOnlyChange[] = [];
const DIFF_WORKER_POOL_OPTIONS = {
  poolSize: 2,
  workerFactory: () =>
    new Worker(
      new URL("@pierre/diffs/worker/worker.js", import.meta.url),
      { type: "module" },
    ),
};
const DIFF_HIGHLIGHTER_OPTIONS = {
  lineDiffType: "word-alt" as const,
};

export function SemanticDiffViewer() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<DiffSelection | null>(null);
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
  const {
    comparison,
    mergeModuleChanges,
    showRepositoryRail,
    selectedRepoId,
    selectRepository: setRepositoryInUrl,
    selectComparisonMode,
    compareCommits,
    toggleModuleMerge: toggleModuleMergeInUrl,
  } = useViewerUrlState(repositories);
  const activeRepository =
    repositories.find((repo) => repo.id === selectedRepoId);
  const activeRepoId = activeRepository?.id;
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

  useEffect(() => {
    if (diff) {
      document.title = `SDV: ${diff.repositoryName}`;
    }
  }, [diff]);

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
  const {
    navigableChanges,
    selectedChange,
    selectedEntityId,
    selectedEntityIndex,
    effectiveSelectedFilePath,
    selectedFileGroup,
    fileDiffPath,
    fileTarget,
  } = useMemo(
    () => resolveDiffSelection(fileGroups, selection),
    [fileGroups, selection],
  );
  const fileQuery = useQuery({
    queryKey:
      activeRepoId === undefined
        ? ["file-diff", "unavailable"]
        : getFileDiffQueryKey(activeRepoId, comparison, fileDiffPath),
    queryFn:
      activeRepoId !== undefined &&
      fileDiffPath !== undefined &&
      diff !== undefined
        ? () => getFileDiff(fileDiffPath, comparison, activeRepoId)
        : skipToken,
  });
  const isRefreshing =
    repositoriesQuery.isFetching || query.isFetching || fileQuery.isFetching;
  const statusCommand = fileDiffPath
    ? getGitFileDiffCommand(
        comparison,
        fileDiffPath,
        selectedFileGroup?.fileChange?.changeType === "untracked",
      )
    : getSemCommand(comparison);

  async function refreshDiff() {
    const refreshed = await query.refetch();
    const filePathToRefresh = fileDiffPath;

    if (!refreshed.data?.ok || activeRepoId === undefined) return;

    if (
      filePathToRefresh &&
      selection?.type === "file" &&
      !hasFileInDiff(
        filePathToRefresh,
        refreshed.data.data.changes,
        refreshed.data.data.fileChanges,
      )
    ) {
      removeFileDiffQueries(queryClient, activeRepoId, comparison);
      setSelection(null);
      return;
    }

    await invalidateFileDiffQueries(
      queryClient,
      activeRepoId,
      comparison,
    );
  }

  async function refreshAll() {
    await repositoriesQuery.refetch();
    await refreshDiff();
  }

  function selectEntity(entityId: string) {
    setSelection({ type: "entity", entityId });
  }

  function selectFile(filePath: string) {
    setSelection({ type: "file", filePath });
  }

  function selectRepository(repoId: string) {
    setSelection(null);
    setRepositoryInUrl(repoId);
  }

  function changeComparisonMode(
    mode: Parameters<typeof selectComparisonMode>[0],
  ) {
    setSelection(null);
    selectComparisonMode(mode);
  }

  function changeComparedCommits(from: string, to: string) {
    setSelection(null);
    compareCommits(from, to);
  }

  function toggleModuleMerge() {
    setSelection(null);
    toggleModuleMergeInUrl();
  }

  return (
    <WorkerPoolContextProvider
      poolOptions={DIFF_WORKER_POOL_OPTIONS}
      highlighterOptions={DIFF_HIGHLIGHTER_OPTIONS}
    >
      <TooltipProvider>
        <div className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-background">
        <header className="flex h-14 shrink-0 items-center gap-4 overflow-x-auto border-b bg-card px-4">
          <div className="flex min-w-0 shrink-0 items-center gap-4">
            <span className="text-[15px] font-semibold tracking-tight">
              SDV
            </span>

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
              onModeChange={changeComparisonMode}
              onCompare={changeComparedCommits}
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {diff ? (
              <div
                className="hidden items-center gap-2 font-mono text-xs md:flex"
                aria-label={`${diff.gitSummary.fileCount} files changed, ${diff.gitSummary.additions} additions, ${diff.gitSummary.deletions} deletions`}
              >
                <span className="text-muted-foreground">
                  {diff.gitSummary.fileCount}{" "}
                  {diff.gitSummary.fileCount === 1
                    ? "file changed"
                    : "files changed"}
                </span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  +{diff.gitSummary.additions}
                </span>
                <span className="font-medium text-rose-700 dark:text-rose-400">
                  −{diff.gitSummary.deletions}
                </span>
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
                effectiveSelectedFilePath &&
                selectedFileGroup ? (
                  <ResizablePanelGroup orientation="horizontal">
                    <ResizablePanel
                      defaultSize="24%"
                      minSize="220px"
                      maxSize="34%"
                    >
                      <DiffSidebar
                        changes={visibleChanges}
                        fileChanges={visibleFileChanges}
                        selectedFilePath={effectiveSelectedFilePath}
                        onSelectFile={selectFile}
                      />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize="480px">
                      {fileDiffPath && fileQuery.isPending ? (
                        <LoadingState />
                      ) : null}
                      {fileDiffPath &&
                      fileQuery.data &&
                      !fileQuery.data.ok ? (
                        <ErrorState
                          error={fileQuery.data.error}
                          onRetry={() => fileQuery.refetch()}
                          isFetching={fileQuery.isFetching}
                          title="Unable to load file diff"
                        />
                      ) : null}
                      {fileDiffPath &&
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
                          target={fileTarget}
                        />
                      ) : null}
                      {fileDiffPath &&
                      fileQuery.data?.ok &&
                      fileQuery.data.data.kind === "binary" ? (
                        <BinaryFileView
                          key={fileQuery.data.data.cacheKey}
                          filePath={fileQuery.data.data.filePath}
                          oldFilePath={fileQuery.data.data.oldFilePath}
                          comparison={comparison}
                        />
                      ) : null}
                      {selectedChange ? (
                        <EntityDiffView
                          key={`${selectedChange.entityId}:${diff.refreshedAt}`}
                          change={selectedChange}
                          theme={theme}
                          renderVersion={diff.refreshedAt}
                          onViewInContext={(target) =>
                            setSelection({
                              type: "file",
                              filePath: selectedChange.filePath,
                              target,
                            })
                          }
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
                    <ResizableHandle />
                    <ResizablePanel
                      defaultSize="240px"
                      minSize="190px"
                      maxSize="360px"
                      groupResizeBehavior="preserve-pixel-size"
                      collapsible
                      collapsedSize="0px"
                    >
                      <EntityPanel
                        fileGroup={selectedFileGroup}
                        selectedEntityId={selectedEntityId}
                        onSelectFullFile={() =>
                          selectFile(effectiveSelectedFilePath)
                        }
                        onSelectEntity={selectEntity}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-card px-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <CirclePlus className="size-3 shrink-0" />
            <span className="truncate" title={statusCommand}>
              {statusCommand}
            </span>
          </span>
          {diff ? (
            <span className="flex shrink-0 items-center gap-1.5 pl-3">
              <Minus className="size-3" />
              refreshed {new Date(diff.refreshedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </footer>
        </div>
      </TooltipProvider>
    </WorkerPoolContextProvider>
  );
}
