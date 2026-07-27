"use client";

import { FolderGit2, GitBranch, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WorkspaceRepository } from "@/lib/sem-types";
import { cn } from "@/lib/utils";

export function RepositoryRail({
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
