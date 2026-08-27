import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { clashDisplay, satoshi } from "./fonts";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme";

/** Mono is still Geist — it pairs cleanly with Satoshi and reads well at 11px. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarTech AI",
  description: "Agentic AI pipeline for marketing campaign briefs",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${clashDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme before first paint so dark mode never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
