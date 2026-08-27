"use client";

import { useEffect, useState } from "react";
import type { CampaignCopy, CreativeSpec, GuardianVerdict } from "@/lib/graph/state";
import { Button, Card, Badge } from "./ui";

interface HumanReviewPanelProps {
  isOpen: boolean;
  copy: CampaignCopy | null;
  creative: CreativeSpec | null;
  verdict: GuardianVerdict | null;
  onApprove: (editedCopy?: CampaignCopy, editedCreative?: CreativeSpec) => void;
  onRewrite: (feedback: string) => void;
  isSubmitting: boolean;
}

export function HumanReviewPanel({
  isOpen,
  copy: initialCopy,
  creative: initialCreative,
  verdict,
  onApprove,
  onRewrite,
  isSubmitting,
}: HumanReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<"copy" | "creative" | "feedback">("copy");

  // Inline edit state
  const [linkedinBody, setLinkedinBody] = useState(initialCopy?.linkedin.body ?? "");
  const [instagramCaption, setInstagramCaption] = useState(initialCopy?.instagram.caption ?? "");
  const [emailSubject, setEmailSubject] = useState(initialCopy?.email.subject ?? "");
  const [emailBody, setEmailBody] = useState(initialCopy?.email.body ?? "");
  const [emailCta, setEmailCta] = useState(initialCopy?.email.cta ?? "");

  const [headline, setHeadline] = useState(initialCreative?.headline ?? "");
  const [concept, setConcept] = useState(initialCreative?.concept ?? "");
  const [imageConcept, setImageConcept] = useState(initialCreative?.imageConcept ?? "");

  // Feedback state
  const [feedbackText, setFeedbackText] = useState("");

  // Sync state whenever props arrive/change
  useEffect(() => {
    if (initialCopy) {
      setLinkedinBody(initialCopy.linkedin.body ?? "");
      setInstagramCaption(initialCopy.instagram.caption ?? "");
      setEmailSubject(initialCopy.email.subject ?? "");
      setEmailBody(initialCopy.email.body ?? "");
      setEmailCta(initialCopy.email.cta ?? "");
    }
    if (initialCreative) {
      setHeadline(initialCreative.headline ?? "");
      setConcept(initialCreative.concept ?? "");
      setImageConcept(initialCreative.imageConcept ?? "");
    }
  }, [initialCopy, initialCreative]);

  if (!isOpen || !initialCopy || !initialCreative) return null;

  const handleApproveWithEdits = () => {
    const updatedCopy: CampaignCopy = {
      ...initialCopy,
      linkedin: { ...initialCopy.linkedin, body: linkedinBody },
      instagram: { ...initialCopy.instagram, caption: instagramCaption },
      email: { ...initialCopy.email, subject: emailSubject, body: emailBody, cta: emailCta },
    };

    const updatedCreative: CreativeSpec = {
      ...initialCreative,
      headline,
      concept,
      imageConcept,
    };

    onApprove(updatedCopy, updatedCreative);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-lg font-semibold text-slate-100">
              Human Reviewer Approval Checkpoint
            </h2>
            <Badge tone="amber">
              Paused for Feedback
            </Badge>
          </div>
          {verdict && (
            <Badge tone={verdict.approved ? "green" : "amber"}>
              Guardian Verdict: {verdict.approved ? "Approved" : "Flagged Issues"}
            </Badge>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab("copy")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "copy"
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📝 Copywriting Drafts
          </button>
          <button
            onClick={() => setActiveTab("creative")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "creative"
                ? "border-purple-400 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🎨 Creative Direction
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "feedback"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            💬 Request AI Rewrite
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* COPY TAB */}
          {activeTab === "copy" && (
            <div className="space-y-6">
              <p className="text-xs text-slate-400">
                You can review or directly edit any channel copy below before approving.
              </p>

              <div>
                <label className="block text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2">
                  LinkedIn Post Body
                </label>
                <textarea
                  rows={4}
                  value={linkedinBody}
                  onChange={(e) => setLinkedinBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-400 uppercase tracking-wider mb-2">
                  Instagram Caption
                </label>
                <textarea
                  rows={3}
                  value={instagramCaption}
                  onChange={(e) => setInstagramCaption(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                    Email CTA Button
                  </label>
                  <input
                    type="text"
                    value={emailCta}
                    onChange={(e) => setEmailCta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                  Email Body
                </label>
                <textarea
                  rows={3}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* CREATIVE TAB */}
          {activeTab === "creative" && (
            <div className="space-y-6">
              <p className="text-xs text-slate-400">
                Inspect and tweak the creative concept specs generated by the Creative Director.
              </p>

              <div>
                <label className="block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                  Visual Headline
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                  Creative Concept
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                  Fal.ai Image Generation Prompt
                </label>
                <textarea
                  rows={3}
                  value={imageConcept}
                  onChange={(e) => setImageConcept(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Color Palette Display */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Brand Color Palette
                </label>
                <div className="flex flex-wrap gap-3">
                  {initialCreative.palette.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c.hex }} />
                      <span className="text-xs font-mono text-slate-300">{c.hex}</span>
                      <span className="text-[11px] text-slate-500">({c.name})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FEEDBACK TAB */}
          {activeTab === "feedback" && (
            <div className="space-y-4">
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-amber-300 mb-1">
                  💬 Provide Custom Human Instructions for AI Rewrite
                </h4>
                <p className="text-xs text-amber-200/70">
                  Type your instructions below. Clicking "Request Rewrite" will trigger the Copywriter & Creative Director agents to re-generate content incorporating your explicit guidance.
                </p>
              </div>

              <textarea
                rows={5}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g. Make the LinkedIn post more casual, lead with the festival discount, and change the imagery prompt to feature Dashain festive decorations."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
              />

              <Button
                onClick={() => onRewrite(feedbackText)}
                disabled={!feedbackText.trim() || isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
              >
                {isSubmitting ? "Rewriting with AI..." : "🔄 Send Feedback & Trigger AI Rewrite"}
              </Button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("feedback")}
            className="text-xs text-amber-400 hover:underline"
          >
            Want the AI to rewrite this instead? Click here to add feedback.
          </button>

          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleApproveWithEdits}
              disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-6"
            >
              {isSubmitting ? "Processing..." : "✅ Approve & Finish Run"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
