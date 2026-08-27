"use client";

import { PIPELINE_NODES, type NodeId } from "@/lib/graph/run-response";

export type NodeStatus = "idle" | "running" | "done";

export function NodeGraph({
  statuses,
  runCounts,
  durations,
  loopActive,
}: {
  statuses: Record<NodeId, NodeStatus>;
  runCounts: Record<NodeId, number>;
  durations: Record<NodeId, number>;
  loopActive: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {PIPELINE_NODES.map((node, i) => {
          const status = statuses[node.id];
          return (
            <div
              key={node.id}
              className={`relative border-line p-4 not-last:border-b sm:not-last:border-r lg:border-b-0 ${
                status === "running" ? "bg-blue-soft/60" : ""
              } transition-colors duration-300`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                    status === "done"
                      ? "bg-green-soft text-green ring-1 ring-green/25"
                      : status === "running"
                        ? "bg-blue text-white"
                        : "bg-canvas text-ink-faint ring-1 ring-line"
                  }`}
                >
                  {status === "done" ? "✓" : i + 1}
                </span>
                <span className="text-sm font-semibold tracking-tight">{node.label}</span>
                {runCounts[node.id] > 1 && (
                  <span className="ml-auto rounded-full border border-amber/25 bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold text-amber">
                    ×{runCounts[node.id]}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-ink-soft">{node.blurb}</p>

              <div className="mt-3 h-1 overflow-hidden rounded-full bg-canvas">
                {status === "running" && <div className="bar-running h-full w-full" />}
                {status === "done" && <div className="h-full w-full rounded-full bg-green/70" />}
              </div>

              <p className="mt-1.5 h-4 font-mono text-[11px] text-ink-faint">
                {status === "done" && durations[node.id] ? `${durations[node.id]}ms` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* The conditional edge gets its own row — it is the architectural point. */}
      <div
        className={`flex flex-wrap items-center gap-2 border-t px-4 py-2.5 transition-colors ${
          loopActive ? "border-amber/25 bg-amber-soft" : "border-line bg-canvas/50"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M16 6H7a3.5 3.5 0 0 0 0 7h9m0-7-3-3m3 3-3 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={loopActive ? "text-amber" : "text-ink-faint"}
          />
        </svg>
        <span className="text-xs font-medium">Conditional edge</span>
        <code className="font-mono text-[11px] text-ink-soft">
          guardian.approved === false → copywriter · max 1 revision
        </code>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            loopActive
              ? "border-amber/30 bg-card text-amber"
              : "border-line bg-card text-ink-faint"
          }`}
        >
          {loopActive ? "Fired" : "Not taken"}
        </span>
      </div>
    </div>
  );
}
