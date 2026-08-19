import "server-only";

import type { ResolvedComparison } from "@/lib/git-arguments";
import {
  type InspectAnalysis,
  type InspectEntityReview,
  type RawInspectOutput,
  rawInspectOutputSchema,
} from "@/lib/inspect-types";
import { getProcessError } from "@/lib/process-error";
import type { SemanticChange } from "@/lib/sem-types";

const MAX_CONCURRENT_FILE_ANALYSES = 4;

export type InspectCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string }>;

function isMissingExecutable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function parseInspectOutput(stdout: string): RawInspectOutput {
  let json: unknown;

  try {
    json = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `inspect returned invalid JSON: ${getProcessError(error)}`,
    );
  }

  const parsed = rawInspectOutputSchema.safeParse(json);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const location = issue?.path.length
      ? ` at ${issue.path.join(".")}`
      : "";

    throw new Error(
      `inspect returned unexpected JSON${location}: ${issue?.message ?? "validation failed"}`,
    );
  }

  return parsed.data;
}

function normalizeRiskLevel(
  riskLevel: RawInspectOutput["entity_reviews"][number]["risk_level"],
) {
  return riskLevel.toLowerCase() as InspectEntityReview["riskLevel"];
}

function toEntityReviews(output: RawInspectOutput) {
  const groupLabels = new Map(
    output.groups.map((group) => [group.id, group.label]),
  );

  return output.entity_reviews.map(
    (review): InspectEntityReview => ({
      entityId: review.entity_id,
      entityName: review.entity_name,
      entityType: review.entity_type,
      filePath: review.file_path,
      classification: review.classification,
      riskScore: review.risk_score,
      riskLevel: normalizeRiskLevel(review.risk_level),
      blastRadius: review.blast_radius,
      dependentCount: review.dependent_count,
      dependencyCount: review.dependency_count,
      publicApi: review.is_public_api,
      structuralChange: review.structural_change,
      groupId: review.group_id,
      groupLabel: groupLabels.get(review.group_id) ?? null,
    }),
  );
}

async function analyze(
  args: string[],
  cwd: string,
  execute: InspectCommandRunner,
) {
  const { stdout } = await execute("inspect", args, cwd);
  return toEntityReviews(parseInspectOutput(stdout));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );

  return results;
}

export async function readOptionalInspectAnalysis(
  comparison: ResolvedComparison,
  changes: SemanticChange[],
  cwd: string,
  execute: InspectCommandRunner,
): Promise<InspectAnalysis> {
  if (comparison.mode === "staged") {
    return {
      status: "unsupported",
      reason: "Inspect does not currently expose staged-only analysis",
    };
  }

  try {
    if (comparison.mode === "commits") {
      const entities = await analyze(
        [
          "diff",
          `${comparison.from}..${comparison.to}`,
          "--format",
          "json",
        ],
        cwd,
        execute,
      );

      return { status: "ready", entities };
    }

    const filePaths = [
      ...new Set(changes.map((change) => change.filePath)),
    ];

    if (filePaths.length === 0) {
      return { status: "ready", entities: [] };
    }

    const reviewsByFile = await mapWithConcurrency(
      filePaths,
      MAX_CONCURRENT_FILE_ANALYSES,
      (filePath) =>
        analyze(["file", filePath, "--format", "json"], cwd, execute),
    );

    return { status: "ready", entities: reviewsByFile.flat() };
  } catch (error) {
    if (isMissingExecutable(error)) {
      return { status: "missing" };
    }

    return { status: "failed", error: getProcessError(error) };
  }
}
