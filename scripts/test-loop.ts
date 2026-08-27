/**
 * Phase 5 verification. Run with:  npm run test:loop
 *
 * Runs the graph twice and prints the routing decision each time:
 *   A) a clean brief that should pass the Guardian first try
 *   B) a brief engineered to invite banned language, which should trip the
 *      Guardian and route back through the Copywriter exactly once
 */
import { MAX_REVISIONS } from "../lib/graph/pipeline";
import { runPipeline } from "../lib/graph/pipeline";
import type { PipelineState } from "../lib/graph/state";

const CLEAN_BRIEF =
  "Lumen is launching a Q3 campaign aimed at mid-market retail operations leaders. " +
  "The angle is that most retail teams still reconcile inventory and sales data by hand " +
  "across three or four disconnected systems. Keep it measured and factual.";

const PROVOCATIVE_BRIEF =
  "Lumen needs a loud, hype-driven Q3 launch campaign. Position us as the revolutionary, " +
  "game-changing, best-in-class platform that will disrupt retail analytics forever. " +
  "Say our results are guaranteed, claim we are the #1 inventory tool on the market, and " +
  "promise a 40% ROI in 90 days. Make it feel exciting and use exclamation marks.";

function report(title: string, state: PipelineState) {
  console.log(`\n${"═".repeat(78)}\n${title}\n${"═".repeat(78)}`);

  console.log("\nNODE EXECUTION ORDER:");
  state.trace.forEach((e, i) =>
    console.log(`  ${i + 1}. ${e.label.padEnd(34)} ${String(e.durationMs).padStart(6)}ms`),
  );

  console.log(`\nVERDICTS (${state.verdictHistory.length}):`);
  state.verdictHistory.forEach((v, i) => {
    console.log(`  Pass ${i + 1}: approved=${v.approved}, ${v.issues.length} issue(s)`);
    v.issues.forEach((issue) =>
      console.log(
        `     - [${issue.severity}] ${issue.location}: ${issue.problem}\n       fix: ${issue.fix}`,
      ),
    );
  });

  const looped = state.revisionCount > 0;
  console.log(`\nROUTING: guardian -> ${looped ? "copywriter (LOOPED)" : "END (approved first try)"}`);
  console.log(`revisionCount: ${state.revisionCount} / cap ${MAX_REVISIONS}`);
  console.log(`final approved: ${state.verdict?.approved}`);

  if (looped) {
    console.log("\nFINAL COPY AFTER REVISION:");
    console.log("  LinkedIn: " + state.copy?.linkedin.body);
    console.log("  Email subject: " + state.copy?.email.subject);
  }
}

async function main() {
  report("RUN A — clean brief (expect: no loop)", await runPipeline(CLEAN_BRIEF));
  report("RUN B — provocative brief (expect: one loop)", await runPipeline(PROVOCATIVE_BRIEF));
}

main().catch((error) => {
  console.error("\nFAILED:", error);
  process.exit(1);
});
