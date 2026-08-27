"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The one playful component: a chunky pressable button with a solid bottom
 * edge that collapses on click. Everything else in the UI stays flat.
 */
export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "quiet";
  size?: "sm" | "md";
  title?: string;
  className?: string;
}) {
  const variants = {
    primary: "bg-blue text-white shadow-[0_4px_0_0_var(--blue-deep)]",
    secondary: "bg-card text-ink border border-line-strong shadow-[0_4px_0_0_var(--line-strong)]",
    quiet: "bg-transparent text-ink-soft hover:text-ink",
  };
  const sizes = { sm: "px-4 py-2 text-[13px]", md: "px-5 py-3 text-[15px]" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`duo-btn ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  meta,
  action,
  children,
  bodyClassName = "",
  className = "",
}: {
  title?: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col overflow-hidden ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-[15px]">{title}</h2>
            {meta ? <span className="text-xs text-ink-faint tabular">{meta}</span> : null}
          </div>
          {action}
        </header>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber";
}) {
  const tones = {
    neutral: "bg-canvas text-ink-soft border-line",
    blue: "bg-blue-soft text-blue border-blue/20",
    green: "bg-green-soft text-green border-green/20",
    amber: "bg-amber-soft text-amber border-amber/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fade-up card relative flex max-h-[88vh] w-full max-w-3xl flex-col shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg">{title}</h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
