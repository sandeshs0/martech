import { chat } from "../llm/groq";
import { EMPTY_USAGE, addUsage, type TokenUsage } from "../llm/pricing";
import { tavilySearch, type SearchResult } from "../tools/tavily";

export type ResearchOutput = {
  queries: string[];
  sources: SearchResult[];
  summary: string;
  latencyMs: number;
  usage: TokenUsage;
};

const MAX_QUERIES = 2;

export async function deriveSearchQueries(
  brief: string,
): Promise<{ queries: string[]; usage: TokenUsage }> {
  const { text, usage } = await chat(
    [
      {
        role: "system",
        content:
          "You are a marketing researcher. Given a campaign brief, write short web search queries " +
          "that would surface current market context, competitor activity, or audience trends " +
          `relevant to it. Output at most ${MAX_QUERIES} queries, one per line, no numbering, ` +
          "no commentary. Each query must be under 12 words and use search-engine phrasing, not a question.",
      },
      { role: "user", content: `Campaign brief:\n${brief}` },
    ],
    { temperature: 0.3, maxTokens: 150 },
  );

  const queries = text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_QUERIES);

  // If the model returns nothing usable, fall back to the brief itself rather than failing.
  return { queries: queries.length > 0 ? queries : [brief.slice(0, 120)], usage };
}

/** Step 3: synthesise search results into context the Copywriter can actually use. */
async function synthesise(
  brief: string,
  sources: SearchResult[],
): Promise<{ summary: string; usage: TokenUsage }> {
  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.content}`)
    .join("\n\n");

  const { text, usage } = await chat(
    [
      {
        role: "system",
        content:
          "You are a marketing researcher briefing a copywriter. Using ONLY the search results " +
          "provided, write 4-6 bullet points of current, concrete context relevant to the campaign " +
          "brief: market trends, audience signals, competitor angles, and any specific numbers or " +
          "dates worth citing. Cite sources inline as [1], [2]. If the results do not support a " +
          "point, leave it out. No preamble, no conclusion — bullets only.",
      },
      { role: "user", content: `Campaign brief:\n${brief}\n\nSearch results:\n${sourceBlock}` },
    ],
    { temperature: 0.4, maxTokens: 700 },
  );

  return { summary: text.trim(), usage };
}

export async function runResearchAgent(brief: string): Promise<ResearchOutput> {
  const startedAt = Date.now();

  const { queries, usage: queryUsage } = await deriveSearchQueries(brief);
  const searches = await Promise.all(queries.map((q) => tavilySearch(q, { maxResults: 4 })));

  // Flatten and de-duplicate by URL — the queries overlap by design.
  const seen = new Set<string>();
  const sources = searches
    .flatMap((s) => s.results)
    .filter((r) => (seen.has(r.url) ? false : seen.add(r.url)))
    .sort((a, b) => b.score - a.score);

  const { summary, usage: synthesisUsage } = await synthesise(brief, sources);

  return {
    queries,
    sources,
    summary,
    latencyMs: Date.now() - startedAt,
    usage: addUsage(addUsage(EMPTY_USAGE, queryUsage), synthesisUsage),
  };
}
