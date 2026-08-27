/**
 * Deterministic brand rule check.
 *
 * Runs alongside the LLM Brand Guardian, not instead of it. The two catch
 * different things and neither is redundant:
 *
 *   - This scan is exact and cannot hallucinate. If a banned term appears, it
 *     is found, every time, in ~0ms and at no token cost.
 *   - The LLM catches what a regex cannot: unsourced claims, tone drift,
 *     implied guarantees, a tagline that has been subtly reworded.
 *
 * Banned terms are parsed out of the knowledge base itself rather than
 * hardcoded, so editing a guideline in the UI changes what this scan enforces.
 */
import type { BrandGuideline } from "../memory/brand-kb";
import type { CampaignCopy, CreativeSpec } from "../graph/state";

export type RuleFinding = {
  term: string;
  /** Where it appears, e.g. "linkedin.body" — same shape the LLM Guardian uses. */
  location: string;
  /** The offending text with a little surrounding context. */
  excerpt: string;
  guidelineId: string;
  guideline: string;
};

/**
 * Only guidelines whose *category* is a prohibition list are scanned.
 *
 * Matching on body text as well was too loose: the Legal & Claims guideline
 * says "do not use 'compliant', 'certified', or 'secure' without naming the
 * standard" — conditionally allowed, not banned. Treating those as absolute
 * produced false positives on compliant copy, which is worse than a miss here,
 * because the LLM Guardian is the half that handles conditional rules.
 */
const PROHIBITION_PATTERN = /prohibit|banned|forbidden|blocklist|blacklist/i;

/**
 * Pulls quoted terms out of a guideline's text — the KB writes banned words as
 * 'revolutionary', 'game-changer', and so on. Straight and curly quotes both.
 */
export function extractBannedTerms(
  guidelines: BrandGuideline[],
): { term: string; guidelineId: string; guideline: string }[] {
  const terms: { term: string; guidelineId: string; guideline: string }[] = [];
  const seen = new Set<string>();

  for (const guideline of guidelines) {
    // Category only — see the note on PROHIBITION_PATTERN. A custom KB that
    // wants terms scanned should name the category accordingly.
    if (!PROHIBITION_PATTERN.test(guideline.category)) continue;

    for (const match of guideline.text.matchAll(/['‘’"“”]([^'‘’"“”]{2,40})['‘’"“”]/g)) {
      const term = match[1].trim().toLowerCase();
      // Skip anything that looks like a sentence rather than a term.
      if (!term || term.split(/\s+/).length > 4 || seen.has(term)) continue;
      seen.add(term);
      terms.push({ term, guidelineId: guideline.id, guideline: guideline.category });
    }
  }

  return terms;
}

/** Every text field the check should look at, tagged with its location. */
function fieldsOf(copy: CampaignCopy, creative: CreativeSpec): [string, string][] {
  return [
    ["linkedin.body", copy.linkedin.body],
    ["linkedin.hashtags", copy.linkedin.hashtags.join(" ")],
    ["instagram.caption", copy.instagram.caption],
    ["instagram.hashtags", copy.instagram.hashtags.join(" ")],
    ["instagram.altText", copy.instagram.altText],
    ["email.subject", copy.email.subject],
    ["email.body", copy.email.body],
    ["email.cta", copy.email.cta],
    ["creative.concept", creative.concept],
    ["creative.headline", creative.headline],
    ["creative.subheadline", creative.subheadline],
    ["creative.ctaLabel", creative.ctaLabel],
    ["creative.imageConcept", creative.imageConcept],
  ];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Word-boundary match so "disrupt" flags "disrupt" and "disruptive" but not
 * "undisrupted" inside a longer word. Terms containing punctuation (like "#1")
 * fall back to a plain substring match, since \b does not behave there.
 */
function findTerm(haystack: string, term: string): number {
  const wordish = /^[a-z0-9][a-z0-9 '-]*$/i.test(term);
  const pattern = wordish
    ? new RegExp(`\\b${escapeRegex(term)}\\w*`, "i")
    : new RegExp(escapeRegex(term), "i");
  return haystack.search(pattern);
}

export function runDeterministicCheck(
  copy: CampaignCopy,
  creative: CreativeSpec,
  guidelines: BrandGuideline[],
): { findings: RuleFinding[]; termsChecked: number } {
  const terms = extractBannedTerms(guidelines);
  const findings: RuleFinding[] = [];

  for (const [location, text] of fieldsOf(copy, creative)) {
    if (!text) continue;
    for (const { term, guidelineId, guideline } of terms) {
      const index = findTerm(text, term);
      if (index === -1) continue;

      findings.push({
        term,
        location,
        excerpt: text.slice(Math.max(0, index - 30), index + term.length + 30).trim(),
        guidelineId,
        guideline,
      });
    }
  }

  return { findings, termsChecked: terms.length };
}
