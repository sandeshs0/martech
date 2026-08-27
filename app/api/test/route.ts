import { NextResponse } from "next/server";
import { GROQ_MODEL, chat, listModelIds } from "@/lib/llm/groq";

// Groq calls need the Node runtime, and this route must never be cached —
// a cached "LLM response" would be exactly the kind of fake output we're avoiding.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prompt =
    new URL(request.url).searchParams.get("prompt") ??
    "In one sentence, what is agentic AI in marketing?";

  try {
    const [modelIds, result] = await Promise.all([
      listModelIds(),
      chat([{ role: "user", content: prompt }], { temperature: 0.3, maxTokens: 200 }),
    ]);

    return NextResponse.json({
      ok: true,
      prompt,
      reply: result.text,
      model: result.model,
      configuredModelAvailable: modelIds.includes(GROQ_MODEL),
      usage: result.usage,
      latencyMs: result.latencyMs,
      availableModels: modelIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
