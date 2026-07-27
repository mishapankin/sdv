import { describe, expect, it } from "vitest";

import { getFileIconName } from "@/lib/file-icon";

describe("file icon resolution", () => {
  it("prioritizes recognized filenames and tool configurations", () => {
    expect(getFileIconName("package.json")).toBe("file-type-npm");
    expect(getFileIconName("config/pnpm-lock.yaml")).toBe("file-type-pnpm");
    expect(getFileIconName("Dockerfile.dev")).toBe("file-type-docker");
    expect(getFileIconName("next.config.ts")).toBe("file-type-next");
    expect(getFileIconName("vitest.config.mts")).toBe("file-type-vitest");
    expect(getFileIconName(".eslintrc.json")).toBe("file-type-eslint");
    expect(getFileIconName("AGENTS.md")).toBe("file-type-agents");
  });

  it("resolves languages and compound TypeScript declarations", () => {
    expect(getFileIconName("src/view.tsx")).toBe("file-type-reactts");
    expect(getFileIconName("src/types.d.ts")).toBe(
      "file-type-typescriptdef-official",
    );
    expect(getFileIconName("scripts/config.cjs")).toBe("file-type-js-official");
    expect(getFileIconName("src/worker.mts")).toBe(
      "file-type-typescript-official",
    );
    expect(getFileIconName("src/Main.elm")).toBe("file-type-elm");
    expect(getFileIconName("src/main.rs")).toBe("file-type-rust");
    expect(getFileIconName("schema.graphql")).toBe("file-type-graphql");
  });

  it("returns undefined for unknown files so Lucide can be used", () => {
    expect(getFileIconName("NOTICE")).toBeUndefined();
    expect(getFileIconName("data.unknown-extension")).toBeUndefined();
  });
});
