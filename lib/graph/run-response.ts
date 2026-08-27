/**
 * The wire format of POST /api/run.
 *
 * Types only — this file is imported by client components, and every import
 * below is `import type`, so nothing from the server graph (LangGraph, Groq,
 * transformers) is pulled into the browser bundle.
 */
import type {
  CampaignCopy,
  CreativeSpec,
  GuardianVerdict,
  TraceEvent,
} from "./state";
import type { ResearchOutput } from "../agents/research";
import type { RuleFinding } from "../agents/rule-check";
import type { RetrievedChunk } from "../memory/store";

export type RunSuccess = {
  ok: true;
  totalMs: number;
  brief: string;
  research: ResearchOutput | null;
  brandChunks: RetrievedChunk[];
  guardianChunks: RetrievedChunk[];
  copy: CampaignCopy | null;   
  creative: CreativeSpec | null;
  verdict: GuardianVerdict | null;
  verdictHistory: GuardianVerdict[];
  /** Hits from the deterministic banned-term scan that runs beside the LLM. */
  ruleFindings: RuleFinding[];
  termsChecked: number;
  revisionCount: number;
  trace: TraceEvent[];
};

/** One SSE frame from POST /api/run/stream. */
export type RunStreamEvent =
  | { type: "start"; brief: string; firstNode: NodeId; maxRevisions: number; hitlEnabled?: boolean }
  | { type: "node"; event: TraceEvent; next: NodeId | null }
  | { type: "approval_required"; state: RunSuccess }
  | { type: "done"; result: RunSuccess }
  | { type: "failed"; error: string };

export type RunResumeRequest = {
  action: "approve" | "rewrite";
  state: RunSuccess;
  humanEdits?: {
    copy?: CampaignCopy;
    creative?: CreativeSpec;
  };
  humanFeedback?: string;
};

export type RunFailure = {
  ok: false;
  error: string;
  totalMs?: number;
};

export type RunResponse = RunSuccess | RunFailure;

/** The five graph nodes, in execution order. Node ids match trace `agent` ids. */
export const PIPELINE_NODES = [
  { id: "researchAgent", label: "Research", blurb: "Tavily web search" },
  { id: "brandMemoryAgent", label: "Brand Memory", blurb: "RAG retrieval" },
  { id: "copywriterAgent", label: "Copywriter", blurb: "Channel copy" },
  { id: "creativeDirectorAgent", label: "Creative Director", blurb: "Ad creative spec" },
  { id: "brandGuardianAgent", label: "Brand Guardian", blurb: "Forced tool call" },
] as const;

export type NodeId = (typeof PIPELINE_NODES)[number]["id"];
