"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MapNodeData } from "./graph-model";

export type NodeRunState = "idle" | "running" | "done";

/**
 * Live status is injected through the node's data at render time rather than
 * held in component state, so the map and the pipeline strip stay driven by
 * exactly one source of truth: the trace returned by the graph.
 */
type Data = MapNodeData & {
  runState?: NodeRunState;
  runCount?: number;
  selected?: boolean;
};

/**
 * Map nodes sit on a canvas that is deliberately a step darker/lighter than the
 * cards, so they need a stronger border and a lift shadow to read as objects on
 * a surface rather than washing into the background.
 */
const shell = (selected: boolean) =>
  `rounded-2xl border bg-card px-3.5 py-3 transition-all duration-200 ${
    selected
      ? "border-blue ring-4 ring-blue/15 shadow-lg"
      : "border-line-strong shadow-[0_2px_6px_rgba(11,13,18,0.06)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(11,13,18,0.10)]"
  }`;

function Label({ data }: { data: Data }) {
  return (
    <>
      <p className="font-display text-[14px] leading-snug">{data.label}</p>
      {data.sublabel && (
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">
          {data.sublabel}
        </p>
      )}
    </>
  );
}

/**
 * Edges attach to these anchors, but the map is not connection-editable, so the
 * dots themselves are invisible — they would read as UI affordances that do
 * nothing.
 */
const HANDLE = "h-1.5! w-1.5! border-0! bg-transparent! opacity-0";

/* Handles are declared explicitly so edges attach to predictable anchors. */
function SpineHandles() {
  return (
    <>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className={HANDLE}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className={HANDLE}
      />
      <Handle
        id="tools"
        type="target"
        position={Position.Top}
        className={HANDLE}
      />
      {/* The revise loop needs a handle at each end: a source on the Guardian
          and a matching target on the Copywriter. Declaring only the source
          left the edge with nowhere to land. */}
      <Handle
        id="reviseIn"
        type="target"
        position={Position.Top}
        style={{ left: "85%" }}
        className={HANDLE}
      />
      <Handle
        id="down"
        type="source"
        position={Position.Bottom}
        style={{ left: "35%" }}
        className={HANDLE}
      />
      <Handle
        id="retrieval"
        type="target"
        position={Position.Bottom}
        style={{ left: "65%" }}
        className={HANDLE}
      />
      <Handle
        id="revise"
        type="source"
        position={Position.Top}
        style={{ left: "70%" }}
        className={HANDLE}
      />
    </>
  );
}

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as Data;
  const state = d.runState ?? "idle";

  return (
    <div
      className={`${shell(!!selected)} w-52 ${
        state === "running" ? "border-blue bg-blue-soft shadow-lg" : ""
      } ${state === "done" ? "border-green/40" : ""}`}
    >
      <SpineHandles />
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            state === "done"
              ? "bg-green-soft text-green"
              : state === "running"
                ? "bg-blue text-white"
                : "bg-canvas text-ink-faint"
          }`}
        >
          {state === "done" ? "✓" : "●"}
        </span>
        <div className="min-w-0">
          <Label data={d} />
        </div>
        {(d.runCount ?? 0) > 1 && (
          <span className="ml-auto rounded-full border border-amber/25 bg-amber-soft px-1.5 text-[10px] font-semibold text-amber">
            ×{d.runCount}
          </span>
        )}
      </div>
      {state === "running" && (
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-card">
          <div className="bar-running h-full w-full" />
        </div>
      )}
    </div>
  );
}

export function TerminalNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div
      className={`w-28 rounded-full border px-3 py-2 text-center ${
        selected ? "border-blue bg-blue-soft" : "border-line-strong bg-card"
      }`}
    >
      <SpineHandles />
      <p className="text-[11px] font-bold tracking-wider">{d.label}</p>
    </div>
  );
}

export function ToolNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div className={`${shell(!!selected)} w-48`}>
      <Handle
        id="out"
        type="source"
        position={Position.Bottom}
        className={HANDLE}
      />
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-blue" />
        <span className="eyebrow">external tool</span>
      </div>
      <Label data={d} />
    </div>
  );
}

export function ModelNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div
      className={`w-56 rounded-xl border px-3 py-2 ${
        selected ? "border-blue ring-4 ring-blue/15" : "border-blue/30"
      } bg-blue-soft`}
    >
      <Handle
        id="out"
        type="source"
        position={Position.Bottom}
        className={HANDLE}
      />
      <span className="eyebrow text-blue">inference</span>
      <Label data={d} />
    </div>
  );
}

export function StoreNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div className={`${shell(!!selected)} w-52`}>
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className={HANDLE}
      />
      <Handle
        id="down"
        type="source"
        position={Position.Bottom}
        className={HANDLE}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={HANDLE}
      />
      <span className="eyebrow">vector store</span>
      <Label data={d} />
    </div>
  );
}

export function DocNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div
      className={`w-32 rounded-lg border px-2 py-1.5 ${
        selected
          ? "border-blue bg-blue-soft ring-4 ring-blue/15"
          : "border-line-strong bg-card"
      }`}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className={HANDLE}
      />
      <p className="text-[11px] leading-tight font-medium">{d.label}</p>
      <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{d.sublabel}</p>
    </div>
  );
}

export function SchemaNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div
      className={`w-52 rounded-xl border border-dashed px-3 py-2 ${
        selected ? "border-blue bg-blue-soft" : "border-line-strong bg-card"
      }`}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className={HANDLE}
      />
      <span className="eyebrow">contract</span>
      <Label data={d} />
    </div>
  );
}

export function ChannelNode({ data, selected }: NodeProps) {
  const d = data as Data;
  return (
    <div
      className={`w-40 rounded-lg border px-2.5 py-1.5 ${
        selected
          ? "border-blue bg-blue-soft ring-4 ring-blue/15"
          : "border-line-strong bg-card"
      }`}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className={HANDLE}
      />
      <p className="font-mono text-[11px] font-semibold">{d.label}</p>
      <p className="text-[10px] text-ink-faint">{d.sublabel}</p>
    </div>
  );
}

export const nodeTypes = {
  agent: AgentNode,
  terminal: TerminalNode,
  tool: ToolNode,
  model: ModelNode,
  store: StoreNode,
  doc: DocNode,
  schema: SchemaNode,
  channel: ChannelNode,
};
