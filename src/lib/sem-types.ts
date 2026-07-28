import { z } from "zod";

export const comparisonSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("changed") }),
  z.object({ mode: z.literal("staged") }),
  z.object({
    mode: z.literal("commits"),
    from: z.string().min(1).max(256),
    to: z.string().min(1).max(256),
  }),
]);

export type Comparison = z.infer<typeof comparisonSchema>;

export const changeTypeSchema = z.enum([
  "added",
  "modified",
  "deleted",
  "moved",
  "renamed",
  "reordered",
]);

export const fileStatusSchema = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
]);

export const semanticChangeSchema = z.object({
  entityId: z.string(),
  changeType: changeTypeSchema,
  entityType: z.string(),
  entityName: z.string(),
  filePath: z.string(),
  oldFilePath: z.string().nullable().optional(),
  oldEntityName: z.string().nullable().optional(),
  startLine: z.number().int().nullable().optional(),
  endLine: z.number().int().nullable().optional(),
  oldStartLine: z.number().int().nullable().optional(),
  oldEndLine: z.number().int().nullable().optional(),
  beforeContent: z.string().nullable().optional(),
  afterContent: z.string().nullable().optional(),
  structuralChange: z.boolean().nullable().optional(),
});

export const binaryChangeSchema = z.object({
  changeType: z.literal("binary"),
  filePath: z.string(),
  oldFilePath: z.string().nullable().optional(),
  fileStatus: fileStatusSchema,
});

export const fileOnlyChangeSchema = z.object({
  changeType: z.enum(["binary", "tracked", "untracked"]),
  filePath: z.string(),
  oldFilePath: z.string().nullable().optional(),
  fileStatus: fileStatusSchema,
});

export const semDiffSchema = z.object({
  summary: z.object({
    fileCount: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    modified: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    moved: z.number().int().nonnegative(),
    renamed: z.number().int().nonnegative(),
    reordered: z.number().int().nonnegative(),
    binary: z.number().int().nonnegative().optional(),
    orphan: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  changes: z.array(semanticChangeSchema),
  binaryChanges: z.array(binaryChangeSchema).default([]),
  fileChanges: z.array(fileOnlyChangeSchema).default([]),
});

export type ChangeType = z.infer<typeof changeTypeSchema>;
export type FileStatus = z.infer<typeof fileStatusSchema>;
export type SemanticChange = z.infer<typeof semanticChangeSchema>;
export type BinaryChange = z.infer<typeof binaryChangeSchema>;
export type FileOnlyChange = z.infer<typeof fileOnlyChangeSchema>;
export type SemDiff = z.infer<typeof semDiffSchema>;

export type GitDiffSummary = {
  fileCount: number;
  additions: number;
  deletions: number;
};

export type SemanticDiffResult =
  | {
      ok: true;
      data: SemDiff & {
        gitSummary: GitDiffSummary;
        repositoryName: string;
        branchName: string;
        refreshedAt: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

export type FileDiffResult =
  | {
      ok: true;
      data:
        | {
            kind: "text";
            filePath: string;
            oldFilePath: string;
            oldContent: string;
            newContent: string;
            cacheKey: string;
          }
        | {
            kind: "binary";
            filePath: string;
            oldFilePath: string;
            cacheKey: string;
          };
    }
  | {
      ok: false;
      error: string;
    };

export type GitCommit = {
  hash: string;
  shortHash: string;
  subject: string;
  relativeDate: string;
  refs: string;
};

export type GitCommitsResult =
  | {
      ok: true;
      data: GitCommit[];
    }
  | {
      ok: false;
      error: string;
    };

export type WorkspaceRepository = {
  id: string;
  name: string;
  relativePath: string;
  branchName: string;
  hasChanges: boolean;
  changedFileCount: number;
  error?: string;
};

export type WorkspaceRepositoriesResult =
  | {
      ok: true;
      data: {
        workspaceName: string;
        repositories: WorkspaceRepository[];
      };
    }
  | {
      ok: false;
      error: string;
    };
