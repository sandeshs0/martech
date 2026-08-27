/**
 * Fal.ai FLUX.1 [schnell]. Kept as the fallback provider behind lib/tools/image.ts.
 * Requires account credit — Fal has no free tier.
 */
import { fal } from "@fal-ai/client";

const MODEL = "fal-ai/flux/schnell";

let configured = false;

function configureFal() {
  const credentials = process.env.FAL_KEY;
  if (!credentials) {
    throw new Error("FAL_KEY is not set. Add it to .env.local and restart the server.");
  }
  if (!configured) {
    fal.config({ credentials });
    configured = true;
  }
}

/**
 * Fal's ApiError stringifies to just "Forbidden" / "Unauthorized", burying the
 * part that says what to actually do (billing, quota, bad key). Surface it.
 */
function describeFalError(error: unknown): string {
  if (error && typeof error === "object") {
    const withBody = error as { status?: number; body?: { detail?: unknown }; message?: string };
    const detail = withBody.body?.detail;
    const text =
      typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : withBody.message;
    if (text) return withBody.status ? `Fal.ai ${withBody.status}: ${text}` : `Fal.ai: ${text}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function generateFalImage(
  prompt: string,
): Promise<{ url: string; width: number; height: number }> {
  configureFal();

  let result;
  try {
    result = await fal.subscribe(MODEL, {
      input: {
        prompt,
        image_size: "landscape_4_3",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
      },
    });
  } catch (error) {
    throw new Error(describeFalError(error));
  }

  const image = result.data?.images?.[0];
  if (!image?.url) {
    throw new Error("Fal.ai returned no image.");
  }

  return { url: image.url, width: image.width ?? 0, height: image.height ?? 0 };
}
