"use client";

import type { FileDiffMetadata } from "@pierre/diffs";
import {
  CodeView,
  type CodeViewHandle,
  type CodeViewItem,
} from "@pierre/diffs/react";
import { useMemo, type RefObject } from "react";

import { DiffHorizontalScrollbars } from "@/components/diff-navigation";
import { shouldExpandUnchanged } from "@/lib/diff-rendering";

export function DiffCodeView({
  codeViewRef,
  containerRef,
  fileDiff,
  itemId,
  theme,
  syncKey,
}: {
  codeViewRef: RefObject<CodeViewHandle<undefined> | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  fileDiff: FileDiffMetadata;
  itemId: string;
  theme: "light" | "dark";
  syncKey: string;
}) {
  const items = useMemo<CodeViewItem[]>(
    () => [{ id: itemId, type: "diff", fileDiff }],
    [fileDiff, itemId],
  );

  return (
    <div className="relative min-h-0 flex-1 p-5">
      <CodeView
        ref={codeViewRef}
        containerRef={containerRef}
        items={items}
        className="h-full overflow-y-auto rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        options={{
          diffStyle: "split",
          diffIndicators: "bars",
          lineDiffType: "word-alt",
          theme: theme === "dark" ? "pierre-dark" : "pierre-light",
          overflow: "scroll",
          disableFileHeader: true,
          expandUnchanged: shouldExpandUnchanged(fileDiff),
          layout: { paddingTop: 0, paddingBottom: 0, gap: 0 },
        }}
      />
      <div className="pointer-events-none absolute inset-x-5 bottom-5 z-10">
        <div className="pointer-events-auto">
          <DiffHorizontalScrollbars
            diffRootRef={containerRef}
            syncKey={syncKey}
          />
        </div>
      </div>
    </div>
  );
}
