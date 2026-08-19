import { z } from "zod";

export const inspectRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

const rawInspectEntityReviewSchema = z.object({
  entity_id: z.string().min(1),
  entity_name: z.string(),
  entity_type: z.string().min(1),
  file_path: z.string().min(1),
  classification: z.string().min(1),
  risk_score: z.number().min(0).max(1),
  risk_level: z.enum(["Low", "Medium", "High", "Critical"]),
  blast_radius: z.number().int().nonnegative(),
  dependent_count: z.number().int().nonnegative(),
  dependency_count: z.number().int().nonnegative(),
  is_public_api: z.boolean(),
  structural_change: z.boolean().nullable(),
  group_id: z.number().int().nonnegative(),
});

const rawInspectGroupSchema = z.object({
  id: z.number().int().nonnegative(),
  label: z.string(),
  entity_ids: z.array(z.string()),
});

export const rawInspectOutputSchema = z.object({
  entity_reviews: z.array(rawInspectEntityReviewSchema),
  groups: z.array(rawInspectGroupSchema),
});

export type InspectRiskLevel = z.infer<typeof inspectRiskLevelSchema>;
export type RawInspectOutput = z.infer<typeof rawInspectOutputSchema>;

export type InspectEntityReview = {
  entityId: string;
  entityName: string;
  entityType: string;
  filePath: string;
  classification: string;
  riskScore: number;
  riskLevel: InspectRiskLevel;
  blastRadius: number;
  dependentCount: number;
  dependencyCount: number;
  publicApi: boolean;
  structuralChange: boolean | null;
  groupId: number;
  groupLabel: string | null;
};

export type InspectAnalysis =
  | {
      status: "ready";
      entities: InspectEntityReview[];
    }
  | { status: "missing" }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; error: string };
