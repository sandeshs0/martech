/**
 * Brand Memory Agent — RAG retrieval over the brand guideline store.
 *
 * Two entry points, because the two consumers need different rules:
 *
 *   - The Copywriter needs the guidelines that shape *writing* this campaign.
 *   - The Brand Guardian needs the guidelines it must *enforce*, which are not
 *     the same set. Reusing the Copywriter's chunks meant the Guardian reviewed
 *     against an incomplete rulebook and approved copy that broke the channel
 *     length limits it had never been shown.
 *
 * Each agent retrieving for its own task is what keeps the RAG step meaningful
 * on a knowledge base this small — retrieving all six every time would make it
 * decorative.
 */
import { retrieveBrandContext, type RetrievedChunk } from "../memory/store";
import type { BrandGuideline } from "../memory/brand-kb";
import type { CampaignCopy, CreativeSpec } from "../graph/state";

export async function runBrandMemoryAgent(
  brief: string,
  researchSummary: string,
  k = 4,
  guidelines?: BrandGuideline[],
): Promise<RetrievedChunk[]> {
  const query = [
    brief,
    researchSummary,
    // Nudge retrieval toward the rules that matter when writing copy.
    "tone of voice, prohibited language, legal claims, tagline placement, channel formatting, colour palette",
  ]
    .filter(Boolean)
    .join("\n\n");

  return retrieveBrandContext(query, k, guidelines);
}

/**
 * Retrieval for the review step. The query is built from the work under review
 * plus an explicit compliance checklist, so the guidelines that come back are
 * the ones that can actually be violated by this specific output.
 */
export async function retrieveComplianceGuidelines(
  copy: CampaignCopy,
  creative: CreativeSpec,
  k = 4,
  guidelines?: BrandGuideline[],
): Promise<RetrievedChunk[]> {
  const query = [
    "Compliance review checklist: prohibited words and banned phrases, unsourced performance claims " +
      "and guaranteed outcomes, tagline wording and placement, post length limits, hashtag counts, " +
      "emoji rules, alt text, subject line length, colour palette and imagery restrictions, tone of voice.",
    `LinkedIn: ${copy.linkedin.body}`,
    `Instagram: ${copy.instagram.caption}`,
    `Email subject: ${copy.email.subject}`,
    `Creative headline: ${creative.headline}`,
  ].join("\n\n");

  return retrieveBrandContext(query, k, guidelines);
}
