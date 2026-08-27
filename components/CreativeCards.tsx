"use client";

import { useCallback, useState } from "react";
import { Badge, Button, Card } from "./ui";
import type { CampaignCopy, CreativeSpec } from "@/lib/graph/state";

type ImageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string; latencyMs: number; model: string }
  | { status: "error"; message: string };

/**
 * Renders the Creative Director's structured spec.
 *
 * The mockup is styled from the agent's own returned palette — the brand's
 * colours, not this tool's — so what you see is the JSON, not CSS written to
 * look convincing.
 */
export function CreativeCards({
  creative,
  copy,
}: {
  creative: CreativeSpec;
  copy: CampaignCopy;
}) {
  const [image, setImage] = useState<ImageState>({ status: "idle" });

  const background = creative.palette[0]?.hex ?? "#1B1B3A";
  const accent = creative.palette.find((p) => /accent/i.test(p.usage))?.hex ?? "#FFB627";
  const typeColor = creative.palette.find((p) => /type|text/i.test(p.usage))?.hex ?? "#F4F1EC";

  const generate = useCallback(async () => {
    setImage({ status: "loading" });
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageConcept: creative.imageConcept, palette: creative.palette }),
      });
      const data = await response.json();
      if (!data.ok) {
        setImage({ status: "error", message: data.error });
        return;
      }
      setImage({
        status: "ready",
        url: data.url,
        latencyMs: data.latencyMs,
        model: data.model,
      });
    } catch (cause) {
      setImage({
        status: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }, [creative.imageConcept, creative.palette]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ad creative" meta={creative.concept}>
          <div className="p-4">
            <div
              className="rounded-xl p-7"
              style={{ backgroundColor: background, color: typeColor }}
            >
              <div
                className="mb-4 h-1 w-12 rounded-full"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
              <h3 className="text-3xl leading-tight font-semibold tracking-tight">
                {creative.headline}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed opacity-80">
                {creative.subheadline}
              </p>
              <span
                className="mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: accent, color: background }}
              >
                {creative.ctaLabel}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="eyebrow">Palette from agent JSON</span>
              {creative.palette.map((p) => (
                <span key={p.hex} className="flex items-center gap-1.5">
                  <span
                    className="h-4 w-4 rounded-md ring-1 ring-line"
                    style={{ backgroundColor: p.hex }}
                  />
                  <code className="font-mono text-[11px] text-ink-soft">{p.hex}</code>
                </span>
              ))}
            </div>

            <dl className="mt-3 space-y-2 text-xs">
              <Field label="Typography" value={creative.typography} />
              <Field label="Layout notes" value={creative.layoutNotes} />
            </dl>
          </div>
        </Card>

        <Card
          title="Generated image"
          meta={
            image.status === "ready" ? `${image.model} · ${image.latencyMs}ms` : "FLUX.1 schnell"
          }
        >
          <div className="flex h-full flex-col p-4">
            <p className="eyebrow mb-1.5">imageConcept from Creative Director</p>
            <p className="rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-soft">
              {creative.imageConcept}
            </p>

            <div className="mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-canvas p-3">
              {image.status === "idle" && (
                <p className="max-w-xs text-center text-xs leading-relaxed text-ink-faint">
                  Not generated yet. The structured spec stands on its own — the render is an
                  optional extra step.
                </p>
              )}
              {image.status === "loading" && (
                <p className="text-center text-xs font-medium text-blue">
                  Generating via FLUX.1 [schnell]… (10–20s)
                </p>
              )}
              {image.status === "error" && (
                <div className="text-center">
                  <Badge tone="amber">Image generation failed</Badge>
                  <p className="mt-2 max-w-xs font-mono text-[11px] leading-relaxed wrap-break-word text-ink-soft">
                    {image.message}
                  </p>
                </div>
              )}
              {image.status === "ready" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt={creative.imageConcept}
                  className="w-full rounded-lg"
                />
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={generate} disabled={image.status === "loading"}>
                {image.status === "ready" ? "Regenerate" : "Generate image"}
              </Button>
              {image.status === "ready" && (
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue hover:underline"
                >
                  Open full size
                </a>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChannelCard title="LinkedIn" meta={`${wordCount(copy.linkedin.body)} words`}>
          <p className="whitespace-pre-wrap">{copy.linkedin.body}</p>
          <Hashtags tags={copy.linkedin.hashtags} />
        </ChannelCard>

        <ChannelCard title="Instagram" meta={`${copy.instagram.caption.length} chars`}>
          <p className="whitespace-pre-wrap">{copy.instagram.caption}</p>
          <Hashtags tags={copy.instagram.hashtags} />
          <p className="mt-2.5 border-t border-line pt-2 text-xs text-ink-faint">
            <span className="font-medium text-ink-soft">Alt text:</span> {copy.instagram.altText}
          </p>
        </ChannelCard>

        <ChannelCard title="Email" meta={`subject ${copy.email.subject.length} chars`}>
          <p className="font-semibold">{copy.email.subject}</p>
          <p className="mt-2 whitespace-pre-wrap">{copy.email.body}</p>
          <span className="mt-3 inline-block rounded-lg bg-blue px-3 py-1.5 text-xs font-semibold text-white">
            {copy.email.cta}
          </span>
        </ChannelCard>
      </div>

      <div className="card px-4 py-3">
        <span className="eyebrow">Copywriter rationale</span>
        <p className="mt-1 text-sm text-ink-soft">{copy.rationale}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 leading-relaxed text-ink-soft">{value}</dd>
    </div>
  );
}

function ChannelCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <Card title={title} meta={meta}>
      <div className="px-4 py-3 text-sm leading-relaxed">{children}</div>
    </Card>
  );
}

function Hashtags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <p className="mt-2 text-xs font-medium text-blue">
      {tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}
    </p>
  );
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
