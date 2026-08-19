import { describe, expect, it, vi } from "vitest";

import { readDependencyStatuses } from "@/lib/diagnostics";

describe("dependency diagnostics", () => {
  it("reports versions and falls back to help when version is unsupported", async () => {
    const execute = vi.fn(async (command: string, args: string[]) => {
      if (command === "inspect") {
        if (args[0] === "--version") {
          throw new Error("unexpected argument '--version'");
        }

        return { stdout: "Usage: inspect <COMMAND>\n", stderr: "" };
      }

      return {
        stdout: command === "git" ? "git version 2.50.0\n" : "sem 0.8.1\nextra",
        stderr: "",
      };
    });

    await expect(readDependencyStatuses(execute)).resolves.toEqual([
      { name: "git", available: true, version: "git version 2.50.0" },
      { name: "sem", available: true, version: "sem 0.8.1" },
      { name: "inspect", available: true },
    ]);
    expect(execute).toHaveBeenCalledWith("inspect", ["--help"]);
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("reports an executable as unavailable when both probes fail", async () => {
    const execute = vi.fn(async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });

    await expect(readDependencyStatuses(execute)).resolves.toEqual([
      { name: "git", available: false },
      { name: "sem", available: false },
      { name: "inspect", available: false },
    ]);
  });
});
