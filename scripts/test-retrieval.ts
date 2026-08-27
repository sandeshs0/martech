/**
 * Phase 2 verification. Run with:  npm run test:retrieval
 *
 * No server and no UI — this exercises lib/memory directly to prove the
 * embedding + retrieval path works on its own.
 */
import { BRAND_GUIDELINES } from "../lib/memory/brand-kb";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, LocalEmbeddings } from "../lib/memory/embeddings";
import { retrieveBrandContext } from "../lib/memory/store";

const QUERIES = [
  "What colours and imagery can I use for the ad creative?",
  "Can I say our product is guaranteed to be the best in the industry?",
  "How long should a LinkedIn post be and how many hashtags?",
  "Where do I put the tagline?",
];

async function main() {
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`Knowledge base:  ${BRAND_GUIDELINES.length} guidelines\n`);

  // Prove the embeddings are real vectors of the expected shape.
  const probeStart = Date.now();
  const probe = await new LocalEmbeddings().embedQuery("brand voice");
  console.log(
    `Sample vector:   ${probe.length} dims (expected ${EMBEDDING_DIMENSIONS}), ` +
      `first 4 = [${probe.slice(0, 4).map((n) => n.toFixed(4)).join(", ")}]`,
  );
  console.log(`Model load + 1 embed: ${Date.now() - probeStart}ms\n`);

  for (const query of QUERIES) {
    const start = Date.now();
    const chunks = await retrieveBrandContext(query, 3);
    console.log("─".repeat(78));
    console.log(`QUERY: ${query}   (${Date.now() - start}ms)`);
    for (const [i, c] of chunks.entries()) {
      console.log(`  ${i + 1}. [${c.score.toFixed(4)}] ${c.category}  (${c.id})`);
      console.log(`     ${c.text.slice(0, 150)}...`);
    }
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
