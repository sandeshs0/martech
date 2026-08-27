import { MAX_REVISIONS, buildPipeline, routeAfterGuardian } from "@/lib/graph/pipeline";
import { BrandGuidelinesSchema, type BrandGuideline } from "@/lib/memory/brand-kb";
import type { PipelineState } from "@/lib/graph/state";
import { END } from "@langchain/langgraph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Server-Sent Events version of /api/run.
 *
 * The non-streaming route still exists for scripts and for anything that wants
 * one JSON blob. This one emits each node the moment it finishes, so the UI
 * shows real progress instead of replaying a finished run — which is the honest
 * way to present it to an audience that will ask whether it is a recording.
 *
 * EventSource only speaks GET, and the brief has to be POSTed, so the client
 * parses this stream by hand rather than using EventSource.
 */

/** Static successor for every node except the Guardian, whose next hop is conditional. */
const NEXT_NODE: Record<string, string | null> = {
  researchAgent: "brandMemoryAgent",
  brandMemoryAgent: "copywriterAgent",
  copywriterAgent: "creativeDirectorAgent",
  creativeDirectorAgent: "brandGuardianAgent",
};

function nextAfter(agent: string, state: PipelineState): string | null {
  if (agent !== "brandGuardianAgent") return NEXT_NODE[agent] ?? null;
  return routeAfterGuardian(state) === END ? null : "copywriterAgent";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";

  if (!brief) {
    return Response.json(
      { ok: false, error: "Request body must include a non-empty 'brief' string." },
      { status: 400 },
    );
  }

  let guidelines: BrandGuideline[] | undefined;
  if (body.guidelines !== undefined) {
    const parsed = BrandGuidelinesSchema.safeParse(body.guidelines);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: `Invalid guidelines: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }
    guidelines = parsed.data;
  }

  const hitlEnabled = Boolean(body.hitlEnabled);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("start", { brief, firstNode: "researchAgent", maxRevisions: MAX_REVISIONS, hitlEnabled });

        const graph = buildPipeline();
        const input = guidelines ? { brief, guidelines, hitlEnabled } : { brief, hitlEnabled };

        let latest: PipelineState | null = null;
        let emittedTrace = 0;

        // "values" yields the full accumulated state after each super-step. We
        // only forward the trace entries that are new, so payloads stay small.
        for await (const state of await graph.stream(input, { streamMode: "values" })) {
          latest = state as PipelineState;
          const fresh = latest.trace.slice(emittedTrace);
          emittedTrace = latest.trace.length;

          for (const event of fresh) {
            send("node", { event, next: nextAfter(event.agent, latest) });
          }
        }

        if (!latest) throw new Error("Graph produced no state.");

        const runResult = {
          ok: true as const,
          totalMs: Date.now() - startedAt,
          brief: latest.brief,
          research: latest.research,
          brandChunks: latest.brandChunks,
          guardianChunks: latest.guardianChunks,
          copy: latest.copy,
          creative: latest.creative,
          verdict: latest.verdict,
          verdictHistory: latest.verdictHistory,
          ruleFindings: latest.ruleFindings,
          termsChecked: latest.termsChecked,
          revisionCount: latest.revisionCount,
          trace: latest.trace,
        };

        if (hitlEnabled) {
          send("approval_required", { state: runResult });
        } else {
          send("done", runResult);
        }
      } catch (error) {
        send("failed", {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          totalMs: Date.now() - startedAt,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops proxies (and Vercel's edge) from buffering the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
