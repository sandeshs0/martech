/**
 * Phase 3 verification. Run with:  npm run test:research
 * Optionally pass your own brief:  npm run test:research -- "your brief here"
 */
import { runResearchAgent } from "../lib/agents/research";

const DEFAULT_BRIEF =
  "Lumen is launching a campaign for Q3 aimed at mid-market retail operations leaders. " +
  "The angle is that most retail teams still reconcile inventory and sales data by hand " +
  "across three or four disconnected systems. We want to run it on LinkedIn, Instagram, and email.";

async function main() {
  const brief = process.argv.slice(2).join(" ").trim() || DEFAULT_BRIEF;

  console.log("BRIEF:");
  console.log(brief + "\n");

  const result = await runResearchAgent(brief);

  console.log("─".repeat(78));
  console.log("SEARCH QUERIES the agent chose:");
  result.queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  console.log("\n" + "─".repeat(78));
  console.log(`SOURCES (${result.sources.length} unique URLs):`);
  for (const s of result.sources) {
    console.log(`  [${s.score.toFixed(3)}] ${s.title}`);
    console.log(`          ${s.url}${s.publishedDate ? `  (${s.publishedDate})` : ""}`);
  }

  console.log("\n" + "─".repeat(78));
  console.log("SYNTHESISED SUMMARY:");
  console.log(result.summary);

  console.log("\n" + "─".repeat(78));
  console.log(`Total: ${result.latencyMs}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
