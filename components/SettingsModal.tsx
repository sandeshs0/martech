"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Modal } from "./ui";
import { BRAND_GUIDELINES, type BrandGuideline } from "@/lib/memory/brand-kb";

const STORAGE_KEY = "martech-ai.guidelines";

/**
 * Loads edited guidelines from localStorage so they survive a page reload
 * mid-demo. Nothing is stored server-side — the set travels with each run
 * request and is re-embedded on arrival.
 */
export function loadStoredGuidelines(): BrandGuideline[] {
  if (typeof window === "undefined") return BRAND_GUIDELINES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return BRAND_GUIDELINES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return BRAND_GUIDELINES;
    return parsed as BrandGuideline[];
  } catch {
    return BRAND_GUIDELINES;
  }
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export function SettingsModal({
  open,
  onClose,
  guidelines,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  guidelines: BrandGuideline[];
  onSave: (next: BrandGuideline[]) => void;
}) {
  // The parent remounts this component on open (via key), so the initialiser
  // re-seeds the draft every time — a cancelled edit is discarded for free,
  // with no effect needed to sync props into state.
  const [draft, setDraft] = useState<BrandGuideline[]>(guidelines);

  const errors = useMemo(() => {
    const problems: string[] = [];
    if (draft.length === 0) problems.push("Keep at least one guideline.");
    if (draft.length > 20) problems.push("Maximum 20 guidelines.");
    draft.forEach((g, i) => {
      if (!g.category.trim()) problems.push(`Guideline ${i + 1} needs a category.`);
      if (g.text.trim().length < 10) problems.push(`Guideline ${i + 1} needs at least 10 characters.`);
    });
    const ids = draft.map((g) => g.id);
    if (new Set(ids).size !== ids.length) problems.push("Guideline ids must be unique.");
    return problems;
  }, [draft]);

  const update = (index: number, patch: Partial<BrandGuideline>) =>
    setDraft((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));

  const remove = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  const add = () =>
    setDraft((prev) => [
      ...prev,
      { id: `guideline-${prev.length + 1}-${Date.now().toString(36)}`, category: "", text: "" },
    ]);

  const save = () => {
    if (errors.length > 0) return;
    const cleaned = draft.map((g) => ({
      ...g,
      id: g.id.trim() || slugify(g.category) || "guideline",
      category: g.category.trim(),
      text: g.text.trim(),
    }));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // Storage being unavailable is not worth blocking the save.
    }
    onSave(cleaned);
    onClose();
  };

  const reset = () => {
    setDraft(BRAND_GUIDELINES);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const isDefault = JSON.stringify(draft) === JSON.stringify(BRAND_GUIDELINES);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Brand knowledge base"
      description="These snippets are embedded locally and retrieved per run. Edits apply to the next run — nothing is stored on the server."
      footer={
        <>
          <span className="mr-auto text-xs text-ink-faint">
            {draft.length} {draft.length === 1 ? "guideline" : "guidelines"}
            {!isDefault && " · modified"}
          </span>
          <Button variant="quiet" size="sm" onClick={reset} disabled={isDefault}>
            Reset to defaults
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={errors.length > 0}>
            Save
          </Button>
        </>
      }
    >
      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber/30 bg-amber-soft px-3 py-2">
          <ul className="space-y-0.5 text-xs text-amber">
            {errors.slice(0, 4).map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {draft.map((g, i) => (
          <div key={g.id} className="rounded-xl border border-line bg-canvas/60 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card text-xs font-semibold text-ink-soft ring-1 ring-line">
                {i + 1}
              </span>
              <input
                value={g.category}
                onChange={(e) => update(i, { category: e.target.value })}
                placeholder="Category, e.g. Prohibited Language"
                className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm font-medium outline-none focus:border-blue"
              />
              <code className="hidden shrink-0 font-mono text-[11px] text-ink-faint sm:block">
                {g.id}
              </code>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove guideline ${i + 1}`}
                className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-card hover:text-red"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M4 6h12M8 6V4.5h4V6m-6.5 0 .6 9.2a1 1 0 0 0 1 .8h5.8a1 1 0 0 0 1-.8L15.5 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <textarea
              value={g.text}
              onChange={(e) => update(i, { text: e.target.value })}
              rows={3}
              placeholder="The rule itself. Be specific — this text is what gets embedded and retrieved."
              className="mt-2 w-full resize-y rounded-lg border border-line bg-card px-2.5 py-2 text-sm leading-relaxed outline-none focus:border-blue"
            />
            <p className="mt-1 text-right text-[11px] text-ink-faint">{g.text.length} chars</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={add} disabled={draft.length >= 20}>
          + Add guideline
        </Button>
        <Badge tone="blue">Re-embedded on next run (~50ms)</Badge>
      </div>
    </Modal>
  );
}
