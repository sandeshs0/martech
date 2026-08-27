/**
 * The LangGraph pipeline.
 *
 *   START → research → brandMemory → copywriter → creativeDirector → guardian
 *   guardian --approved--> END
 *   guardian --flagged, under cap--> copywriter   (a real cycle in the graph)
 *
 * Each node is an async function that receives the accumulated state and
 * returns a partial update. LangGraph merges those updates through the reducers
 * defined in state.ts — notably `trace`, which appends rather than overwrites.
 */
import { END, START, StateGraph } from "@langchain/langgraph";
import { runBrandGuardianAgent } from "../agents/brand-guardian";
import { retrieveComplianceGuidelines, runBrandMemoryAgent } from "../agents/brand-memory";
import { runCopywriterAgent } from "../agents/copywriter";
import { runCreativeDirectorAgent } from "../agents/creative-director";
import { runResearchAgent } from "../agents/research";
import type { BrandGuideline } from "../memory/brand-kb";
import { estimateCost, type TokenUsage } from "../llm/pricing";
import { runDeterministicCheck } from "../agents/rule-check";
import {
  PipelineAnnotation,
  type GuardianIssue,
  type PipelineState,
  type TraceEvent,
} from "./state";

/** Builds one trace entry. Every node emits exactly one. */
function traceEvent(
  agent: string,
  label: string,
  startedAt: number,
  detail: string,
  usage?: TokenUsage,
): TraceEvent {
  return {
    agent,
    label,
    status: "ok",
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    detail,
    tokens: usage?.totalTokens,
    usage,
    costUsd: usage ? estimateCost(usage) : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Nodes
 * ------------------------------------------------------------------ */

async function researchNode(state: PipelineState) {
  const startedAt = Date.now();
  const research = await runResearchAgent(state.brief);
  return {
    research,
    trace: [
      traceEvent(
        "researchAgent",
        "Research Agent",
        startedAt,
        `Chose ${research.queries.length} search queries (${research.queries.join(" | ")}) and synthesised ${research.sources.length} sources.`,
        research.usage,
      ),
    ],
  };
}

async function brandMemoryNode(state: PipelineState) {
  const startedAt = Date.now();
  const brandChunks = await runBrandMemoryAgent(
    state.brief,
    state.research?.summary ?? "",
    4,
    state.guidelines,
  );
  return {
    brandChunks,
    trace: [
      traceEvent(
        "brandMemoryAgent",
        "Brand Memory Agent",
        startedAt,
        `Retrieved ${brandChunks.length} guidelines: ${brandChunks
          .map((c) => `${c.category} (${c.score.toFixed(3)})`)
          .join(", ")}.`,
      ),
    ],
  };
}

async function copywriterNode(state: PipelineState) {
  const startedAt = Date.now();
  const isRevision = state.revisionNotes.length > 0 || Boolean(state.humanFeedback);

  const { copy, usage, attempts } = await runCopywriterAgent({
    brief: state.brief,
    researchSummary: state.research?.summary ?? "",
    brandChunks: state.brandChunks,
    revisionNotes: state.revisionNotes,
    previousCopy: state.copy,
    humanFeedback: state.humanFeedback,
  });

  return {
    copy,
    // Incremented here, not in the Guardian, so the cap counts actual rewrites.
    revisionCount: isRevision ? state.revisionCount + 1 : state.revisionCount,
    trace: [
      traceEvent(
        "copywriterAgent",
        isRevision ? "Copywriter Agent (revision)" : "Copywriter Agent",
        startedAt,
        state.humanFeedback
          ? `Rewrote copy based on human feedback ("${state.humanFeedback.slice(0, 40)}..."). JSON valid on attempt ${attempts}.`
          : isRevision
          ? `Rewrote copy to fix ${state.revisionNotes.length} flagged issue(s). JSON valid on attempt ${attempts}.`
          : `Drafted LinkedIn, Instagram, and email copy. JSON valid on attempt ${attempts}.`,
        usage,
      ),
    ],
  };
}

async function creativeDirectorNode(state: PipelineState) {
  const startedAt = Date.now();
  if (!state.copy) throw new Error("Creative Director ran before any copy existed.");

  const { creative, usage, attempts } = await runCreativeDirectorAgent({
    brief: state.brief,
    copy: state.copy,
    brandChunks: state.brandChunks,
  });

  return {
    creative,
    trace: [
      traceEvent(
        "creativeDirectorAgent",
        "Creative Director Agent",
        startedAt,
        `Produced creative "${creative.concept}" with a ${creative.palette.length}-colour palette. JSON valid on attempt ${attempts}.`,
        usage,
      ),
    ],
  };
}

async function guardianNode(state: PipelineState) {
  const startedAt = Date.now();
  if (!state.copy || !state.creative) {
    throw new Error("Brand Guardian ran before copy and creative existed.");
  }

  // Its own retrieval pass, and an exhaustive one.
  //
  // The Copywriter retrieves selectively (k=4) because it only needs the rules
  // that shape writing. A reviewer is different in kind: any rule it has not
  // been shown is a rule it cannot enforce. At k=4 the lowest-ranking guideline
  // was dropped and the Guardian approved copy that broke it. Ranking is still
  // computed and displayed, so which rules matter most stays visible.
  const guardianChunks = await retrieveComplianceGuidelines(
    state.copy,
    state.creative,
    state.guidelines.length,
    state.guidelines,
  );

  // Two independent checks. The deterministic scan runs first because it is
  // free and instant; its result is NOT fed to the model, so the two verdicts
  // stay genuinely independent and can be compared.
  const { findings, termsChecked } = runDeterministicCheck(
    state.copy,
    state.creative,
    state.guidelines,
  );

  const { verdict, usage, attempts, salvaged } = await runBrandGuardianAgent({
    brief: state.brief,
    copy: state.copy,
    creative: state.creative,
    brandChunks: guardianChunks,
  });

  // A banned term found by exact match is a certain violation, so it feeds the
  // revision alongside whatever the model flagged.
  const findingIssues: GuardianIssue[] = findings.map((f) => ({
    severity: "critical" as const,
    guideline: f.guideline,
    location: f.location,
    problem: `Banned term "${f.term}" appears in: "${f.excerpt}"`,
    fix: `Remove "${f.term}" and rewrite the sentence without it or any close variant.`,
  }));

  const clean = verdict.approved && findings.length === 0;

  return {
    verdict,
    verdictHistory: [verdict],
    guardianChunks,
    ruleFindings: findings,
    termsChecked,
    // Carried into the Copywriter if the conditional edge routes back.
    revisionNotes: clean ? [] : [...findingIssues, ...verdict.issues],
    trace: [
      traceEvent(
        "brandGuardianAgent",
        state.revisionCount > 0 ? "Brand Guardian Agent (re-review)" : "Brand Guardian Agent",
        startedAt,
        `Scanned ${termsChecked} banned terms deterministically (${findings.length} hit${
          findings.length === 1 ? "" : "s"
        }). Retrieved ${guardianChunks.length} guidelines; forced tool call returned approved=${
          verdict.approved
        } with ${verdict.issues.length} issue(s)${
          attempts > 1 ? ` after ${attempts} attempts` : ""
        }${salvaged ? " (recovered from a malformed generation)" : ""}.`,
        usage,
      ),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Conditional routing — the revise loop
 * ------------------------------------------------------------------ */

/** Hard cap. One revision, then the pipeline proceeds regardless of the verdict. */
export const MAX_REVISIONS = 1;

/**
 * The real conditional edge. After the Guardian, the graph either finishes or
 * routes back to the Copywriter with the flagged issues in state.
 */
export function routeAfterGuardian(state: PipelineState): "copywriterAgent" | typeof END {
  // Either check can send it back: the model's judgement, or the exact scan.
  const clean = state.verdict?.approved && state.ruleFindings.length === 0;
  if (clean) return END;
  if (state.revisionCount >= MAX_REVISIONS) return END; // cap reached — proceed anyway
  return "copywriterAgent";
}

/* ------------------------------------------------------------------ *
 * Graph assembly
 * ------------------------------------------------------------------ */

export function buildPipeline() {
  // Node names are suffixed "Agent" because LangGraph reserves state channel
  // names (`research`, `copy`, `creative`…) and forbids reusing them as nodes.
  return new StateGraph(PipelineAnnotation)
    .addNode("researchAgent", researchNode)
    .addNode("brandMemoryAgent", brandMemoryNode)
    .addNode("copywriterAgent", copywriterNode)
    .addNode("creativeDirectorAgent", creativeDirectorNode)
    .addNode("brandGuardianAgent", guardianNode)
    .addEdge(START, "researchAgent")
    .addEdge("researchAgent", "brandMemoryAgent")
    .addEdge("brandMemoryAgent", "copywriterAgent")
    .addEdge("copywriterAgent", "creativeDirectorAgent")
    .addEdge("creativeDirectorAgent", "brandGuardianAgent")
    // The loop: Guardian → Copywriter on a flag, otherwise → END.
    .addConditionalEdges("brandGuardianAgent", routeAfterGuardian, {
      copywriterAgent: "copywriterAgent",
      [END]: END,
    })
    .compile();
}

export async function runPipeline(
  brief: string,
  guidelines?: BrandGuideline[],
): Promise<PipelineState> {
  const graph = buildPipeline();
  return graph.invoke(guidelines ? { brief, guidelines } : { brief });
}
