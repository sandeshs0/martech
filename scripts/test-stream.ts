/**
 * Verification for the SSE run endpoint. Run with:  npm run test:stream
 * Requires the app to be running (npm run dev or npm start).
 *
 * Prints each frame as it arrives with a wall-clock offset, which is the proof
 * that events land progressively rather than all at once at the end.
 */
import { formatCost } from "../lib/llm/pricing";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const BRIEF =
  process.argv.slice(2).join(" ").trim() ||
  "Lumen needs a loud, hype-driven Q3 launch campaign. Position us as the revolutionary, " +
    "game-changing, best-in-class platform that will disrupt retail analytics forever. " +
    "Say our results are guaranteed and claim we are the #1 inventory tool on the market.";

async function main() {
  const startedAt = Date.now();
  const at = () => `+${((Date.now() - startedAt) / 1000).toFixed(2)}s`;

  const response = await fetch(`${BASE}/api/run/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: BRIEF }),
  });

  console.log(`content-type: ${response.headers.get("content-type")}\n`);
  if (!response.body) throw new Error("No response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalCost = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      const name = frame.match(/^event: (.*)$/m)?.[1];
      const raw = frame.match(/^data: (.*)$/m)?.[1];
      if (!name || !raw) continue;
      const data = JSON.parse(raw);

      if (name === "start") {
        console.log(`${at()}  start → first node: ${data.firstNode}`);
      } else if (name === "node") {
        const e = data.event;
        totalCost += e.costUsd ?? 0;
        console.log(
          `${at()}  ${e.label.padEnd(34)} ${String(e.durationMs).padStart(6)}ms  ` +
            `${e.usage ? `${String(e.usage.promptTokens).padStart(5)}in/${String(e.usage.completionTokens).padStart(4)}out` : "                "}  ` +
            `${e.costUsd ? formatCost(e.costUsd).padStart(8) : "        "}  → next: ${data.next ?? "END"}`,
        );
      } else if (name === "done") {
        console.log(`\n${at()}  done`);
        console.log(`  LLM verdict:        approved=${data.verdict?.approved}, ${data.verdict?.issues.length} issue(s)`);
        console.log(`  Deterministic scan: ${data.ruleFindings.length} hit(s) of ${data.termsChecked} banned terms`);
        for (const f of data.ruleFindings) {
          console.log(`     - "${f.term}" in ${f.location}`);
        }
        console.log(`  revisions: ${data.revisionCount}`);
        console.log(`  total cost: ${formatCost(totalCost)}   total: ${data.totalMs}ms`);
      } else if (name === "failed") {
        console.log(`${at()}  FAILED: ${data.error}`);
      }
    }
  }
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
