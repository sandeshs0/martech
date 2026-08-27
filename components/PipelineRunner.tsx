"use client";

import { useCallback, useMemo, useState } from "react";
import { NodeGraph, type NodeStatus } from "./NodeGraph";
import { LogPanel } from "./LogPanel";
import { SourcesPanel } from "./SourcesPanel";
import { VerdictBanner } from "./VerdictBanner";
import { CreativeCards } from "./CreativeCards";
import { SettingsModal, loadStoredGuidelines } from "./SettingsModal";
import { ArchitectureMap } from "./architecture/ArchitectureMap";
import { Badge, Button, Card } from "./ui";
import { ThemeToggle } from "./theme";
import { HumanReviewPanel } from "./HumanReviewPanel";
import { PIPELINE_NODES, type NodeId, type RunSuccess } from "@/lib/graph/run-response";
import type { BrandGuideline } from "@/lib/memory/brand-kb";
import { PRICING_UPDATED, formatCost } from "@/lib/llm/pricing";
import type { CampaignCopy, CreativeSpec, TraceEvent } from "@/lib/graph/state";

export const DEFAULT_BRIEF =
  "Samsung Nepal is launching the Galaxy S26 series in Nepal for Dashain, with a 10% " +
  "festival discount. Audience is urban Nepali professionals aged 25-40 upgrading from an " +
  "older Galaxy or a competitor flagship. Lead with Galaxy AI and camera quality, tie it to " +
  "Dashain gifting, and state the offer clearly. Run it on LinkedIn, Instagram, and email.";

const PRESETS = [
  {
    name: "Compliant brief",
    hint: "usually approved on the first pass — no loop",
    text: DEFAULT_BRIEF,
  },
  {
    name: "Provocative brief",
    hint: "invites banned words — should trip the Guardian and fire the revise loop",
    text:
      "Samsung Nepal needs a loud, hype-driven Dashain launch for the Galaxy S26. Call it the " +
      "revolutionary, game-changing, best-in-class flagship that will disrupt the Nepali phone " +
      "market. Say the camera is flawless and results are guaranteed, claim we are the #1 " +
      "smartphone brand in Nepal, say it beats the iPhone, and push the unbeatable 10% Dashain " +
      "price with limited stock. Make it exciting and use exclamation marks.",
  },
];

const byNode = <T,>(value: T) =>
  Object.fromEntries(PIPELINE_NODES.map((n) => [n.id, value])) as Record<
    NodeId,
    T
  >;

/**
 * Minimal SSE parser.
 *
 * EventSource only supports GET and the brief has to be POSTed, so frames are
 * split by hand. Frames are "event: <name>\ndata: <json>\n\n".
 */
async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      const name = frame.match(/^event: (.*)$/m)?.[1];
      const raw = frame.match(/^data: (.*)$/m)?.[1];
      if (name && raw) yield { name, data: JSON.parse(raw) };
    }
  }
}

