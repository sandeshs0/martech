/**
 * The shared state object that flows through the LangGraph pipeline, plus the
 * Zod schemas that define what each agent is contractually allowed to produce.
 *
 * Every node receives the whole accumulated state and returns a partial update.
 * LangGraph merges those updates channel by channel using the reducers below.
 */
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { BRAND_GUIDELINES, type BrandGuideline } from "../memory/brand-kb";
import type { TokenUsage } from "../llm/pricing";
import type { RuleFinding } from "../agents/rule-check";
import type { ResearchOutput } from "../agents/research";
import type { RetrievedChunk } from "../memory/store";

/* ------------------------------------------------------------------ *
 * Copywriter output
 * ------------------------------------------------------------------ */

export const CampaignCopySchema = z.object({
  linkedin: z.object({
    body: z.string().min(1),
    hashtags: z.array(z.string()),
  }),
  instagram: z.object({
    caption: z.string().min(1),
    hashtags: z.array(z.string()),
    altText: z.string().min(1),
  }),
  email: z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    cta: z.string().min(1),
  }),
  rationale: z.string().min(1),
});

export type CampaignCopy = z.infer<typeof CampaignCopySchema>;

/* ------------------------------------------------------------------ *
 * Creative Director output
 * ------------------------------------------------------------------ */

export const CreativeSpecSchema = z.object({
  concept: z.string().min(1),
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  /** Feeds the Fal.ai image prompt in Phase 7. */
  imageConcept: z.string().min(1),
  palette: z.array(
    z.object({
      name: z.string().min(1),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "hex must look like #1B1B3A"),
      usage: z.string().min(1),
    }),
  ).min(1),
  typography: z.string().min(1),
  layoutNotes: z.string().min(1),
  ctaLabel: z.string().min(1),
});

export type CreativeSpec = z.infer<typeof CreativeSpecSchema>;

/* ------------------------------------------------------------------ *
 * Brand Guardian verdict — produced by a forced tool call, not text parsing
 * ------------------------------------------------------------------ */

export const GuardianIssueSchema = z.object({
  severity: z.enum(["critical", "major", "minor"]),
  guideline: z.string().min(1),
  location: z.string().min(1),
  problem: z.string().min(1),
  fix: z.string().min(1),
});

export const GuardianVerdictSchema = z.object({
  approved: z.boolean(),
  issues: z.array(GuardianIssueSchema),
  summary: z.string().min(1),
});

export type GuardianIssue = z.infer<typeof GuardianIssueSchema>;
export type GuardianVerdict = z.infer<typeof GuardianVerdictSchema>;

/** The same schema expressed as JSON Schema for Groq's tool-calling API. */
export const GUARDIAN_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    approved: {
      type: "boolean",
      description:
        "true only if the copy and creative violate no brand guideline. Any critical or major issue means false.",
    },
    issues: {
      type: "array",
      description: "Every guideline violation found. Empty array if fully compliant.",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "major", "minor"],
            description: "critical = banned word or legal claim risk; major = clear rule break; minor = style drift.",
          },
          guideline: { type: "string", description: "Which brand guideline was violated." },
          location: { type: "string", description: "Where it appears, e.g. 'linkedin.body' or 'creative.headline'." },
          problem: { type: "string", description: "What is wrong, quoting the offending text." },
          fix: { type: "string", description: "A specific, actionable correction." },
        },
        required: ["severity", "guideline", "location", "problem", "fix"],
      },
    },
    summary: { type: "string", description: "One or two sentences explaining the verdict." },
  },
  required: ["approved", "issues", "summary"],
} as const satisfies Record<string, unknown>;

/* ------------------------------------------------------------------ *
 * Execution trace — what the Phase 6 UI animates through
 * ------------------------------------------------------------------ */

export type TraceEvent = {
  agent: string;
  label: string;
  status: "ok" | "error";
  startedAt: string;
  durationMs: number;
  /** Short human-readable note about what this node actually did. */
  detail: string;
  tokens?: number;
  /** Prompt/completion split, so per-agent cost can be computed honestly. */
  usage?: TokenUsage;
  /** Estimated USD for this node. See lib/llm/pricing.ts. */
  costUsd?: number;
};

/* ------------------------------------------------------------------ *
 * Graph state
 * ------------------------------------------------------------------ */

export const PipelineAnnotation = Annotation.Root({
  brief: Annotation<string>,

  /** The brand knowledge base for this run — editable from the settings modal. */
  guidelines: Annotation<BrandGuideline[]>({
    reducer: (_prev, next) => next,
    default: () => BRAND_GUIDELINES,
  }),

  research: Annotation<ResearchOutput | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  brandChunks: Annotation<RetrievedChunk[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  copy: Annotation<CampaignCopy | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  creative: Annotation<CreativeSpec | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Guidelines retrieved by the Guardian for review — a separate pass from the Copywriter's. */
  guardianChunks: Annotation<RetrievedChunk[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  verdict: Annotation<GuardianVerdict | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /**
   * Append-only record of every verdict. On a revise loop the final `verdict`
   * overwrites the first one, and the rejection is the interesting half.
   */
  verdictHistory: Annotation<GuardianVerdict[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  /**
   * How many times the Copywriter has been sent back by the Guardian.
   * Phase 5 uses this to cap the revise loop at one iteration.
   */
  revisionCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /**
   * Output of the deterministic banned-term scan that runs alongside the LLM
   * Guardian. Independent of the verdict — either check can trigger a revision.
   */
  ruleFindings: Annotation<RuleFinding[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** How many banned terms the scan had available to look for. */
  termsChecked: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Feedback carried back to the Copywriter on a revision pass. */
  revisionNotes: Annotation<GuardianIssue[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** Whether Human-in-the-Loop approval is enabled for this run. */
  hitlEnabled: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** Custom feedback provided by a human reviewer during a HITL pause. */
  humanFeedback: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /**
   * Append-only. This reducer is why the trace accumulates across nodes
   * instead of each node overwriting the last one's entry.
   */
  trace: Annotation<TraceEvent[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
});

export type PipelineState = typeof PipelineAnnotation.State;

