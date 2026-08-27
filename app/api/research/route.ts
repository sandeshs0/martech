import { NextResponse } from "next/server";
import { runResearchAgent } from "@/lib/agents/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";

    if (!brief) {
      return NextResponse.json(
        { ok: false, error: "Request body must include a non-empty 'brief' string." },
        { status: 400 },
      );
    }

    const result = await runResearchAgent(brief);
    return NextResponse.json({ ok: true, brief, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
