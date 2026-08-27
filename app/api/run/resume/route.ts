import { runCopywriterAgent } from "@/lib/agents/copywriter";
import { runCreativeDirectorAgent } from "@/lib/agents/creative-director";
import { runBrandGuardianAgent } from "@/lib/agents/brand-guardian";
import { runDeterministicCheck } from "@/lib/agents/rule-check";
import { retrieveComplianceGuidelines } from "@/lib/agents/brand-memory";
import { BRAND_GUIDELINES } from "@/lib/memory/brand-kb";
import type { RunResumeRequest, RunSuccess } from "@/lib/graph/run-response";
import type { GuardianIssue, TraceEvent } from "@/lib/graph/state";
import { estimateCost, type TokenUsage } from "@/lib/llm/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = (await request.json().catch(() => ({}))) as Partial<RunResumeRequest>;

  if (!body.state || typeof body.action !== "string") {
    return Response.json(
      { ok: false, error: "Request body must include 'action' and 'state'." },
      { status: 400 },
    );
  }

  const currentState: RunSuccess = body.state;
  const newTrace: TraceEvent[] = [...currentState.trace];

  if (body.action === "approve") {
    // Merge any human inline edits
    const copy = body.humanEdits?.copy ? body.humanEdits.copy : currentState.copy;
    const creative = body.humanEdits?.creative ? body.humanEdits.creative : currentState.creative;

    newTrace.push(
      traceEvent(
        "humanApprovalNode",
        "Human Reviewer Approval",
        startedAt,
        body.humanEdits
          ? "Human manager reviewed and edited intermediate assets. Approved for output."
          : "Human manager reviewed intermediate assets without changes. Approved for output.",
      ),
    );

    const result: RunSuccess = {
      ...currentState,
      copy,
      creative,
      totalMs: currentState.totalMs + (Date.now() - startedAt),
      trace: newTrace,
    };

    return Response.json(result);
  }

  if (body.action === "rewrite") {
    const feedback = body.humanFeedback?.trim() || "Improve tone and brand alignment.";
    const stepStart = Date.now();

    // 1. Re-run Copywriter Agent with Human Feedback
    const copyRes = await runCopywriterAgent({
      brief: currentState.brief,
      researchSummary: currentState.research?.summary ?? "",
      brandChunks: currentState.brandChunks,
      revisionNotes: currentState.verdict?.issues ?? [],
      previousCopy: currentState.copy,
      humanFeedback: feedback,
    });

    newTrace.push(
      traceEvent(
        "copywriterAgent",
        "Copywriter Agent (Human Rewrite)",
        stepStart,
        `Rewrote copy based on human feedback: "${feedback}".`,
        copyRes.usage,
      ),
    );

    // 2. Re-run Creative Director Agent
    const creativeStart = Date.now();
    const creativeRes = await runCreativeDirectorAgent({
      brief: currentState.brief,
      copy: copyRes.copy,
      brandChunks: currentState.brandChunks,
    });

    newTrace.push(
      traceEvent(
        "creativeDirectorAgent",
        "Creative Director Agent",
        creativeStart,
        `Updated creative spec for revised copy concept "${creativeRes.creative.concept}".`,
        creativeRes.usage,
      ),
    );

    // 3. Re-run Brand Guardian Audit
    const guardianStart = Date.now();
    const guardianChunks = await retrieveComplianceGuidelines(
      copyRes.copy,
      creativeRes.creative,
      currentState.brandChunks.length,
    );

    const { findings, termsChecked } = runDeterministicCheck(
      copyRes.copy,
      creativeRes.creative,
      BRAND_GUIDELINES,
    );

    const guardianRes = await runBrandGuardianAgent({
      brief: currentState.brief,
      copy: copyRes.copy,
      creative: creativeRes.creative,
      brandChunks: guardianChunks,
    });

    const findingIssues: GuardianIssue[] = findings.map((f) => ({
      severity: "critical" as const,
      guideline: f.guideline,
      location: f.location,
      problem: `Banned term "${f.term}" appears in: "${f.excerpt}"`,
      fix: `Remove "${f.term}" and rewrite the sentence without it.`,
    }));

    newTrace.push(
      traceEvent(
        "brandGuardianAgent",
        "Brand Guardian Agent (Re-audit)",
        guardianStart,
        `Audited revised copy & creative. Approved=${guardianRes.verdict.approved} with ${guardianRes.verdict.issues.length} issue(s).`,
        guardianRes.usage,
      ),
    );

    const result: RunSuccess = {
      ...currentState,
      copy: copyRes.copy,
      creative: creativeRes.creative,
      verdict: guardianRes.verdict,
      verdictHistory: [...currentState.verdictHistory, guardianRes.verdict],
      ruleFindings: findings,
      termsChecked,
      guardianChunks,
      revisionCount: currentState.revisionCount + 1,
      totalMs: currentState.totalMs + (Date.now() - startedAt),
      trace: newTrace,
    };

    return Response.json(result);
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
