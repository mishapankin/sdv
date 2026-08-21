"use client";

import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useMemo } from "react";

import {
  ChangeIndicator,
  changeStyles,
} from "@/components/change-badge";
import { FileTypeIcon } from "@/components/file-type-icon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildFileTree,
  type FileTreeDirectory,
  type FileTreeFile,
  type FileTreeNode,
} from "@/lib/file-tree";
import type { FileGroup } from "@/lib/group-changes";
import { cn } from "@/lib/utils";

const INDENT_PX = 14;
const ROOT_PADDING_PX = 8;

type FileTreeProps = {
  fileGroups: FileGroup[];
  selectedFilePath?: string;
  onSelectFile: (filePath: string) => void;
};

type TreeNodeProps = Omit<FileTreeProps, "fileGroups"> & {
  node: FileTreeNode;
  depth: number;
};

function rowPadding(depth: number) {
  return { paddingLeft: ROOT_PADDING_PX + depth * INDENT_PX };
}

function DirectoryNode({
  node,
  depth,
  ...selectionProps
}: Omit<TreeNodeProps, "node"> & { node: FileTreeDirectory }) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group/directory-trigger flex h-7 w-full items-center gap-1.5 pr-2 text-left text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          style={rowPadding(depth)}
        >
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/directory-trigger:rotate-90" />
          <Folder className="size-3.5 shrink-0 text-muted-foreground group-data-[state=open]/directory-trigger:hidden" />
          <FolderOpen className="hidden size-3.5 shrink-0 text-muted-foreground group-data-[state=open]/directory-trigger:block" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="min-w-0 flex-1 truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {node.name}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6} className="font-mono">
              {node.path}
            </TooltipContent>
          </Tooltip>
          <span className="font-mono text-[10px] text-muted-foreground">
            {node.fileCount}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {node.children.map((child) => (
          <TreeNode
            key={`${child.type}:${child.path}`}
            node={child}
            depth={depth + 1}
            {...selectionProps}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FileNode({
  node,
  depth,
  selectedFilePath,
  onSelectFile,
}: Omit<TreeNodeProps, "node"> & { node: FileTreeFile }) {
  const fileTitle = node.group.oldFilePath
    ? `${node.group.oldFilePath} → ${node.path}`
    : node.path;
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelectFile(node.path)}
          className={cn(
            "flex h-7 w-full items-center pr-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
            selectedFilePath === node.path &&
              "bg-card text-foreground shadow-xs",
          )}
          style={rowPadding(depth)}
        >
          <span className="size-5 shrink-0" aria-hidden="true" />
          <span className="grid min-w-0 flex-1 grid-cols-[1rem_minmax(0,1fr)_1.25rem] items-center gap-x-1.5">
            <FileTypeIcon filePath={node.path} className="size-4 shrink-0" />
            <span className="min-w-0 truncate text-xs font-medium">
              {node.name}
            </span>
            <ChangeIndicator changeType={node.group.changeType} />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} className="max-w-80 font-mono">
        <span className="break-all">{fileTitle}</span>
        <span className="opacity-60">
          · {changeStyles[node.group.changeType].label}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function TreeNode({ node, ...props }: TreeNodeProps) {
  return node.type === "directory" ? (
    <DirectoryNode node={node} {...props} />
  ) : (
    <FileNode node={node} {...props} />
  );
}

export function FileTree({ fileGroups, ...selectionProps }: FileTreeProps) {
  const nodes = useMemo(() => buildFileTree(fileGroups), [fileGroups]);

  return (
    <nav aria-label="Changed files" className="pb-2">
      {nodes.map((node) => (
        <TreeNode
          key={`${node.type}:${node.path}`}
          node={node}
          depth={0}
          {...selectionProps}
        />
      ))}
    </nav>
  );
}
