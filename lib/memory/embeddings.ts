/**
 * Local sentence embeddings via @xenova/transformers (all-MiniLM-L6-v2).
 *
 * Runs entirely on this machine — no API key, no network after the first run,
 * which downloads and caches the ~25MB quantised ONNX model.
 *
 * This is a hand-written adapter to LangChain's `Embeddings` interface rather
 * than a prebuilt integration, so the whole path from text to 384-dim vector is
 * about ten lines you can read and explain.
 */
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

/** The model is loaded once per process and reused for every call. */
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      EMBEDDING_MODEL,
    ) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export class LocalEmbeddings extends Embeddings {
  constructor(params: EmbeddingsParams = {}) {
    super(params);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    return vector;
  }

  /**
   * Mean-pools the token embeddings into one vector per input and L2-normalises
   * it, which is what all-MiniLM-L6-v2 expects and what makes a plain dot
   * product equal to cosine similarity.
   */
  private async embed(texts: string[]): Promise<number[][]> {
    const extractor = await getExtractor();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist() as number[][];
  }
}
