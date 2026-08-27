/**
 * The architecture map's node and edge definitions.
 *
 * Positions are hand-placed rather than produced by a layout engine: the graph
 * is fixed and small, and deterministic coordinates mean the diagram looks
 * identical every render — no jitter mid-demo.
 *
 * Layout, top to bottom:
 *   y = -320  inference layer (the single Groq model every agent shares)
 *   y = -170  input tools (Tavily, local embeddings)
 *   y =    0  the LangGraph spine: START → 5 agents → END
 *   y =  170  output contracts and the vector store
 *   y =  330  the six knowledge base documents
 *   y =  480  LangGraph state channels
 */
import { BRAND_GUIDELINES } from "@/lib/memory/brand-kb";

export type MapNodeKind =
  | "terminal"
  | "agent"
  | "tool"
  | "model"
  | "store"
  | "doc"
  | "schema"
  | "channel";

export type MapNodeData = {
  kind: MapNodeKind;
  label: string;
  sublabel?: string;
  /** Set for the five agents — matches trace `agent` ids so live status can bind. */
  traceId?: string;
  /** Set for knowledge base documents — matches the guideline id. */
  guidelineId?: string;
  /** Set for state channels — the key on PipelineState. */
  channelKey?: string;
  [key: string]: unknown;
};

export type MapNode = {
  id: string;
  position: { x: number; y: number };
  data: MapNodeData;
  type: string;
};

export type MapEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  /** Visual family — see edgeStyle() in ArchitectureMap. */
  flavour: "control" | "conditional" | "tool" | "data" | "state";
  animated?: boolean;
};

const SPINE_Y = 0;
const X = {
  start: 0,
  research: 260,
  memory: 520,
  copywriter: 780,
  creative: 1040,
  guardian: 1300,
  end: 1560,
};

export const SPINE_NODES: MapNode[] = [
  {
    id: "start",
    type: "terminal",
    position: { x: X.start, y: SPINE_Y },
    data: { kind: "terminal", label: "START", sublabel: "graph entry" },
  },
  {
    id: "researchAgent",
    type: "agent",
    position: { x: X.research, y: SPINE_Y },
    data: {
      kind: "agent",
      label: "Research Agent",
      sublabel: "decides queries, searches, synthesises",
      traceId: "researchAgent",
    },
  },
  {
    id: "brandMemoryAgent",
    type: "agent",
    position: { x: X.memory, y: SPINE_Y },
    data: {
      kind: "agent",
      label: "Brand Memory Agent",
      sublabel: "RAG retrieval, k=4",
      traceId: "brandMemoryAgent",
    },
  },
  {
    id: "copywriterAgent",
    type: "agent",
    position: { x: X.copywriter, y: SPINE_Y },
    data: {
      kind: "agent",
      label: "Copywriter Agent",
      sublabel: "LinkedIn · Instagram · Email",
      traceId: "copywriterAgent",
    },
  },
  {
    id: "creativeDirectorAgent",
    type: "agent",
    position: { x: X.creative, y: SPINE_Y },
    data: {
      kind: "agent",
      label: "Creative Director",
      sublabel: "structured ad creative spec",
      traceId: "creativeDirectorAgent",
    },
  },
  {
    id: "brandGuardianAgent",
    type: "agent",
    position: { x: X.guardian, y: SPINE_Y },
    data: {
      kind: "agent",
      label: "Brand Guardian",
      sublabel: "forced tool call verdict",
      traceId: "brandGuardianAgent",
    },
  },
  {
    id: "end",
    type: "terminal",
    position: { x: X.end, y: SPINE_Y },
    data: { kind: "terminal", label: "END", sublabel: "graph exit" },
  },
];

export const SUPPORT_NODES: MapNode[] = [
  {
    id: "groq",
    type: "model",
    position: { x: X.copywriter, y: -320 },
    data: {
      kind: "model",
      label: "Groq · llama-3.3-70b",
      sublabel: "one model, four agents",
    },
  },
  {
    id: "tavily",
    type: "tool",
    position: { x: X.research, y: -170 },
    data: { kind: "tool", label: "Tavily Search", sublabel: "live web, POST /search" },
  },
  {
    id: "embeddings",
    type: "tool",
    position: { x: X.memory, y: -170 },
    data: {
      kind: "tool",
      label: "all-MiniLM-L6-v2",
      sublabel: "local, 384 dims, no API key",
    },
  },
  {
    id: "vectorstore",
    type: "store",
    position: { x: X.memory, y: 170 },
    data: { kind: "store", label: "MemoryVectorStore", sublabel: "cosine similarity" },
  },
  {
    id: "copySchema",
    type: "schema",
    position: { x: X.copywriter, y: 170 },
    data: { kind: "schema", label: "CampaignCopySchema", sublabel: "Zod · validated + 1 retry" },
  },
  {
    id: "creativeSchema",
    type: "schema",
    position: { x: X.creative, y: 170 },
    data: { kind: "schema", label: "CreativeSpecSchema", sublabel: "Zod · hex codes enforced" },
  },
  {
    id: "verdictTool",
    type: "schema",
    position: { x: X.guardian, y: 170 },
    data: {
      kind: "schema",
      label: "submit_verdict",
      sublabel: "forced tool_choice · prose impossible",
    },
  },
];

