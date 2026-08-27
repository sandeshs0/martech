/**
 * Copywriter Agent — drafts channel-specific copy from research + brand context.
 *
 * Output is JSON validated against CampaignCopySchema, so a malformed draft
 * fails loudly here rather than corrupting the Creative Director downstream.
 *
 * On a revision pass (Phase 5) the Guardian's flagged issues are injected into
 * the prompt, which is the whole point of the loop-back edge.
 */
import { chatJSON } from "../llm/groq";
import type { TokenUsage } from "../llm/pricing";
import { formatBrandContext, type RetrievedChunk } from "../memory/store";
import { CampaignCopySchema, type CampaignCopy, type GuardianIssue } from "../graph/state";

const SYSTEM_PROMPT = `You are a senior B2B copywriter working strictly inside a brand's guidelines.

You write copy for three channels: LinkedIn, Instagram, and email.

Rules:
- The brand guidelines provided are absolute. If a guideline forbids a word or phrasing, do not use it anywhere, including in variations or synonyms that clearly evade the rule.
- Ground claims in the research provided. Do not invent statistics, customer names, or results.
- Respect the per-channel length and formatting rules in the guidelines.
- Write copy, not commentary.

Respond with JSON only, in exactly this shape:
{
  "linkedin": { "body": string, "hashtags": string[] },
  "instagram": { "caption": string, "hashtags": string[], "altText": string },
  "email": { "subject": string, "body": string, "cta": string },
  "rationale": string
}
"rationale" is 1-2 sentences on the angle you chose and why it fits the brand.`;

export async function runCopywriterAgent(input: {
  brief: string;
  researchSummary: string;
  brandChunks: RetrievedChunk[];
  revisionNotes?: GuardianIssue[];
  previousCopy?: CampaignCopy | null;
  humanFeedback?: string | null;
}): Promise<{ copy: CampaignCopy; usage: TokenUsage; latencyMs: number; attempts: number }> {
  const { brief, researchSummary, brandChunks, revisionNotes = [], previousCopy, humanFeedback } = input;

  const sections = [
    `CAMPAIGN BRIEF:\n${brief}`,
    `RESEARCH CONTEXT:\n${researchSummary}`,
    `BRAND GUIDELINES (retrieved for this campaign):\n${formatBrandContext(brandChunks)}`,
  ];

  if (humanFeedback) {
    sections.push(
      `HUMAN REVIEWER DIRECT FEEDBACK:\n${humanFeedback}\nYou MUST incorporate the above feedback from the human brand manager into your copy rewrite.`,
    );
  }

  if (revisionNotes.length > 0 && previousCopy) {
    sections.push(
      `YOUR PREVIOUS DRAFT WAS REJECTED by the Brand Guardian:\n${JSON.stringify(previousCopy, null, 2)}`,
      `ISSUES YOU MUST FIX:\n${revisionNotes
        .map((i) => `- [${i.severity}] ${i.location} — ${i.problem}\n  Required fix: ${i.fix}`)
        .join("\n")}`,
      "Rewrite the copy so every issue above is resolved. Keep what worked; change what was flagged.",
    );
  }

  const result = await chatJSON(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: sections.join("\n\n---\n\n") },
    ],
    CampaignCopySchema,
    { temperature: revisionNotes.length > 0 ? 0.4 : 0.7, maxTokens: 2048 },
  );

  return {
    copy: result.data,
    usage: result.usage,
    latencyMs: result.latencyMs,
    attempts: result.attempts,
  };
}
