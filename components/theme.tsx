"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "martech-ai.theme";

/**
 * Runs before first paint to stamp the saved preference onto <html>, so the
 * page never flashes light before switching to dark. Injected in layout.tsx.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (pref === 'dark' || pref === 'light') {
      document.documentElement.setAttribute('data-theme', pref);
    }
  } catch (e) {}
})();
`;

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "light",
  setPreference: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/*
 * Both the saved preference and the OS setting are external stores, not React
 * state, so they are read with useSyncExternalStore. That gives a correct
 * server snapshot for hydration without a setState-in-effect round trip.
 */
const listeners = new Set<() => void>();

function subscribePreference(onChange: () => void) {
  listeners.add(onChange);
  // Catches the toggle being used in another tab.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

const serverPreference = (): ThemePreference => "system";

const MEDIA = "(prefers-color-scheme: dark)";

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia(MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const readSystemDark = () => window.matchMedia(MEDIA).matches;
const serverSystemDark = () => false;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    subscribePreference,
    readPreference,
    serverPreference,
  );
  const systemDark = useSyncExternalStore(subscribeSystem, readSystemDark, serverSystemDark);

  const setPreference = useCallback((next: ThemePreference) => {
    const root = document.documentElement;
    try {
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
        root.removeAttribute("data-theme");
      } else {
        localStorage.setItem(STORAGE_KEY, next);
        root.setAttribute("data-theme", next);
      }
    } catch {
      // Ignore storage failures; the attribute still applies for this session.
    }
    listeners.forEach((notify) => notify());
  }, []);

  const resolved: ResolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  const options: { key: ThemePreference; label: string; icon: React.ReactNode }[] = [
    {
      key: "light",
      label: "Light",
      icon: (
        <>
          <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 2.6v1.8M10 15.6v1.8M17.4 10h-1.8M4.4 10H2.6m12.2-5.2-1.3 1.3M6.5 13.5l-1.3 1.3m9.9 0-1.3-1.3M6.5 6.5 5.2 5.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      ),
    },
    {
      key: "dark",
      label: "Dark",
      icon: (
        <path
          d="M15.5 12.4A6 6 0 0 1 7.6 4.5a6.2 6.2 0 1 0 7.9 7.9Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ),
    },
    {
      key: "system",
      label: "System",
      icon: (
        <>
          <rect
            x="3"
            y="4.5"
            width="14"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M7 16.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ),
    },
  ];

  return (
    <div className="flex rounded-lg bg-canvas p-0.5" role="group" aria-label="Colour theme">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setPreference(option.key)}
          title={option.label}
          aria-label={option.label}
          aria-pressed={preference === option.key}
          className={`rounded-md p-1.5 transition-colors ${
            preference === option.key
              ? "bg-card text-ink shadow-sm"
              : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
            {option.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}