/** One node per knowledge base document, laid out under the vector store. */
export const docNodes = (): MapNode[] =>
  BRAND_GUIDELINES.map((g, i) => ({
    id: `doc:${g.id}`,
    type: "doc",
    position: { x: 120 + i * 150, y: 330 },
    data: {
      kind: "doc" as const,
      label: g.category,
      sublabel: g.id,
      guidelineId: g.id,
    },
  }));

export const CHANNEL_NODES: MapNode[] = [
  { id: "ch:brief", key: "brief", label: "brief", x: X.start, note: "string" },
  { id: "ch:research", key: "research", label: "research", x: X.research, note: "ResearchOutput" },
  {
    id: "ch:brandChunks",
    key: "brandChunks",
    label: "brandChunks",
    x: X.memory,
    note: "RetrievedChunk[]",
  },
  { id: "ch:copy", key: "copy", label: "copy", x: X.copywriter, note: "CampaignCopy" },
  { id: "ch:creative", key: "creative", label: "creative", x: X.creative, note: "CreativeSpec" },
  { id: "ch:verdict", key: "verdict", label: "verdict", x: X.guardian, note: "GuardianVerdict" },
  { id: "ch:trace", key: "trace", label: "trace", x: X.end, note: "append-only reducer" },
].map((c) => ({
  id: c.id,
  type: "channel",
  position: { x: c.x, y: 480 },
  data: {
    kind: "channel" as const,
    label: c.label,
    sublabel: c.note,
    channelKey: c.key,
  },
}));

export const SPINE_EDGES: MapEdge[] = [
  { id: "e:start", source: "start", target: "researchAgent", flavour: "control" },
  { id: "e:r-m", source: "researchAgent", target: "brandMemoryAgent", flavour: "control" },
  { id: "e:m-c", source: "brandMemoryAgent", target: "copywriterAgent", flavour: "control" },
  { id: "e:c-cd", source: "copywriterAgent", target: "creativeDirectorAgent", flavour: "control" },
  {
    id: "e:cd-g",
    source: "creativeDirectorAgent",
    target: "brandGuardianAgent",
    flavour: "control",
  },
  {
    id: "e:g-end",
    source: "brandGuardianAgent",
    target: "end",
    flavour: "conditional",
    label: "approved",
  },
  {
    id: "e:revise",
    source: "brandGuardianAgent",
    target: "copywriterAgent",
    sourceHandle: "revise",
    targetHandle: "reviseIn",
    flavour: "conditional",
    label: "flagged · max 1",
  },
];

export const SUPPORT_EDGES: MapEdge[] = [
  // One shared model feeding four agents.
  ...["researchAgent", "copywriterAgent", "creativeDirectorAgent", "brandGuardianAgent"].map(
    (target) => ({
      id: `e:groq-${target}`,
      source: "groq",
      target,
      targetHandle: "tools",
      flavour: "tool" as const,
    }),
  ),
  {
    id: "e:tavily",
    source: "tavily",
    target: "researchAgent",
    targetHandle: "tools",
    flavour: "tool",
  },
  {
    id: "e:embed",
    source: "embeddings",
    target: "brandMemoryAgent",
    targetHandle: "tools",
    flavour: "tool",
  },
  {
    id: "e:mem-store",
    source: "brandMemoryAgent",
    sourceHandle: "down",
    target: "vectorstore",
    flavour: "data",
    label: "k=4",
  },
  {
    id: "e:store-guardian",
    source: "vectorstore",
    sourceHandle: "right",
    target: "brandGuardianAgent",
    targetHandle: "retrieval",
    flavour: "data",
    label: "own pass · all rules",
  },
  {
    id: "e:copy-schema",
    source: "copywriterAgent",
    sourceHandle: "down",
    target: "copySchema",
    flavour: "data",
  },
  {
    id: "e:creative-schema",
    source: "creativeDirectorAgent",
    sourceHandle: "down",
    target: "creativeSchema",
    flavour: "data",
  },
  {
    id: "e:verdict-tool",
    source: "brandGuardianAgent",
    sourceHandle: "down",
    target: "verdictTool",
    flavour: "data",
  },
];

export const docEdges = (): MapEdge[] =>
  BRAND_GUIDELINES.map((g) => ({
    id: `e:doc-${g.id}`,
    source: "vectorstore",
    sourceHandle: "down",
    target: `doc:${g.id}`,
    flavour: "data" as const,
  }));

export const CHANNEL_EDGES: MapEdge[] = ([
  { id: "e:ch-brief", source: "start", target: "ch:brief", flavour: "state" },
  { id: "e:ch-research", source: "researchAgent", target: "ch:research", flavour: "state" },
  { id: "e:ch-chunks", source: "brandMemoryAgent", target: "ch:brandChunks", flavour: "state" },
  { id: "e:ch-copy", source: "copywriterAgent", target: "ch:copy", flavour: "state" },
  { id: "e:ch-creative", source: "creativeDirectorAgent", target: "ch:creative", flavour: "state" },
  { id: "e:ch-verdict", source: "brandGuardianAgent", target: "ch:verdict", flavour: "state" },
  // Every node appends to the trace — that is what the append-only reducer is for.
  ...[
    "researchAgent",
    "brandMemoryAgent",
    "copywriterAgent",
    "creativeDirectorAgent",
    "brandGuardianAgent",
  ].map((source) => ({
    id: `e:trace-${source}`,
    source,
    target: "ch:trace",
    flavour: "state" as const,
  })),
] as MapEdge[]).map((e) => ({ ...e, sourceHandle: "down" }));
