"use client";

import { Badge } from "./ui";
import type { GuardianVerdict } from "@/lib/graph/state";
import type { RuleFinding } from "@/lib/agents/rule-check";

const SEVERITY = {
  critical: "border-red/25 bg-red/5 text-red",
  major: "border-amber/25 bg-amber-soft text-amber",
  minor: "border-line bg-canvas text-ink-soft",
} as const;

export function VerdictBanner({
  verdict,
  history,
  revisionCount,
  ruleFindings,
  termsChecked,
}: {
  verdict: GuardianVerdict;
  history: GuardianVerdict[];
  revisionCount: number;
  ruleFindings: RuleFinding[];
  termsChecked: number;
}) {
  // The headline verdict reflects both checks — a banned term found by exact
  // match is a violation regardless of what the model concluded.
  const approved = verdict.approved && ruleFindings.length === 0;

  return (
    <section className="card overflow-hidden">
      <header
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 ${
          approved ? "border-green/20 bg-green-soft" : "border-amber/20 bg-amber-soft"
        }`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${
            approved ? "bg-green" : "bg-amber"
          }`}
        >
          {approved ? "✓" : "!"}
        </span>
        <div>
          <p className="text-sm leading-none font-semibold tracking-tight">
            Brand Guardian — {approved ? "Approved" : "Flagged"}
          </p>
          <code className="mt-1 block font-mono text-[11px] text-ink-soft">
            submit_verdict({"{"} approved: {String(approved)}, issues: {verdict.issues.length} {"}"})
          </code>
        </div>
        {revisionCount > 0 && (
          <span className="ml-auto">
            <Badge tone="blue">{revisionCount} revision · loop capped at 1</Badge>
          </span>
        )}
      </header>

      {/* Two independent checks, reported separately so you can see where each
          one is stronger. The scan cannot hallucinate; the model catches what a
          regex cannot. */}
      <div className="grid gap-0 border-b border-line sm:grid-cols-2 sm:divide-x sm:divide-line">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow">Deterministic scan</span>
            <Badge tone={ruleFindings.length === 0 ? "green" : "amber"}>
              {ruleFindings.length === 0 ? "Clean" : `${ruleFindings.length} hit`}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            {termsChecked} banned terms parsed from the knowledge base, exact match, 0 tokens.
          </p>
          {ruleFindings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {ruleFindings.map((f, i) => (
                <li key={i} className="text-xs">
                  <code className="font-mono font-semibold text-amber">{f.term}</code>
                  <span className="text-ink-faint"> in {f.location}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow">LLM review</span>
            <Badge tone={verdict.approved ? "green" : "amber"}>
              {verdict.approved ? "Approved" : `${verdict.issues.length} issues`}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            Judgement calls a regex cannot make: unsourced claims, tone drift, implied guarantees.
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm leading-relaxed">{verdict.summary}</p>

        {history.length > 1 && (
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            Review passes:{" "}
            {history
              .map((v, i) => `#${i + 1} ${v.approved ? "approved" : `${v.issues.length} issues`}`)
              .join("  →  ")}
          </p>
        )}

        {verdict.issues.length > 0 && (
          <ul className="mt-3 space-y-2">
            {verdict.issues.map((issue, i) => (
              <li key={i} className={`rounded-xl border px-3 py-2.5 ${SEVERITY[issue.severity]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-card/70 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    {issue.severity}
                  </span>
                  <code className="font-mono text-[11px] font-semibold">{issue.location}</code>
                  <span className="text-[11px] opacity-70">{issue.guideline}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink">{issue.problem}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">Fix:</span> {issue.fix}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
