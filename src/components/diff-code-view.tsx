"use client";

import type { FileDiffMetadata } from "@pierre/diffs";
import {
  CodeView,
  type CodeViewHandle,
  type CodeViewItem,
} from "@pierre/diffs/react";
import { useMemo, type RefObject } from "react";

import { DiffHorizontalScrollbars } from "@/components/diff-navigation";
import type { DiffLayout } from "@/components/use-viewer-url-state";
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

const DIFF_THEMES = {
  light: "pierre-light",
  dark: "pierre-dark",
} as const;

export function DiffCodeView({
  codeViewRef,
  containerRef,
  fileDiff,
  itemId,
  syncKey,
  diffLayout,
  wrapLongLines,
}: {
  codeViewRef: RefObject<CodeViewHandle<undefined> | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  fileDiff: FileDiffMetadata;
  itemId: string;
  syncKey: string;
  diffLayout: DiffLayout;
  wrapLongLines: boolean;
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
          diffStyle: diffLayout,
          diffIndicators: "bars",
          lineDiffType: "word-alt",
          theme: DIFF_THEMES,
          overflow: wrapLongLines ? "wrap" : "scroll",
          disableFileHeader: true,
          expandUnchanged: shouldExpandUnchanged(fileDiff),
          unsafeCSS: HIDE_INTERNAL_HORIZONTAL_SCROLLBAR_CSS,
          layout: { paddingTop: 0, paddingBottom: 0, gap: 0 },
        }}
      />
      {!wrapLongLines ? (
        <DiffHorizontalScrollbars
          diffRootRef={containerRef}
          syncKey={syncKey}
        />
      ) : null}
    </div>
  );
}
