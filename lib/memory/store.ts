/**
 * Brand Memory: guidelines embedded into an in-memory vector store, plus the
 * retrieval function the agents call.
 *
 * The guideline set is editable from the UI, so it is passed in per request
 * rather than read from a module-level singleton. Stores are cached by a hash
 * of their content: editing a guideline produces a new key and a fresh
 * embedding pass, while repeated runs on the same set reuse the vectors.
 * Keeping this stateless avoids "whose guidelines are these" bugs when more
 * than one browser tab is open.
 */
import { createHash } from "node:crypto";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { BRAND_GUIDELINES, type BrandGuideline } from "./brand-kb";
import { LocalEmbeddings } from "./embeddings";

export type RetrievedChunk = {
  id: string;
  category: string;
  text: string;
  /** Cosine similarity, 0-1. Higher is more relevant. */
  score: number;
};

const storeCache = new Map<string, Promise<MemoryVectorStore>>();
const MAX_CACHED_STORES = 8;

function cacheKey(guidelines: BrandGuideline[]): string {
  return createHash("sha1").update(JSON.stringify(guidelines)).digest("hex");
}

export function getBrandStore(
  guidelines: BrandGuideline[] = BRAND_GUIDELINES,
): Promise<MemoryVectorStore> {
  const key = cacheKey(guidelines);
  const cached = storeCache.get(key);
  if (cached) return cached;

  const building = MemoryVectorStore.fromDocuments(
    guidelines.map(
      (g) =>
        new Document({
          pageContent: `${g.category}: ${g.text}`,
          metadata: { id: g.id, category: g.category },
        }),
    ),
    new LocalEmbeddings(),
  );

  // Evict oldest so a long editing session cannot grow this without bound.
  if (storeCache.size >= MAX_CACHED_STORES) {
    const oldest = storeCache.keys().next().value;
    if (oldest) storeCache.delete(oldest);
  }
  storeCache.set(key, building);
  return building;
}

/**
 * Embeds `query` and returns the `k` most similar guidelines.
 * Used to give each agent only the brand rules relevant to its task.
 */
export async function retrieveBrandContext(
  query: string,
  k = 3,
  guidelines: BrandGuideline[] = BRAND_GUIDELINES,
): Promise<RetrievedChunk[]> {
  const store = await getBrandStore(guidelines);
  const results = await store.similaritySearchWithScore(query, Math.min(k, guidelines.length));

  return results.map(([doc, score]) => ({
    id: doc.metadata.id as string,
    category: doc.metadata.category as string,
    text: doc.pageContent,
    score,
  }));
}

/** Formats retrieved chunks for injection into an agent prompt. */
export function formatBrandContext(chunks: RetrievedChunk[]): string {
  return chunks.map((c) => `- ${c.text}`).join("\n");
}
