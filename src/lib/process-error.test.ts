import { describe, expect, it } from "vitest";

import { getProcessError } from "@/lib/process-error";

describe("process errors", () => {
  it("prefers trimmed stderr and falls back to Error messages", () => {
    expect(getProcessError({ stderr: " fatal: bad ref \n" })).toBe(
      "fatal: bad ref",
    );
    expect(getProcessError(new Error("spawn failed"))).toBe("spawn failed");
    expect(getProcessError(null)).toBe("Unknown process error");
  });
});
