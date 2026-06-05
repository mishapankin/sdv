import { z } from "zod";

export const changeTypeSchema = z.enum([
  "added",
  "modified",
  "deleted",
  "moved",
  "renamed",
  "reordered",
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

export const semDiffSchema = z.object({
  summary: z.object({
    fileCount: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    modified: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    moved: z.number().int().nonnegative(),
    renamed: z.number().int().nonnegative(),
    reordered: z.number().int().nonnegative(),
    orphan: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  changes: z.array(semanticChangeSchema),
});

export type ChangeType = z.infer<typeof changeTypeSchema>;
export type SemanticChange = z.infer<typeof semanticChangeSchema>;
export type SemDiff = z.infer<typeof semDiffSchema>;

export type SemanticDiffResult =
  | {
      ok: true;
      data: SemDiff & {
        repositoryName: string;
        branchName: string;
        refreshedAt: string;
      };
    }
  | {
      ok: false;
      error: string;
    };
