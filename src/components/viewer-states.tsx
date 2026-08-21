"use client";

import {
  AlertTriangle,
  FolderGit2,
  LoaderCircle,
  RotateCcw,
  SearchX,
} from "lucide-react";

import { getComparisonLabel } from "@/lib/comparison";
import type { Comparison } from "@/lib/sem-types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

export function EmptyState({ comparison }: { comparison: Comparison }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No changes found</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          <code className="font-mono text-foreground">sem</code> found no
          semantic entity changes for{" "}
          {getComparisonLabel(comparison).toLowerCase()}.
        </p>
      </div>
    </div>
  );
}

export function ErrorState({
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
            <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-950 p-3 font-mono text-xs leading-5 text-neutral-200">
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

export function LoadingState({ label = "Loading diff" }: { label?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function NoRepositoriesState() {
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
          Run <code className="font-mono text-foreground">sdv</code> from
          inside a Git worktree.
        </p>
      </div>
    </div>
  );
}
