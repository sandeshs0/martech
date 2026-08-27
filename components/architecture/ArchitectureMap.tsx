"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, type NodeRunState } from "./MapNodes";
import { useTheme } from "../theme";
import { NodeInspector } from "./NodeInspector";
import {
  CHANNEL_EDGES,
  CHANNEL_NODES,
  SPINE_EDGES,
  SPINE_NODES,
  SUPPORT_EDGES,
  SUPPORT_NODES,
  docEdges,
  docNodes,
  type MapEdge,
  type MapNodeData,
} from "./graph-model";
import type { NodeId, RunSuccess } from "@/lib/graph/run-response";

/** Visual language for the four kinds of connection in this architecture. */
function edgeStyle(edge: MapEdge, loopActive: boolean): Partial<Edge> {
  switch (edge.flavour) {
    case "control":
      return {
        style: { stroke: "var(--ink-soft)", strokeWidth: 2.5 },
        markerEnd: { type: "arrowclosed" as never, color: "var(--ink-soft)" },
      };
    case "conditional":
      return {
        animated: true,
        style: {
          stroke: edge.id === "e:revise" && loopActive ? "var(--amber)" : "var(--blue)",
          strokeWidth: 2,
        },
        markerEnd: {
          type: "arrowclosed" as never,
          color: edge.id === "e:revise" && loopActive ? "var(--amber)" : "var(--blue)",
        },
      };
    case "tool":
      return { style: { stroke: "var(--blue)", strokeWidth: 1.75, strokeDasharray: "5 4" } };
    case "data":
      return { style: { stroke: "var(--ink-faint)", strokeWidth: 1.75 } };
    case "state":
      return { style: { stroke: "var(--ink-faint)", strokeWidth: 1.25, strokeDasharray: "2 5" } };
  }
}

const LEGEND = [
  { label: "Control flow", className: "bg-ink-soft h-[2.5px]" },
  { label: "Conditional edge", className: "bg-blue h-[2.5px]" },
  { label: "Tool / model", className: "bg-blue h-0.5 opacity-60" },
  { label: "Data + state", className: "bg-ink-faint h-0.5" },
];

export function ArchitectureMap({
  result,
  statuses,
  runCounts,
  loopActive,
  onEditKb,
  onRun,
  phase,
}: {
  result: RunSuccess | null;
  statuses: Record<NodeId, NodeRunState>;
  runCounts: Record<NodeId, number>;
  loopActive: boolean;
  onEditKb: () => void;
  onRun: () => void;
  phase: "idle" | "running" | "replaying" | "done" | "error";
}) {
  const { resolved } = useTheme();
  const [showChannels, setShowChannels] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const [selected, setSelected] = useState<{ id: string; data: MapNodeData } | null>(null);

  const nodes: Node[] = useMemo(() => {
    const base = [
      ...SPINE_NODES.map((n) => ({
        ...n,
        data: {
          ...n.data,
          runState: (n.data.traceId
            ? (statuses[n.data.traceId as NodeId] ?? "idle")
            : "idle") as NodeRunState,
          runCount: n.data.traceId ? (runCounts[n.data.traceId as NodeId] ?? 0) : 0,
        },
      })),
      ...SUPPORT_NODES,
      ...(showDocs ? docNodes() : []),
      ...(showChannels ? CHANNEL_NODES : []),
    ];
    return base.map((n) => ({ ...n, selected: selected?.id === n.id })) as Node[];
  }, [statuses, runCounts, showDocs, showChannels, selected]);

  const edges: Edge[] = useMemo(() => {
    const all: MapEdge[] = [
      ...SPINE_EDGES,
      ...SUPPORT_EDGES,
      ...(showDocs ? docEdges() : []),
      ...(showChannels ? CHANNEL_EDGES : []),
    ];
    return all.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      type: "smoothstep",
      labelStyle: { fontSize: 10, fill: "var(--ink-soft)" },
      labelBgStyle: { fill: "var(--card)" },
      labelBgPadding: [4, 2] as [number, number],
      ...edgeStyle(e, loopActive),
    }));
  }, [showDocs, showChannels, loopActive]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) =>
      setSelected({ id: node.id, data: node.data as MapNodeData }),
    [],
  );

  return (
    // Fills the viewport below the sticky header — the map is the whole point
    // of this tab, so nothing else competes with it for space.
    <div className="card relative h-[calc(100vh-7rem)] min-h-130 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelected(null)}
        colorMode={resolved}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.6}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--map-dot)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => "var(--line-strong)"}
          maskColor={resolved === "dark" ? "rgba(0,0,0,0.55)" : "rgba(11,13,18,0.08)"}
        />
      </ReactFlow>

      {/* Layer toggles. Channels start hidden — they are the dense layer, better
          revealed on demand than shown in the opening frame. */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2.5">
        {/* The brief input lives on the Run tab, so keep a way to trigger a run
            and watch the graph light up without switching back and forth. */}
        <button
          type="button"
          onClick={onRun}
          disabled={phase === "running" || phase === "replaying"}
          className="duo-btn bg-blue px-4 py-2 text-[13px] text-white shadow-[0_4px_0_0_var(--blue-deep)]"
        >
          {phase === "running"
            ? "Running…"
            : phase === "replaying"
              ? "Replaying…"
              : "Run pipeline"}
        </button>
        <Toggle active={showDocs} onClick={() => setShowDocs((v) => !v)}>
          Knowledge base
        </Toggle>
        <Toggle active={showChannels} onClick={() => setShowChannels((v) => !v)}>
          State channels
        </Toggle>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3.5 rounded-xl border border-line bg-card/90 px-3.5 py-2.5 backdrop-blur">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-2">
            <span className={`inline-block w-6 rounded-full ${item.className}`} />
            <span className="text-[12px] text-ink-soft">{item.label}</span>
          </span>
        ))}
      </div>

      {!selected && (
        <p className="absolute top-4 right-4 z-10 rounded-xl border border-line bg-card/90 px-3.5 py-2 text-[12px] text-ink-faint backdrop-blur">
          Click any node to inspect its real data
        </p>
      )}

      {selected && (
        <NodeInspector
          nodeId={selected.id}
          data={selected.data}
          result={result}
          onClose={() => setSelected(null)}
          onEditKb={onEditKb}
        />
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium backdrop-blur transition-colors ${
        active
          ? "border-blue/30 bg-blue-soft text-blue"
          : "border-line bg-card/90 text-ink-faint hover:border-line-strong hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}
