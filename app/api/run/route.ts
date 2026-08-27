import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/graph/pipeline";
import { BrandGuidelinesSchema, type BrandGuideline } from "@/lib/memory/brand-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";

    if (!brief) {
      return NextResponse.json(
        { ok: false, error: "Request body must include a non-empty 'brief' string." },
        { status: 400 },
      );
    }

    // Guidelines are editable in the UI, so validate whatever arrives before embedding it.
    let guidelines: BrandGuideline[] | undefined;
    if (body.guidelines !== undefined) {
      const parsed = BrandGuidelinesSchema.safeParse(body.guidelines);
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: `Invalid guidelines: ${parsed.error.issues[0]?.message}` },
          { status: 400 },
        );
      }
      guidelines = parsed.data;
    }

    const state = await runPipeline(brief, guidelines);

    return NextResponse.json({
      ok: true,
      totalMs: Date.now() - startedAt,
      brief: state.brief,
      research: state.research,
      brandChunks: state.brandChunks,
      guardianChunks: state.guardianChunks,
      copy: state.copy,
      creative: state.creative,
      verdict: state.verdict,
      verdictHistory: state.verdictHistory,
      ruleFindings: state.ruleFindings,
      termsChecked: state.termsChecked,
      revisionCount: state.revisionCount,
      trace: state.trace,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message, totalMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}
