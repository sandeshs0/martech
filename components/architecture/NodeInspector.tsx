"use client";

import { Badge, Button } from "../ui";
import { BRAND_GUIDELINES } from "@/lib/memory/brand-kb";
import type { RunSuccess } from "@/lib/graph/run-response";
import type { MapNodeData } from "./graph-model";

type Section = { label: string; body: React.ReactNode };

const Code = ({ children }: { children: React.ReactNode }) => (
  <pre className="scroll-thin max-h-64 overflow-auto rounded-lg border border-line bg-canvas p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
    {children}
  </pre>
);

const Empty = () => (
  <p className="text-xs text-ink-faint">No run yet — run the pipeline to populate this.</p>
);

/**
 * Builds the inspector content for a node.
 *
 * Everything here comes from the last run's actual state. Where there is no run
 * yet it says so rather than describing what the code would hypothetically do —
 * the point of this panel is evidence, not documentation.
 */
function sectionsFor(
  id: string,
  data: MapNodeData,
  result: RunSuccess | null,
  onEditKb: () => void,
): Section[] {
  const trace = result?.trace.filter((e) => e.agent === data.traceId) ?? [];

  const traceSection: Section[] =
    data.traceId && trace.length > 0
      ? [
          {
            label: trace.length > 1 ? `Executed ${trace.length}×` : "Last execution",
            body: (
              <div className="space-y-1.5">
                {trace.map((e, i) => (
                  <div key={i} className="rounded-lg border border-line bg-canvas px-2.5 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">{e.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-blue">
                        {e.durationMs}ms
                      </span>
                      {e.tokens ? (
                        <span className="font-mono text-[11px] text-ink-faint">
                          {e.tokens} tok
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{e.detail}</p>
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : data.traceId
        ? [{ label: "Execution", body: <Empty /> }]
        : [];

  switch (id) {
    case "researchAgent":
      return [
        {
          label: "What it does",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Asks the model to choose search queries from the brief, runs them through Tavily in
              parallel, de-duplicates by URL, then synthesises the results into bullet context. Two
              Groq calls and N searches — the queries are a model decision, not hardcoded.
            </p>
          ),
        },
        ...traceSection,
        {
          label: "Queries it chose",
          body: result?.research ? (
            <ul className="space-y-1">
              {result.research.queries.map((q) => (
                <li key={q} className="font-mono text-[11px] text-blue">
                  · {q}
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ),
        },
        {
          label: `Live sources (${result?.research?.sources.length ?? 0})`,
          body: result?.research ? (
            <ul className="space-y-1">
              {result.research.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-ink-soft hover:text-blue hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ),
        },
      ];

    case "brandMemoryAgent":
      return [
        {
          label: "What it does",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Embeds a query built from the brief plus the research summary, then returns the top
              k=4 guidelines by cosine similarity. Selective on purpose — the Copywriter only needs
              the rules that shape writing.
            </p>
          ),
        },
        ...traceSection,
        {
          label: "Retrieved this run",
          body: result?.brandChunks.length ? (
            <ul className="space-y-1">
              {result.brandChunks.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <span className="rounded border border-blue/20 bg-blue-soft px-1.5 font-mono text-[10px] text-blue">
                    {c.score.toFixed(3)}
                  </span>
                  {c.category}
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ),
        },
      ];

    case "copywriterAgent":
      return [
        {
          label: "What it does",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Drafts LinkedIn, Instagram, and email copy from research plus retrieved brand rules.
              On a revision pass the Guardian&apos;s flagged issues are injected into the prompt —
              that is what the conditional edge carries.
            </p>
          ),
        },
        ...traceSection,
        { label: "Output", body: result?.copy ? <Code>{JSON.stringify(result.copy, null, 2)}</Code> : <Empty /> },
      ];

    case "creativeDirectorAgent":
      return [
        {
          label: "What it does",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Turns approved copy into a structured creative spec — headline, palette with real hex
              codes, layout notes, and the imageConcept used for image generation.
            </p>
          ),
        },
        ...traceSection,
        {
          label: "Output",
          body: result?.creative ? <Code>{JSON.stringify(result.creative, null, 2)}</Code> : <Empty />,
        },
      ];

    case "brandGuardianAgent":
      return [
        {
          label: "What it does",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Runs its own exhaustive retrieval pass, then returns a verdict through a forced tool
              call. A reviewer cannot enforce a rule it was never shown, so unlike the Copywriter it
              retrieves every guideline.
            </p>
          ),
        },
        ...traceSection,
        {
          label: "Guidelines it reviewed against",
          body: result?.guardianChunks.length ? (
            <ul className="space-y-1">
              {result.guardianChunks.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <span className="rounded border border-blue/20 bg-blue-soft px-1.5 font-mono text-[10px] text-blue">
                    {c.score.toFixed(3)}
                  </span>
                  {c.category}
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ),
        },
        {
          label: "Verdict returned",
          body: result?.verdict ? <Code>{JSON.stringify(result.verdict, null, 2)}</Code> : <Empty />,
        },
      ];

    case "groq":
      return [
        {
          label: "Inference",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              One model serves four of the five agents: llama-3.3-70b-versatile on Groq. Chosen for
              native function calling, which the Guardian&apos;s forced verdict depends on. The
              Brand Memory agent uses no LLM at all — it is pure vector retrieval.
            </p>
          ),
        },
        {
          label: "Tokens this run",
          body: result ? (
            <p className="font-mono text-xs">
              {result.trace.reduce((sum, e) => sum + (e.tokens ?? 0), 0).toLocaleString()} total
            </p>
          ) : (
            <Empty />
          ),
        },
      ];

    case "tavily":
      return [
        {
          label: "External tool",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              One POST to api.tavily.com/search per query, biased to the last 180 days. Returns
              titles, URLs, snippets and relevance scores.
            </p>
          ),
        },
        {
          label: "Latency last run",
          body: result?.research ? (
            <p className="font-mono text-xs">{result.research.latencyMs}ms end to end</p>
          ) : (
            <Empty />
          ),
        },
      ];

    case "embeddings":
      return [
        {
          label: "Local embeddings",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              all-MiniLM-L6-v2 via @xenova/transformers, running in-process. 384 dimensions,
              mean-pooled and L2-normalised so a dot product equals cosine similarity. No API key,
              no network after the first model download.
            </p>
          ),
        },
      ];

    case "vectorstore":
      return [
        {
          label: "Store",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              LangChain MemoryVectorStore — vectors in a plain array, scored on every query. Right
              tool for six documents; a hosted vector DB would add latency and ops for no accuracy
              gain. Cached by a hash of the guideline set, so editing the knowledge base triggers a
              fresh embedding pass.
            </p>
          ),
        },
        {
          label: "Two independent passes",
          body: result ? (
            <div className="space-y-2 text-xs">
              <div>
                <p className="eyebrow mb-1">Copywriter · k=4</p>
                {result.brandChunks.map((c) => (
                  <p key={c.id} className="font-mono text-[11px] text-ink-soft">
                    {c.score.toFixed(3)} {c.category}
                  </p>
                ))}
              </div>
              <div>
                <p className="eyebrow mb-1">Guardian · all rules</p>
                {result.guardianChunks.map((c) => (
                  <p key={c.id} className="font-mono text-[11px] text-ink-soft">
                    {c.score.toFixed(3)} {c.category}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <Empty />
          ),
        },
      ];

    case "verdictTool":
      return [
        {
          label: "Forced tool call",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              tool_choice pins the model to this one function, so prose is not a possible response.
              There is no regex and no &quot;look for the word APPROVED&quot; — the structured
              object is the only thing the API can return, and Zod validates it on arrival.
            </p>
          ),
        },
        {
          label: "Arguments returned",
          body: result?.verdict ? <Code>{JSON.stringify(result.verdict, null, 2)}</Code> : <Empty />,
        },
      ];

    case "copySchema":
      return [
        {
          label: "Contract",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Zod schema for the Copywriter&apos;s JSON. Invalid output is fed back to the model
              once with the validation error attached, then fails loudly rather than corrupting the
              Creative Director downstream.
            </p>
          ),
        },
      ];

    case "creativeSchema":
      return [
        {
          label: "Contract",
          body: (
            <p className="text-xs leading-relaxed text-ink-soft">
              Zod schema for the creative spec. Hex codes are regex-validated, so the mockup can be
              styled directly from agent output without sanitising.
            </p>
          ),
        },
      ];

    default:
      break;
  }

  if (data.guidelineId) {
    const guideline =
      BRAND_GUIDELINES.find((g) => g.id === data.guidelineId) ?? null;
    const copywriterHit = result?.brandChunks.find((c) => c.id === data.guidelineId);
    const guardianHit = result?.guardianChunks.find((c) => c.id === data.guidelineId);

    return [
      {
        label: "Guideline text",
        body: (
          <p className="rounded-lg border border-line bg-canvas p-2.5 text-xs leading-relaxed">
            {guideline?.text ?? "This guideline was edited or removed in the knowledge base."}
          </p>
        ),
      },
      {
        label: "Retrieval last run",
        body: result ? (
          <div className="flex flex-wrap gap-1.5">
            {copywriterHit ? (
              <Badge tone="blue">Copywriter · {copywriterHit.score.toFixed(3)}</Badge>
            ) : (
              <Badge>Not retrieved by Copywriter</Badge>
            )}
            {guardianHit ? (
              <Badge tone="blue">Guardian · {guardianHit.score.toFixed(3)}</Badge>
            ) : (
              <Badge>Not retrieved by Guardian</Badge>
            )}
          </div>
        ) : (
          <Empty />
        ),
      },
      {
        label: "Edit",
        body: (
          <Button variant="secondary" size="sm" onClick={onEditKb}>
            Open knowledge base
          </Button>
        ),
      },
    ];
  }

  if (data.channelKey) {
    const value = result ? (result as unknown as Record<string, unknown>)[data.channelKey] : null;
    return [
      {
        label: "State channel",
        body: (
          <p className="text-xs leading-relaxed text-ink-soft">
            A LangGraph channel. Nodes return partial updates and the channel&apos;s reducer merges
            them.{" "}
            {data.channelKey === "trace"
              ? "This one appends rather than overwrites, which is why the trace accumulates across all five nodes instead of each overwriting the last."
              : "This one is last-write-wins."}
          </p>
        ),
      },
      {
        label: "Value after last run",
        body:
          result && value !== null && value !== undefined ? (
            <Code>{JSON.stringify(value, null, 2)}</Code>
          ) : (
            <Empty />
          ),
      },
    ];
  }

  return [
    {
      label: "Node",
      body: <p className="text-xs text-ink-soft">{data.sublabel ?? data.label}</p>,
    },
  ];
}

export function NodeInspector({
  nodeId,
  data,
  result,
  onClose,
  onEditKb,
}: {
  nodeId: string;
  data: MapNodeData;
  result: RunSuccess | null;
  onClose: () => void;
  onEditKb: () => void;
}) {
  const sections = sectionsFor(nodeId, data, result, onEditKb);

  return (
    <aside className="fade-up absolute top-0 right-0 z-20 flex h-full w-full max-w-sm flex-col border-l border-line bg-card shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <span className="eyebrow">{data.kind}</span>
          <h3 className="text-sm font-semibold tracking-tight">{data.label}</h3>
          <code className="font-mono text-[11px] text-ink-faint">{nodeId}</code>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="eyebrow mb-1.5">{section.label}</p>
            {section.body}
          </div>
        ))}
      </div>
    </aside>
  );
}
