/**
 * Together.ai image generation — FLUX.1 [schnell] on their free endpoint.
 *
 * Plain fetch rather than an SDK, matching lib/tools/tavily.ts: it is one POST,
 * and keeping it raw means the request and response shape are visible here.
 */

const TOGETHER_ENDPOINT = "https://api.together.xyz/v1/images/generations";

/** The free variant. Capped at 4 steps and one image per request. */
export const TOGETHER_MODEL = "black-forest-labs/FLUX.1-schnell-Free";

export type TogetherImage = {
  url: string;
  width: number;
  height: number;
};

export async function togetherGenerateImage(prompt: string): Promise<TogetherImage> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TOGETHER_API_KEY is not set. Add it to .env.local and restart the server.",
    );
  }

  const width = 1024;
  const height = 768;

  const response = await fetch(TOGETHER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TOGETHER_MODEL,
      prompt,
      width,
      height,
      steps: 4,
      n: 1,
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // Together nests the useful part under { error: { message } }.
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message ?? parsed?.message ?? detail;
    } catch {
      // Non-JSON error body — the raw text is the best we have.
    }
    throw new Error(`Together.ai ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const url = data?.data?.[0]?.url;
  if (typeof url !== "string" || !url) {
    throw new Error("Together.ai returned no image URL.");
  }

  return { url, width, height };
}
