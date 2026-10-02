"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Signed-in tutor, as resolved by the dashboard layout (server). */
export interface ShellUser {
  tutorId: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: string | null;
}

interface ShellContextValue {
  user: ShellUser | null;
  /** Title registered by the current page's <PageHeader> (mobile app bar). */
  title: string | null;
  setTitle: (title: string | null) => void;
  /** Back target registered by the current page (overrides the path parent). */
  backHref: string | null;
  setBackHref: (href: string | null) => void;
}

const ShellContext = createContext<ShellContextValue>({
  user: null,
  title: null,
  setTitle: () => {},
  backHref: null,
  setBackHref: () => {},
});

export function ShellProvider({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [backHref, setBackHref] = useState<string | null>(null);
  const value = useMemo(
    () => ({ user, title, setTitle, backHref, setBackHref }),
    [user, title, backHref],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}

/**
 * The signed-in tutor (client components under the dashboard layout).
 * Use `tutorId` as the first segment of every useCachedResource key.
 * Returns null outside the app shell (login page, lesson routes).
 */
export function useTutor(): ShellUser | null {
  return useContext(ShellContext).user;
}

/**
 * Register the page title (and optional back target) for the mobile app bar.
 * <PageHeader> calls this for you; use it directly only for custom headers.
 */
export function useShellTitle(title: string | null | undefined, backHref?: string | null) {
  const { setTitle, setBackHref } = useContext(ShellContext);
  useEffect(() => {
    if (!title) return;
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  useEffect(() => {
    if (!backHref) return;
    setBackHref(backHref);
    return () => setBackHref(null);
  }, [backHref, setBackHref]);
}

/** Renders nothing; registers the mobile app-bar title/back target (for server components). */
export function ShellTitle({ title, backHref }: { title?: string | null; backHref?: string | null }) {
  useShellTitle(title, backHref);
  return null;
}
