/**
 * Token cost estimation.
 *
 * Rates are USD per million tokens, checked against Groq's published pricing.
 * They are constants here rather than fetched, so if Groq changes pricing this
 * file is the one place to update — and every figure in the UI is labelled as
 * an estimate for that reason.
 */

export const PRICING_UPDATED = "2026-08";

export type ModelRate = { inputPerMillion: number; outputPerMillion: number };

export const MODEL_RATES: Record<string, ModelRate> = {
  "openai/gpt-oss-120b": { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  "qwen/qwen3.6-27b": { inputPerMillion: 0.35, outputPerMillion: 0.45 },
  "llama-3.3-70b-versatile": { inputPerMillion: 0.59, outputPerMillion: 0.79 },
};

/** Falls back to the primary model's rate so an unknown model never reports $0. */
const DEFAULT_RATE = MODEL_RATES["openai/gpt-oss-120b"] ?? { inputPerMillion: 0.59, outputPerMillion: 0.79 };

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/** Cost in USD for one agent's token usage. */
export function estimateCost(usage: TokenUsage, model = "llama-3.3-70b-versatile"): number {
  const rate = MODEL_RATES[model] ?? DEFAULT_RATE;
  return (
    (usage.promptTokens / 1_000_000) * rate.inputPerMillion +
    (usage.completionTokens / 1_000_000) * rate.outputPerMillion
  );
}

/** Formats sub-cent amounts readably — most runs land around $0.002. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
