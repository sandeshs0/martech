/**
 * Brand Guardian Agent — reviews copy + creative against the brand guidelines.
 *
 * The verdict comes back through a *forced* Groq tool call: `tool_choice` pins
 * the model to `submit_verdict`, so it physically cannot answer in prose. There
 * is no regex, no "look for the word APPROVED" — the structured object is the
 * only thing the API can return, and Zod validates it on arrival.
 */
import { chatWithForcedTool } from "../llm/groq";
import type { TokenUsage } from "../llm/pricing";
import { formatBrandContext, type RetrievedChunk } from "../memory/store";
import {
  GUARDIAN_TOOL_PARAMETERS,
  GuardianVerdictSchema,
  type CampaignCopy,
  type CreativeSpec,
  type GuardianVerdict,
} from "../graph/state";

const SYSTEM_PROMPT = `You are a brand compliance reviewer. You audit marketing copy and creative against a brand's guidelines and return a verdict.

How to judge:
- Check every channel of the copy and every field of the creative spec against every guideline provided.
- A banned word or phrase anywhere is "critical", even inside a quotation or a hashtag.
- An unsourced performance claim, a guaranteed outcome, or a competitor comparison is "critical".
- A broken tagline, formatting, or palette rule is "major".
- Tone drift that breaks no explicit rule is "minor".
- Set approved to false if there is any critical or major issue. Minor issues alone may still be approved.
- Quote the exact offending text in "problem" and give a concrete rewrite in "fix".
- Do not invent violations. If the work is compliant, approve it with an empty issues array.

Argument formatting:
- Your arguments must be strictly valid JSON. Use double quotes for every string.
- Never backslash-escape a single quote. If you need to reference text containing an apostrophe, paraphrase it rather than quoting it verbatim.

You must call the submit_verdict function.`;

export async function runBrandGuardianAgent(input: {
  brief: string;
  copy: CampaignCopy;
  creative: CreativeSpec;
  brandChunks: RetrievedChunk[];
}): Promise<{
  verdict: GuardianVerdict;
  usage: TokenUsage;
  latencyMs: number;
  rawArguments: string;
  attempts: number;
  salvaged: boolean;
}> {
  const result = await chatWithForcedTool(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `CAMPAIGN BRIEF:\n${input.brief}`,
          `BRAND GUIDELINES:\n${formatBrandContext(input.brandChunks)}`,
          `COPY UNDER REVIEW:\n${JSON.stringify(input.copy, null, 2)}`,
          `CREATIVE UNDER REVIEW:\n${JSON.stringify(input.creative, null, 2)}`,
        ].join("\n\n---\n\n"),
      },
    ],
    {
      name: "submit_verdict",
      description:
        "Submit the brand compliance verdict for the campaign copy and creative under review.",
      parameters: GUARDIAN_TOOL_PARAMETERS,
    },
    GuardianVerdictSchema,
    { temperature: 0.1, maxTokens: 2048 },
  );

  return {
    verdict: result.data,
    usage: result.usage,
    latencyMs: result.latencyMs,
    rawArguments: result.rawArguments,
    attempts: result.attempts,
    salvaged: result.salvaged,
  };
}
