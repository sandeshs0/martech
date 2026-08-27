/**
 * Google Gemini image generation via the Generative Language REST API.
 *
 * Plain fetch, matching the other tool clients. The model returns the image as
 * base64 inline data rather than a URL, so this returns a data: URI that the
 * <img> tag can render directly — no storage, no signed URLs, nothing to expire
 * mid-demo.
 *
 * The model id is env-overridable because Google renames these frequently; if
 * the default 404s, set GEMINI_IMAGE_MODEL rather than editing code.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// `||` not `??` — an empty env var must fall through to the default, not blank it.
export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

export type GeminiImage = {
  /** data:image/png;base64,… — renderable directly. */
  url: string;
  mimeType: string;
  bytes: number;
};

type Part = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

export async function geminiGenerateImage(prompt: string): Promise<GeminiImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local and restart the server.");
  }

  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(GEMINI_IMAGE_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    let detail = body.slice(0, 400);
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message ?? detail;
    } catch {
      // Non-JSON error body — the raw text is the best we have.
    }
    throw new Error(`Gemini ${response.status} (${GEMINI_IMAGE_MODEL}): ${detail}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const parts: Part[] = candidate?.content?.parts ?? [];

  const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const base64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;

  if (!base64) {
    // The model refuses by replying in text — surface that instead of a generic error.
    const text = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join(" ")
      .trim();
    const reason = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : "";
    throw new Error(
      text
        ? `Gemini returned text instead of an image${reason}: ${text.slice(0, 300)}`
        : `Gemini returned no image data${reason}.`,
    );
  }

  const mimeType = imagePart?.inlineData?.mimeType ?? imagePart?.inline_data?.mime_type ?? "image/png";

  return {
    url: `data:${mimeType};base64,${base64}`,
    mimeType,
    // Rough decoded size, for the log line.
    bytes: Math.floor((base64.length * 3) / 4),
  };
}
