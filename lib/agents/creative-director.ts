/**
 * Creative Director Agent — turns approved copy into a structured ad creative spec.
 *
 * The output is a real design brief (headline, palette with hex codes, layout,
 * image concept), not prose. That structure is what the Phase 6 UI renders as
 * creative cards and what Phase 7 feeds to Fal.ai as an image prompt.
 */
import { chatJSON } from "../llm/groq";
import type { TokenUsage } from "../llm/pricing";
import { formatBrandContext, type RetrievedChunk } from "../memory/store";
import { CreativeSpecSchema, type CampaignCopy, type CreativeSpec } from "../graph/state";

const SYSTEM_PROMPT = `You are an art director translating approved campaign copy into a single ad creative specification.

Rules:
- The palette must come from the brand guidelines provided. Use the exact hex codes given. Do not invent brand colours.
- Honour every visual prohibition in the guidelines (banned imagery, gradient rules, accent-colour limits).
- The headline must be short enough to work as a display line — under 60 characters.
- "imageConcept" is a prompt for an image generation model: describe subject, composition, lighting, and style in one dense sentence. It must describe no text, no logos, and no readable words in the image.
- Do not use any language the guidelines prohibit.

Respond with JSON only, in exactly this shape:
{
  "concept": string,
  "headline": string,
  "subheadline": string,
  "imageConcept": string,
  "palette": [ { "name": string, "hex": "#RRGGBB", "usage": string } ],
  "typography": string,
  "layoutNotes": string,
  "ctaLabel": string
}`;

export async function runCreativeDirectorAgent(input: {
  brief: string;
  copy: CampaignCopy;
  brandChunks: RetrievedChunk[];
}): Promise<{ creative: CreativeSpec; usage: TokenUsage; latencyMs: number; attempts: number }> {
  const result = await chatJSON(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `CAMPAIGN BRIEF:\n${input.brief}`,
          `APPROVED COPY:\n${JSON.stringify(input.copy, null, 2)}`,
          `BRAND GUIDELINES:\n${formatBrandContext(input.brandChunks)}`,
        ].join("\n\n---\n\n"),
      },
    ],
    CreativeSpecSchema,
    { temperature: 0.6, maxTokens: 1500 },
  );

  return {
    creative: result.data,
    usage: result.usage,
    latencyMs: result.latencyMs,
    attempts: result.attempts,
  };
}
