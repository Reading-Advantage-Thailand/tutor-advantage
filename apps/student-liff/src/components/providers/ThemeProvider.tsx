"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Contract shared with the blocking <head> script in app/layout.tsx: it reads
 * this key ("light" | "dark" | "system", missing = "system") and adds the
 * "dark" class to <html> before first paint.
 */
const STORAGE_KEY = "ta-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeSnapshot {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
}

/** What the server renders (and what hydration starts from). */
const SERVER_SNAPSHOT: ThemeSnapshot = { theme: "system", resolvedTheme: "light" };

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

/** Toggle the class the CSS keys off (globals.css also sets color-scheme per theme). */
function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// ── Client-side theme store ────────────────────────────────────────────────
// Initialised lazily from what the pre-paint script already applied, so the
// first client snapshot matches the screen (no light→dark flash, no re-apply).

let clientSnapshot: ThemeSnapshot | null = null;
const listeners = new Set<() => void>();

function getClientSnapshot(): ThemeSnapshot {
  if (!clientSnapshot) {
    clientSnapshot = {
      theme: readStoredTheme(),
      resolvedTheme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    };
  }
  return clientSnapshot;
}

function getServerSnapshot(): ThemeSnapshot {
  return SERVER_SNAPSHOT;
}

function setSnapshot(next: ThemeSnapshot) {
  const current = getClientSnapshot();
  if (current.theme === next.theme && current.resolvedTheme === next.resolvedTheme) return;
  clientSnapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  const onSystemChange = () => {
    const current = getClientSnapshot();
    if (current.theme !== "system") return;
    const resolved = getSystemTheme();
    applyTheme(resolved);
    setSnapshot({ theme: "system", resolvedTheme: resolved });
  };
  // Keep several tabs/webviews in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const theme = isTheme(event.newValue) ? event.newValue : "system";
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    setSnapshot({ theme, resolvedTheme: resolved });
  };

  media?.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme } = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  // Safety net when the pre-paint script did not run (or disagrees): make the
  // DOM match the stored preference. A no-op in the normal case.
  useEffect(() => {
    const current = getClientSnapshot();
    const expected = resolveTheme(current.theme);
    if (expected !== current.resolvedTheme) {
      applyTheme(expected);
      setSnapshot({ theme: current.theme, resolvedTheme: expected });
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Storage blocked (private mode): still switch for this page view.
    }
    const resolved = resolveTheme(newTheme);
    applyTheme(resolved);
    setSnapshot({ theme: newTheme, resolvedTheme: resolved });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getClientSnapshot().resolvedTheme === "dark" ? "light" : "dark");
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
