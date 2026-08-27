/**
 * Tavily web search — the Research Agent's only external tool.
 *
 * Called over plain fetch rather than an SDK: it's one POST, and keeping it
 * raw means the exact request and response shape are visible in this file.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  /** Tavily's own one-paragraph answer, when requested. */
  answer?: string;
  latencyMs: number;
};

export async function tavilySearch(
  query: string,
  options: { maxResults?: number; searchDepth?: "basic" | "advanced"; days?: number } = {},
): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }

  const startedAt = Date.now();
  const response = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: options.maxResults ?? 5,
      search_depth: options.searchDepth ?? "basic",
      include_answer: true,
      topic: "general",
      // Bias toward recent pages — the point of this agent is *current* context.
      days: options.days ?? 180,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tavily search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();

  return {
    query,
    answer: data.answer ?? undefined,
    latencyMs: Date.now() - startedAt,
    results: (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? ""),
      score: Number(r.score ?? 0),
      publishedDate: r.published_date ? String(r.published_date) : undefined,
    })),
  };
}
