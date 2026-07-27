"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { getComparisonFromSearchParams } from "@/lib/comparison";
import type { Comparison, WorkspaceRepository } from "@/lib/sem-types";

export function useDiffUrlState(repositories: WorkspaceRepository[]) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const comparison = getComparisonFromSearchParams(searchParams);
  const requestedRepoId = searchParams.get("repo") ?? undefined;
  const selectedEntityId = searchParams.get("entity") ?? undefined;
  const selectedFilePath = searchParams.get("file") ?? undefined;
  const mergeModuleChanges = searchParams.get("merge-module") !== "off";
  const showRepositoryRail = repositories.some((repo) => repo.id !== ".");
  const selectedRepoId = requestedRepoId ?? repositories[0]?.id;

  useEffect(() => {
    if (requestedRepoId || !showRepositoryRail || !repositories[0]) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("repo", repositories[0].id);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }, [pathname, repositories, requestedRepoId, searchParams, showRepositoryRail]);

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

  function clearSelectedFile() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("file");
    replaceSearchParams(params);
  }

  return {
    comparison,
    selectedEntityId,
    selectedFilePath,
    mergeModuleChanges,
    showRepositoryRail,
    selectedRepoId,
    selectEntity,
    selectRepository,
    selectFile,
    selectComparisonMode,
    compareCommits,
    toggleModuleMerge,
    clearSelectedFile,
  };
}
