"use client";

import { useState } from "react";
import { Card } from "./ui";
import type { ResearchOutput } from "@/lib/agents/research";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Favicons come from Google's public service — no key, no config. */
function faviconFor(url: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=64`;
}

/**
 * Research provenance, laid out the way an answer engine shows citations:
 * a scannable strip of sources first, then cards with the exact snippet each
 * one contributed, then the synthesis those snippets produced.
 */
export function SourcesPanel({ research }: { research: ResearchOutput }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tab, setTab] = useState<"sources" | "summary">("sources");

  return (
    <Card
      title="Research provenance"
      meta={`${research.sources.length} live sources`}
      action={
        <div className="flex rounded-lg bg-canvas p-0.5">
          {(["sources", "summary"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                tab === t ? "bg-card text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="border-b border-line px-4 py-2.5">
        <p className="eyebrow mb-1.5">Queries the agent chose</p>
        <div className="flex flex-wrap gap-1.5">
          {research.queries.map((q) => (
            <span
              key={q}
              className="rounded-full border border-blue/20 bg-blue-soft px-2.5 py-1 font-mono text-[11px] text-blue"
            >
              {q}
            </span>
          ))}
        </div>
      </div>

      {tab === "sources" ? (
        <>
          <div className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
            {research.sources.map((s, i) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.title}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card py-1 pr-2.5 pl-1.5 transition-colors hover:border-line-strong hover:bg-canvas"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-[9px] font-semibold text-ink-faint">
                  {i + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faviconFor(s.url)} alt="" width={13} height={13} className="rounded-sm" />
                <span className="max-w-36 truncate text-[11px] text-ink-soft">
                  {hostOf(s.url)}
                </span>
              </a>
            ))}
          </div>

          <div className="scroll-thin max-h-80 overflow-y-auto">
            {research.sources.map((s, i) => {
              const open = expanded === i;
              return (
                <article key={s.url} className="border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={faviconFor(s.url)} alt="" width={13} height={13} className="rounded-sm" />
                    <span className="truncate text-[11px] text-ink-faint">{hostOf(s.url)}</span>
                    {s.publishedDate && (
                      <span className="text-[11px] text-ink-faint">
                        · {s.publishedDate.slice(0, 10)}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint">
                      {s.score.toFixed(2)}
                    </span>
                  </div>

                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm leading-snug font-medium hover:text-blue hover:underline"
                  >
                    {s.title}
                  </a>

                  <p
                    className={`mt-1 text-xs leading-relaxed text-ink-soft ${
                      open ? "" : "line-clamp-2"
                    }`}
                  >
                    {s.content}
                  </p>

                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : i)}
                    className="mt-1 text-[11px] font-medium text-blue hover:underline"
                  >
                    {open ? "Show less" : "Show more"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="scroll-thin max-h-106 overflow-y-auto px-4 py-3">
          <p className="eyebrow mb-2">Synthesis passed to the copywriter</p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
            {research.summary}
          </div>
        </div>
      )}
    </Card>
  );
}
