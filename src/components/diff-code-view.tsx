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

const HIDE_INTERNAL_HORIZONTAL_SCROLLBAR_CSS = `
  [data-code] {
    scrollbar-gutter: auto;
    scrollbar-width: none;
    padding-bottom: var(--diffs-gap-block, var(--diffs-gap-fallback));
  }

  [data-code]::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
`;

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
    <div className="flex min-h-0 flex-col p-5">
      <CodeView
        ref={codeViewRef}
        containerRef={containerRef}
        items={items}
        className="diff-view-scrollbar min-h-0 shrink overflow-y-auto rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        options={{
          diffStyle: "split",
          diffIndicators: "bars",
          lineDiffType: "word-alt",
          theme: {
            dark: "pierre-dark",
            light: "pierre-light",
          },
          themeType: theme,
          overflow: "scroll",
          disableFileHeader: true,
          expandUnchanged: shouldExpandUnchanged(fileDiff),
          unsafeCSS: HIDE_INTERNAL_HORIZONTAL_SCROLLBAR_CSS,
          layout: { paddingTop: 0, paddingBottom: 0, gap: 0 },
        }}
      />
      <DiffHorizontalScrollbars
        diffRootRef={containerRef}
        syncKey={syncKey}
      />
    </div>
  );
}
