import localFont from "next/font/local";

/**
 * Self-hosted rather than loaded from Fontshare's CDN: the demo already depends
 * on three network APIs, and a font that fails to load is a visible failure.
 * Files live in public/fonts and are served from the same origin.
 */

/** Body and UI text. */
export const satoshi = localFont({
  src: [
    { path: "../public/fonts/satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/satoshi-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

/** Display face — headings and numerals only, never body copy. */
export const clashDisplay = localFont({
  src: [
    { path: "../public/fonts/clash-display-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/clash-display-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/clash-display-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-clash",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
