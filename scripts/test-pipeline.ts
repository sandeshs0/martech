/**
 * Phase 4 verification. Run with:  npm run test:pipeline
 * Optionally pass your own brief:  npm run test:pipeline -- "your brief here"
 *
 * Prints every intermediate state, not just the final output.
 */
import { runPipeline } from "../lib/graph/pipeline";

const DEFAULT_BRIEF =
  "Samsung Nepal is launching the Galaxy S26 series in Nepal for Dashain, with a 10% " +
  "festival discount. Audience is urban Nepali professionals aged 25-40 upgrading from an " +
  "older Galaxy or a competitor flagship. Lead with Galaxy AI and camera quality, tie it to " +
  "Dashain gifting, and state the offer clearly. Run it on LinkedIn, Instagram, and email.";

const rule = (title: string) => console.log(`\n${"─".repeat(78)}\n${title}\n${"─".repeat(78)}`);

async function main() {
  const brief = process.argv.slice(2).join(" ").trim() || DEFAULT_BRIEF;
  const startedAt = Date.now();

  console.log("BRIEF:\n" + brief);

  const state = await runPipeline(brief);

  rule("1. RESEARCH AGENT");
  console.log("Queries chosen: " + state.research?.queries.join(" | "));
  console.log(`Sources: ${state.research?.sources.length}`);
  state.research?.sources.slice(0, 4).forEach((s) => console.log(`  - ${s.title}\n    ${s.url}`));
  console.log("\nSummary:\n" + state.research?.summary);

  rule("2. BRAND MEMORY AGENT (RAG)");
  state.brandChunks.forEach((c) =>
    console.log(`  [${c.score.toFixed(4)}] ${c.category} (${c.id})`),
  );

  rule("3. COPYWRITER AGENT");
  console.log(JSON.stringify(state.copy, null, 2));

  rule("4. CREATIVE DIRECTOR AGENT");
  console.log(JSON.stringify(state.creative, null, 2));

  rule("5. BRAND GUARDIAN AGENT (forced tool call)");
  console.log(`approved: ${state.verdict?.approved}`);
  console.log(`summary:  ${state.verdict?.summary}`);
  if (state.verdict?.issues.length) {
    console.log("issues:");
    state.verdict.issues.forEach((i, n) =>
      console.log(
        `  ${n + 1}. [${i.severity}] ${i.location} — ${i.guideline}\n     problem: ${i.problem}\n     fix:     ${i.fix}`,
      ),
    );
  } else {
    console.log("issues:   none");
  }

  rule("EXECUTION TRACE");
  for (const e of state.trace) {
    console.log(
      `  ${e.label.padEnd(28)} ${String(e.durationMs).padStart(6)}ms  ${
        e.tokens ? `${String(e.tokens).padStart(5)} tok` : "        "
      }  ${e.detail}`,
    );
  }
  console.log(`\nTOTAL: ${Date.now() - startedAt}ms   revisions: ${state.revisionCount}`);
}

main().catch((error) => {
  console.error("\nPIPELINE FAILED:", error);
  process.exit(1);
});
