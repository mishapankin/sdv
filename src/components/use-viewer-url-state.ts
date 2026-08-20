"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { getComparisonFromSearchParams } from "@/lib/comparison";
import type { Comparison, WorkspaceRepository } from "@/lib/sem-types";

export type DiffLayout = "split" | "unified";

export function useViewerUrlState(repositories: WorkspaceRepository[]) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const comparison = getComparisonFromSearchParams(searchParams);
  const requestedRepoId = searchParams.get("repo") ?? undefined;
  const mergeModuleChanges = searchParams.get("merge-module") !== "off";
  const diffLayout: DiffLayout =
    searchParams.get("diff-layout") === "inline" ? "unified" : "split";
  const wrapLongLines = searchParams.get("wrap-lines") === "on";
  const showRepositoryRail = repositories.some((repo) => repo.id !== ".");
  const selectedRepoId = requestedRepoId ?? repositories[0]?.id;

  useEffect(() => {
    const needsDefaultRepository =
      !requestedRepoId && showRepositoryRail && repositories[0];
    const hasLegacySelection =
      searchParams.has("entity") || searchParams.has("file");

    if (!needsDefaultRepository && !hasLegacySelection) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("entity");
    params.delete("file");

    if (needsDefaultRepository) {
      params.set("repo", repositories[0].id);
    }

    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname,
    );
  }, [pathname, repositories, requestedRepoId, searchParams, showRepositoryRail]);

  function replaceSearchParams(params: URLSearchParams) {
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname,
    );
  }

  function selectRepository(repoId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (repoId === ".") {
      params.delete("repo");
    } else {
      params.set("repo", repoId);
    }

    replaceSearchParams(params);
  }

  function selectComparisonMode(mode: Comparison["mode"]) {
    const params = new URLSearchParams(searchParams.toString());

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
    replaceSearchParams(params);
  }

  function toggleModuleMerge() {
    const params = new URLSearchParams(searchParams.toString());

    if (mergeModuleChanges) {
      params.set("merge-module", "off");
    } else {
      params.delete("merge-module");
    }

    replaceSearchParams(params);
  }

  function setDiffLayout(layout: DiffLayout) {
    const params = new URLSearchParams(searchParams.toString());

    if (layout === "split") {
      params.delete("diff-layout");
    } else {
      params.set("diff-layout", "inline");
    }

    replaceSearchParams(params);
  }

  function toggleWrapLongLines() {
    const params = new URLSearchParams(searchParams.toString());

    if (wrapLongLines) {
      params.delete("wrap-lines");
    } else {
      params.set("wrap-lines", "on");
    }

    replaceSearchParams(params);
  }

  return {
    comparison,
    diffLayout,
    mergeModuleChanges,
    wrapLongLines,
    showRepositoryRail,
    selectedRepoId,
    selectRepository,
    selectComparisonMode,
    compareCommits,
    setDiffLayout,
    toggleModuleMerge,
    toggleWrapLongLines,
  };
}
