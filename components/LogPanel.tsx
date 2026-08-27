"use client";

import { useEffect, useRef } from "react";
import { Card } from "./ui";
import { formatCost } from "@/lib/llm/pricing";
import type { TraceEvent } from "@/lib/graph/state";

export function LogPanel({ events, running }: { events: TraceEvent[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  return (
    <Card title="Execution log" meta={events.length > 0 ? `${events.length} steps` : undefined}>
      <div className="scroll-thin max-h-104 min-h-48 overflow-y-auto px-4 py-2">
        {events.length === 0 && !running && (
          <p className="py-14 text-center text-sm text-ink-faint">
            No run yet — enter a brief and run the pipeline.
          </p>
        )}
        {running && events.length === 0 && (
          <p className="py-14 text-center text-sm text-blue">
            Graph invoked. Waiting on the first node…
          </p>
        )}

        {events.map((e, i) => (
          <div key={`${e.agent}-${i}`} className="fade-up flex gap-3 py-2.5 not-last:border-b not-last:border-line">
            <span className="mt-0.5 font-mono text-[11px] text-ink-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-sm">{e.label}</span>
                <span className="tabular ml-auto font-mono text-[11px] text-blue">
                  {e.durationMs}ms
                </span>
                {e.usage ? (
                  <span
                    className="tabular font-mono text-[11px] text-ink-faint"
                    title={`${e.usage.promptTokens} in / ${e.usage.completionTokens} out`}
                  >
                    {e.usage.totalTokens} tok
                  </span>
                ) : null}
                {e.costUsd ? (
                  <span className="tabular font-mono text-[11px] text-ink-faint">
                    {formatCost(e.costUsd)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{e.detail}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </Card>
  );
}
