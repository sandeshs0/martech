import { NextResponse } from "next/server";
import { generateCreativeImage } from "@/lib/tools/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const imageConcept = typeof body.imageConcept === "string" ? body.imageConcept.trim() : "";
    const palette = Array.isArray(body.palette) ? body.palette : [];

    if (!imageConcept) {
      return NextResponse.json(
        { ok: false, error: "Request body must include a non-empty 'imageConcept' string." },
        { status: 400 },
      );
    }

    const image = await generateCreativeImage(imageConcept, palette);
    return NextResponse.json({ ok: true, ...image });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
