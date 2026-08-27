/**
 * Verification for the deterministic banned-term scan.
 * Run with:  npm run test:rule-check
 *
 * Needs no API key and no network — that is the point of this check.
 */
import { BRAND_GUIDELINES } from "../lib/memory/brand-kb";
import { extractBannedTerms, runDeterministicCheck } from "../lib/agents/rule-check";
import type { CampaignCopy, CreativeSpec } from "../lib/graph/state";

const dirty = {
  linkedin: {
    body: "Our revolutionary platform will disrupt retail analytics forever. Results are guaranteed.",
    hashtags: ["gamechanger"],
  },
  instagram: {
    caption: "The #1 inventory tool on the market.",
    hashtags: ["retail"],
    altText: "Abstract data forms in architectural light",
  },
  email: {
    subject: "A best-in-class platform",
    body: "Seamless integration that will supercharge your team.",
    cta: "Learn more",
  },
  rationale: "Test fixture.",
} satisfies CampaignCopy;

const clean = {
  linkedin: {
    body: "Most retail teams reconcile inventory by hand across three systems. See the whole picture.",
    hashtags: ["retailops"],
  },
  instagram: { caption: "Inventory data, in one view.", hashtags: ["retail"], altText: "Abstract data forms" },
  email: { subject: "Inventory in one view", body: "One place for your stock data.", cta: "See how" },
  rationale: "Test fixture.",
} satisfies CampaignCopy;

const creative = {
  concept: "Clarity",
  headline: "See clearly",
  subheadline: "One view of your inventory",
  imageConcept: "Abstract data forms in architectural light",
  palette: [{ name: "Deep Indigo", hex: "#1B1B3A", usage: "background" }],
  typography: "Bone White on Deep Indigo",
  layoutNotes: "Generous negative space",
  ctaLabel: "See how",
} satisfies CreativeSpec;

const rule = (t: string) => console.log(`\n${"─".repeat(70)}\n${t}\n${"─".repeat(70)}`);

function main() {
  rule("TERMS PARSED FROM THE KNOWLEDGE BASE");
  const terms = extractBannedTerms(BRAND_GUIDELINES);
  console.log(`${terms.length} terms: ${terms.map((t) => t.term).join(", ")}`);

  rule("NON-COMPLIANT COPY (expect many hits)");
  const bad = runDeterministicCheck(dirty, creative, BRAND_GUIDELINES);
  for (const f of bad.findings) {
    console.log(`  "${f.term}"  in ${f.location}\n     …${f.excerpt}…`);
  }
  console.log(`\n  ${bad.findings.length} finding(s) across ${bad.termsChecked} terms checked`);

  rule("COMPLIANT COPY (expect zero hits)");
  const good = runDeterministicCheck(clean, creative, BRAND_GUIDELINES);
  console.log(`  ${good.findings.length} finding(s)`);

  rule("CUSTOM KNOWLEDGE BASE (terms follow the KB, not the code)");
  const custom = [
    {
      id: "banned",
      category: "Prohibited Language",
      text: "Never use the words 'calm', 'gentle', or 'wellness' in any campaign copy.",
    },
    {
      // Conditional rule — must NOT contribute banned terms.
      id: "legal",
      category: "Legal & Claims Compliance",
      text: "Do not use 'certified' or 'organic' without naming the certifying body.",
    },
  ];
  const customTerms = extractBannedTerms(custom);
  console.log(`  ${customTerms.length} terms: ${customTerms.map((t) => t.term).join(", ")}`);
  const customCheck = runDeterministicCheck(
    { ...clean, email: { ...clean.email, subject: "A calm approach to wellness" } },
    creative,
    custom,
  );
  console.log(`  ${customCheck.findings.length} finding(s): ${customCheck.findings.map((f) => f.term).join(", ")}`);

  const pass = bad.findings.length > 0 && good.findings.length === 0 && customCheck.findings.length === 2;
  console.log(`\n${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main();
