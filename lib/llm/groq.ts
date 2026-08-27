/**
 * Groq client + a thin chat helper shared by every agent in the pipeline.
 *
 * Deliberately framework-agnostic: no `next/*` imports anywhere under lib/,
 * so the whole backend can be exercised from a plain Node script or lifted
 * into another server without changes.
 */
import Groq from "groq-sdk";
import type { ZodType } from "zod";

/**
 * Primary Groq model used across all pipeline agents.
 * Configurable via GROQ_MODEL in .env.local with robust active model defaults.
 */
export const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.6-27b";
export const FALLBACK_MODEL = "openai/gpt-oss-120b";

let client: Groq | null = null;

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }
  if (!client) client = new Groq({ apiKey });
  return client;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResult = {
  text: string;
  model: string;
  /** Token counts straight from the Groq response — useful proof the call was real. */
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
};

export async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<ChatResult> {
  const groq = getGroqClient();
  const primaryModel = options.model ?? GROQ_MODEL;
  const startedAt = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      model: primaryModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    });

    return {
      text: completion.choices[0]?.message?.content ?? "",
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - startedAt,
    };
  } catch (err: unknown) {
    const isNotFound = err instanceof Error && (err.message.includes("model_not_found") || err.message.includes("does not exist") || err.message.includes("json_validate_failed"));
    if (isNotFound && primaryModel !== FALLBACK_MODEL) {
      const completion = await groq.chat.completions.create({
        model: FALLBACK_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      });

      return {
        text: completion.choices[0]?.message?.content ?? "",
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
        latencyMs: Date.now() - startedAt,
      };
    }
    throw err;
  }
}

/**
 * Asks Groq for JSON and validates it against a Zod schema.
 *
 * Two layers of safety, because "the model returned malformed JSON" is the most
 * common way a demo like this falls over on stage:
 *   - Groq's `json_object` response format constrains the raw output.
 *   - Zod validates the *shape*, and on failure we retry once, feeding the
 *     validation error back to the model so it can correct itself.
 */
export async function chatJSON<T>(
  messages: ChatMessage[],
  schema: ZodType<T>,
  options: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<{ data: T; raw: string; usage: ChatResult["usage"]; latencyMs: number; attempts: number }> {
  const groq = getGroqClient();
  let model = options.model ?? GROQ_MODEL;
  const startedAt = Date.now();
  const conversation: ChatMessage[] = [...messages];
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: conversation,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const usage = {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };

      try {
        const parsed = schema.parse(JSON.parse(raw));
        return { data: parsed, raw, usage, latencyMs: Date.now() - startedAt, attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        conversation.push(
          { role: "assistant", content: raw },
          {
            role: "user",
            content: `That output failed validation:\n${lastError}\n\nReturn corrected JSON matching the required schema exactly. Output JSON only.`,
          },
        );
      }
    } catch (err: unknown) {
      const isRecoverable = err instanceof Error && (
        err.message.includes("model_not_found") ||
        err.message.includes("does not exist") ||
        err.message.includes("json_validate_failed") ||
        err.message.includes("Failed to validate JSON")
      );
      if (isRecoverable && model !== FALLBACK_MODEL) {
        model = FALLBACK_MODEL;
        attempt--; // retry with fallback model
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Model failed to produce valid JSON after 2 attempts. Last error: ${lastError}`);
}

/**
 * Forces a tool call and returns its validated arguments.
 *
 * `tool_choice` pins the model to this one function, so it cannot reply with
 * prose — the structured object is the only possible output. This is what the
 * Brand Guardian uses for its verdict instead of parsing free text.
 */
export async function chatWithForcedTool<T>(
  messages: ChatMessage[],
  tool: { name: string; description: string; parameters: Record<string, unknown> },
  schema: ZodType<T>,
  options: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<{
  data: T;
  rawArguments: string;
  usage: ChatResult["usage"];
  latencyMs: number;
  attempts: number;
  /** True when the verdict was recovered from a rejected generation. */
  salvaged: boolean;
}> {
  const groq = getGroqClient();
  let model = options.model ?? GROQ_MODEL;
  const startedAt = Date.now();
  const conversation: ChatMessage[] = [...messages];
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: conversation,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
        tools: [
          {
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: tool.name } },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error(`Model did not call the forced tool '${tool.name}'.`);
      }

      const rawArguments = toolCall.function.arguments;
      return {
        data: schema.parse(JSON.parse(rawArguments)),
        rawArguments,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
        latencyMs: Date.now() - startedAt,
        attempts: attempt,
        salvaged: false,
      };
    } catch (error) {
      const isRecoverableError = error instanceof Error && (
        error.message.includes("model_not_found") ||
        error.message.includes("does not exist") ||
        error.message.includes("tool_use_failed") ||
        error.message.includes("Failed to call a function")
      );
      if (isRecoverableError && model !== FALLBACK_MODEL) {
        model = FALLBACK_MODEL;
        attempt--;
        continue;
      }

      // Groq rejects its own malformed function syntax with a 400, but the
      // rejection still carries the generated text. Recovering it is far better
      // than losing an otherwise-complete run to one bad escape sequence.
      const salvaged = salvageToolArguments(error);
      if (salvaged) {
        try {
          return {
            data: schema.parse(JSON.parse(salvaged)),
            rawArguments: salvaged,
            usage: EMPTY_USAGE_SHAPE,
            latencyMs: Date.now() - startedAt,
            attempts: attempt,
            salvaged: true,
          };
        } catch {
          // Salvage did not parse either — fall through to a corrective retry.
        }
      }

      lastError = error instanceof Error ? error.message : String(error);
      conversation.push({
        role: "user",
        content:
          `Your previous ${tool.name} call was rejected: ${lastError.slice(0, 300)}\n\n` +
          "Call the function again with strictly valid JSON arguments. Use double quotes for " +
          "all strings, never backslash-escape a single quote, and avoid quoting text that " +
          "contains apostrophes — paraphrase it instead.",
      });
    }
  }

  throw new Error(
    `Model failed to produce a valid '${tool.name}' call after 3 attempts. Last error: ${lastError}`,
  );
}

const EMPTY_USAGE_SHAPE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/**
 * Pulls the arguments out of a Groq `tool_use_failed` error.
 *
 * The failed generation looks like `<function=name>{...}</function>`, and the
 * usual defect is `\'` — valid in the model's head, invalid JSON. We extract the
 * object and repair that one escape rather than attempting general JSON repair,
 * which would risk silently accepting genuinely broken output.
 */
export function salvageToolArguments(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const holder = error as { error?: unknown; body?: unknown };
  const bodies = [holder.error, holder.body];

  for (const body of bodies) {
    const inner = (body as { error?: { failed_generation?: unknown }; failed_generation?: unknown })
      ?.error?.failed_generation ?? (body as { failed_generation?: unknown })?.failed_generation;

    if (typeof inner !== "string") continue;

    const wrapped = inner.match(/<function=[^>]*>([\s\S]*?)<\/function>/);
    const raw = (wrapped ? wrapped[1] : inner).trim();
    if (!raw.startsWith("{")) continue;

    return raw.replace(/\\'/g, "'");
  }

  return null;
}

/** Confirms the configured model actually exists on the account, rather than assuming it. */
export async function listModelIds(): Promise<string[]> {
  const groq = getGroqClient();
  const models = await groq.models.list();
  return models.data.map((m) => m.id).sort();
}