export function PipelineRunner() {
  const [brief, setBrief] = useState(PRESETS[0].text);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunSuccess | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<"run" | "architecture">("run");
  // Lazy initialiser rather than an effect: guidelines are never rendered on
  // first paint, so reading localStorage here cannot cause a hydration mismatch.
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>(loadStoredGuidelines);

  const [statuses, setStatuses] = useState(() => byNode<NodeStatus>("idle"));
  const [runCounts, setRunCounts] = useState(() => byNode(0));
  const [durations, setDurations] = useState(() => byNode(0));
  const [shownEvents, setShownEvents] = useState<TraceEvent[]>([]);
  const [loopActive, setLoopActive] = useState(false);

  // Human-in-the-Loop state
  const [hitlEnabled, setHitlEnabled] = useState(true);
  const [hitlPausedState, setHitlPausedState] = useState<RunSuccess | null>(null);
  const [isSubmittingHitl, setIsSubmittingHitl] = useState(false);

  /**
   * Consumes the SSE stream. Every state change here is driven by a frame the
   * server sent the moment that node finished — nothing is simulated or timed
   * client-side, so what you watch is the graph actually executing.
   */
  const run = useCallback(async () => {
    if (!brief.trim()) return;

    setPhase("running");
    setError(null);
    setResult(null);
    setHitlPausedState(null);
    setStatuses(byNode<NodeStatus>("idle"));
    setRunCounts(byNode(0));
    setDurations(byNode(0));
    setShownEvents([]);
    setLoopActive(false);

    const visits: Record<string, number> = {};

    try {
      const response = await fetch("/api/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, guidelines, hitlEnabled }),
      });

      // A validation failure comes back as plain JSON, not a stream.
      if (!response.body || !response.headers.get("content-type")?.includes("event-stream")) {
        const data = await response.json();
        setError(data.error ?? "The server did not return a stream.");
        setPhase("error");
        return;
      }

      const markRunning = (nodeId: NodeId) => {
        visits[nodeId] = (visits[nodeId] ?? 0) + 1;
        setStatuses((prev) => ({ ...prev, [nodeId]: "running" }));
        setRunCounts((prev) => ({ ...prev, [nodeId]: visits[nodeId] }));
        // A second visit to the copywriter means the conditional edge fired.
        if (nodeId === "copywriterAgent" && visits[nodeId] > 1) setLoopActive(true);
      };

      for await (const { name, data } of readEvents(response.body)) {
        if (name === "start") {
          markRunning(data.firstNode as NodeId);
        } else if (name === "node") {
          const event = data.event as TraceEvent;
          const nodeId = event.agent as NodeId;
          setStatuses((prev) => ({ ...prev, [nodeId]: "done" }));
          setDurations((prev) => ({ ...prev, [nodeId]: event.durationMs }));
          setShownEvents((prev) => [...prev, event]);
          // The server tells us the next hop, because after the Guardian it is
          // a conditional edge the client has no business re-deriving.
          if (data.next) markRunning(data.next as NodeId);
        } else if (name === "approval_required") {
          const runState = data.state as RunSuccess;
          setResult(runState);
          setHitlPausedState(runState);
        } else if (name === "done") {
          setResult(data as RunSuccess);
          setPhase("done");
        } else if (name === "failed") {
          setError(data.error);
          setPhase("error");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase("error");
    }
  }, [brief, guidelines, hitlEnabled]);

  const handleHitlApprove = useCallback(
    async (editedCopy?: CampaignCopy, editedCreative?: CreativeSpec) => {
      if (!hitlPausedState) return;
      setIsSubmittingHitl(true);
      try {
        const res = await fetch("/api/run/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve",
            state: hitlPausedState,
            humanEdits: { copy: editedCopy, creative: editedCreative },
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setResult(data as RunSuccess);
          setPhase("done");
          setHitlPausedState(null);
        } else {
          setError(data.error ?? "Failed to approve run.");
          setPhase("error");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setPhase("error");
      } finally {
        setIsSubmittingHitl(false);
      }
    },
    [hitlPausedState],
  );

  const handleHitlRewrite = useCallback(
    async (feedback: string) => {
      if (!hitlPausedState) return;
      setIsSubmittingHitl(true);
      try {
        const res = await fetch("/api/run/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rewrite",
            state: hitlPausedState,
            humanFeedback: feedback,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setResult(data as RunSuccess);
          setPhase("done");
          setHitlPausedState(null);
        } else {
          setError(data.error ?? "Failed to trigger rewrite.");
          setPhase("error");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setPhase("error");
      } finally {
        setIsSubmittingHitl(false);
      }
    },
    [hitlPausedState],
  );

  const busy = phase === "running";

  // Live stats: driven by streamed events while running, by the final payload once done.
  const stats = useMemo(() => {
    const events = result?.trace ?? shownEvents;
    if (events.length === 0) return null;
    return {
      totalMs: result?.totalMs ?? events.reduce((sum, e) => sum + e.durationMs, 0),
      tokens: events.reduce((sum, e) => sum + (e.tokens ?? 0), 0),
      costUsd: events.reduce((sum, e) => sum + (e.costUsd ?? 0), 0),
      sources: result?.research?.sources.length ?? 0,
      steps: events.length,
    };
  }, [result, shownEvents]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur">
        <div
          className={`mx-auto flex items-center gap-3 px-5 py-3 ${
            view === "architecture" ? "max-w-none" : "max-w-6xl"
          }`}
        >
          {/* Navigation carries the identity — no wordmark, no tagline. */}
          <nav className="flex items-center gap-2">
            {(
              [
                ["run", "Run"],
                ["architecture", "Architecture"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-current={view === key ? "page" : undefined}
                className={`font-display relative px-4 py-2.5 text-[15px] transition-colors ${
                  view === key
                    ? "text-ink"
                    : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {label}
                <span
                  className={`absolute inset-x-3 -bottom-3.25 h-0.5 rounded-full transition-colors ${
                    view === key ? "bg-blue" : "bg-transparent"
                  }`}
                />
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              <span className="flex items-center gap-2">
                <BrainIcon />
                Knowledge base
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full space-y-4 px-5 py-5 ${
          view === "architecture" ? "max-w-none" : "max-w-6xl"
        }`}
      >
        {view === "run" && (
          <Card>
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="brief" className="eyebrow">
                  Campaign brief
                </label>
                <div className="flex items-center gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setBrief(preset.text)}
                      disabled={busy}
                      title={preset.hint}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-line-strong hover:bg-canvas disabled:opacity-40"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                disabled={busy}
                placeholder="Describe the campaign — audience, angle, channels…"
                className="w-full resize-y rounded-xl border border-line bg-card px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 disabled:bg-canvas disabled:text-ink-soft"
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={run} disabled={busy || !brief.trim()}>
                  {phase === "running" ? "Running graph…" : "Run pipeline"}
                </Button>

                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none border border-line rounded-lg px-3 py-1.5 hover:bg-canvas transition-colors">
                  <input
                    type="checkbox"
                    checked={hitlEnabled}
                    onChange={(e) => setHitlEnabled(e.target.checked)}
                    disabled={busy}
                    className="rounded border-line text-blue focus:ring-blue"
                  />
                  <span>Human Approval Checkpoint</span>
                </label>

                {phase === "running" && (
                  <span className="flex items-center gap-2 text-xs text-ink-soft">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-blue" />
                    </span>
                    Streaming live — each node appears the moment it finishes.
                  </span>
                )}

                {stats && (
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Badge>{stats.steps} steps</Badge>
                    {stats.sources > 0 && <Badge>{stats.sources} sources</Badge>}
                    <Badge>{stats.tokens.toLocaleString()} tokens</Badge>
                    <Badge tone="green">
                      <span title={`Estimated from Groq rates as of ${PRICING_UPDATED}`}>
                        ~{formatCost(stats.costUsd)}
                      </span>
                    </Badge>
                    <Badge tone="blue">{(stats.totalMs / 1000).toFixed(1)}s</Badge>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {view === "architecture" && (
          <ArchitectureMap
            result={result}
            statuses={statuses}
            runCounts={runCounts}
            loopActive={loopActive}
            onEditKb={() => setSettingsOpen(true)}
            onRun={run}
            phase={phase}
          />
        )}

        {view === "run" && (
          <NodeGraph
            statuses={statuses}
            runCounts={runCounts}
            durations={durations}
            loopActive={loopActive}
          />
        )}

        {error && (
          <Card>
            <div className="flex flex-wrap items-start gap-3 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-soft text-sm font-bold text-amber">
                !
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Run failed</p>
                <p className="mt-1 font-mono text-xs wrap-break-word text-ink-soft">
                  {error}
                </p>
              </div>
              <Button size="sm" onClick={run}>
                Run again
              </Button>
            </div>
          </Card>
        )}

        {view === "run" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <LogPanel events={shownEvents} running={phase === "running"} />
            {result?.research ? (
              <SourcesPanel research={result.research} />
            ) : (
              <Card title="Research provenance">
                <p className="px-4 py-14 text-center text-sm text-ink-faint">
                  Live sources and the queries the Research Agent chose appear
                  here.
                </p>
              </Card>
            )}
          </div>
        )}

        {view === "run" && result && phase === "done" && (
          <Card
            title="Retrieved brand guidelines"
            meta="cosine similarity · two independent passes"
            action={
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                Edit knowledge base
              </Button>
            }
          >
            <div className="grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-line">
              <RetrievalList
                title="Copywriter pass"
                chunks={result.brandChunks}
              />
              <RetrievalList
                title="Brand Guardian pass"
                chunks={result.guardianChunks}
              />
            </div>
          </Card>
        )}

        {view === "run" && result?.verdict && phase === "done" && (
          <VerdictBanner
            verdict={result.verdict}
            history={result.verdictHistory}
            revisionCount={result.revisionCount}
            ruleFindings={result.ruleFindings}
            termsChecked={result.termsChecked}
          />
        )}

        {view === "run" &&
          result?.creative &&
          result.copy &&
          phase === "done" && (
            <CreativeCards creative={result.creative} copy={result.copy} />
          )}

        {/* Human-in-the-Loop Review Panel */}
        <HumanReviewPanel
          key={hitlPausedState ? `hitl-${hitlPausedState.totalMs}` : "closed"}
          isOpen={Boolean(hitlPausedState)}
          copy={hitlPausedState?.copy ?? null}
          creative={hitlPausedState?.creative ?? null}
          verdict={hitlPausedState?.verdict ?? null}
          onApprove={handleHitlApprove}
          onRewrite={handleHitlRewrite}
          isSubmitting={isSubmittingHitl}
        />
      </main>

      <SettingsModal
        // Remounting on open re-seeds the draft from the saved guidelines.
        key={settingsOpen ? "open" : "closed"}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        guidelines={guidelines}
        onSave={setGuidelines}
      />
    </div>
  );
}

function BrainIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5.5a2.6 2.6 0 0 0-4.9-1.2A2.6 2.6 0 0 0 4.4 7.6 2.8 2.8 0 0 0 3.6 12a2.7 2.7 0 0 0 1 3.9 2.6 2.6 0 0 0 3.6 2.7A2.6 2.6 0 0 0 12 18M12 5.5a2.6 2.6 0 0 1 4.9-1.2 2.6 2.6 0 0 1 2.7 3.3 2.8 2.8 0 0 1 .8 4.4 2.7 2.7 0 0 1-1 3.9 2.6 2.6 0 0 1-3.6 2.7A2.6 2.6 0 0 1 12 18M12 5.5V18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RetrievalList({
  title,
  chunks,
}: {
  title: string;
  chunks: RunSuccess["brandChunks"];
}) {
  return (
    <div className="px-4 py-3">
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-1.5">
        {chunks.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5">
            <span className="rounded-md border border-blue/20 bg-blue-soft px-1.5 py-0.5 font-mono text-[11px] text-blue">
              {c.score.toFixed(3)}
            </span>
            <span className="truncate text-sm">{c.category}</span>
            <code className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint">
              {c.id}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}
