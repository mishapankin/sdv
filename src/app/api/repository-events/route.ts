import { z } from "zod";

import { subscribeToRepositoryChanges } from "@/lib/repository-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repoIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((repoId) => !repoId.includes("\0"), "Invalid repository id");

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const parsedRepoId = repoIdSchema.safeParse(
    requestUrl.searchParams.get("repoId"),
  );

  if (!parsedRepoId.success) {
    return new Response("Invalid repository id", { status: 400 });
  }

  let sendEvent: ((contents: string) => void) | undefined;
  let closed = false;
  const heartbeat = {
    current: undefined as ReturnType<typeof setInterval> | undefined,
  };
  let unsubscribe: (() => Promise<void>) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      sendEvent = (contents) => {
        if (!closed) controller.enqueue(encoder.encode(contents));
      };
    },
    async cancel() {
      await cleanup();
    },
  });

  async function cleanup() {
    if (closed) return;
    closed = true;
    if (heartbeat.current) clearInterval(heartbeat.current);
    await unsubscribe?.();
  }

  try {
    unsubscribe = await subscribeToRepositoryChanges(
      parsedRepoId.data,
      (event) => {
        if (event.type === "change") {
          sendEvent?.(`id: ${event.generation}\ndata: ${JSON.stringify(event)}\n\n`);
        } else {
          sendEvent?.(`event: watcher-error\ndata: ${JSON.stringify(event)}\n\n`);
        }
      },
    );
  } catch (error) {
    await cleanup();
    const message = error instanceof Error ? error.message : String(error);
    return new Response(message, { status: 404 });
  }

  sendEvent?.("event: ready\ndata: {}\n\n");
  heartbeat.current = setInterval(
    () => sendEvent?.(": heartbeat\n\n"),
    15_000,
  );
  request.signal.addEventListener("abort", () => void cleanup(), { once: true });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
