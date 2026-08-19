import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { readOptionalInspectAnalysis } from "@/lib/inspect";
import type { SemanticChange } from "@/lib/sem-types";

const fixtureUrl = new URL("./fixtures/inspect-file.json", import.meta.url);
const change: SemanticChange = {
  entityId: "src/auth.ts::function::validateToken",
  entityName: "validateToken",
  entityType: "function",
  changeType: "modified",
  filePath: "src/auth.ts",
};

describe("inspect process boundary", () => {
  it("validates and normalizes file analysis", async () => {
    const output = await readFile(fixtureUrl, "utf8");
    const execute = vi.fn(async () => ({ stdout: output, stderr: "" }));

    const result = await readOptionalInspectAnalysis(
      { mode: "changed", base: "abc123" },
      [change],
      "/tmp/example",
      execute,
    );

    expect(execute).toHaveBeenCalledWith(
      "inspect",
      ["file", "src/auth.ts", "--format", "json"],
      "/tmp/example",
    );
    expect(result).toEqual({
      status: "ready",
      entities: [
        {
          entityId: "src/auth.ts::function::validateToken",
          entityName: "validateToken",
          entityType: "function",
          filePath: "src/auth.ts",
          classification: "SyntaxFunctional",
          riskScore: 0.65,
          riskLevel: "high",
          blastRadius: 8,
          dependentCount: 3,
          dependencyCount: 2,
          publicApi: true,
          structuralChange: true,
          groupId: 2,
          groupLabel: "authentication",
        },
      ],
    });
  });

  it("uses a resolved range for commit comparisons", async () => {
    const output = await readFile(fixtureUrl, "utf8");
    const execute = vi.fn(async () => ({ stdout: output, stderr: "" }));

    await readOptionalInspectAnalysis(
      { mode: "commits", from: "abc123", to: "def456" },
      [],
      "/tmp/example",
      execute,
    );

    expect(execute).toHaveBeenCalledWith(
      "inspect",
      ["diff", "abc123..def456", "--format", "json"],
      "/tmp/example",
    );
  });

  it("reports staged comparisons as unsupported without executing", async () => {
    const execute = vi.fn();

    await expect(
      readOptionalInspectAnalysis(
        { mode: "staged" },
        [change],
        "/tmp/example",
        execute,
      ),
    ).resolves.toEqual({
      status: "unsupported",
      reason: "Inspect does not currently expose staged-only analysis",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps missing and malformed Inspect output non-fatal", async () => {
    const missing = vi.fn(async () => {
      throw Object.assign(new Error("spawn inspect ENOENT"), {
        code: "ENOENT",
      });
    });
    const malformed = vi.fn(async () => ({
      stdout: "{not json",
      stderr: "",
    }));

    await expect(
      readOptionalInspectAnalysis(
        { mode: "changed", base: "abc123" },
        [change],
        "/tmp/example",
        missing,
      ),
    ).resolves.toEqual({ status: "missing" });
    await expect(
      readOptionalInspectAnalysis(
        { mode: "changed", base: "abc123" },
        [change],
        "/tmp/example",
        malformed,
      ),
    ).resolves.toMatchObject({
      status: "failed",
      error: expect.stringContaining("invalid JSON"),
    });
  });
});
