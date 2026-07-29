import { describe, expect, it } from "vitest";

import { createOperationQueue } from "./operation-queue.mjs";

describe("operation queue", () => {
  it("serializes operations and continues after a rejection", async () => {
    const enqueue = createOperationQueue();
    const events = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueue(async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
    });
    const rejected = enqueue(async () => {
      events.push("rejected");
      throw new Error("expected");
    });
    const last = enqueue(async () => {
      events.push("last");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await first;
    await expect(rejected).rejects.toThrow("expected");
    await last;

    expect(events).toEqual(["first:start", "first:end", "rejected", "last"]);
  });
});
