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

/** Optional "create" action shown as a "+" icon button in the phone app bar. */
export interface AppBarAction {
  href: string;
  /** Thai accessible name, e.g. "สร้างคลาสใหม่". */
  label: string;
}

interface ShellContextValue {
  user: ShellUser | null;
  /** Title registered by the current page's <PageHeader> (mobile app bar). */
  title: string | null;
  setTitle: (title: string | null) => void;
  /** Back target registered by the current page (overrides the path parent). */
  backHref: string | null;
  setBackHref: (href: string | null) => void;
  /** "+" action registered by the current page (phone app bar). */
  appBarAction: AppBarAction | null;
  setAppBarAction: (action: AppBarAction | null) => void;
}

const ShellContext = createContext<ShellContextValue>({
  user: null,
  title: null,
  setTitle: () => {},
  backHref: null,
  setBackHref: () => {},
  appBarAction: null,
  setAppBarAction: () => {},
});

export function ShellProvider({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [backHref, setBackHref] = useState<string | null>(null);
  const [appBarAction, setAppBarAction] = useState<AppBarAction | null>(null);
  const value = useMemo(
    () => ({ user, title, setTitle, backHref, setBackHref, appBarAction, setAppBarAction }),
    [user, title, backHref, appBarAction],
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

/** Register a "+" create action for the phone app bar (cleared on unmount). */
export function useAppBarAction(action: AppBarAction | null | undefined) {
  const { setAppBarAction } = useContext(ShellContext);
  const href = action?.href;
  const label = action?.label;
  useEffect(() => {
    if (!href || !label) return;
    setAppBarAction({ href, label });
    return () => setAppBarAction(null);
  }, [href, label, setAppBarAction]);
}

/** Renders nothing; registers the mobile app-bar title/back target/"+" action (for server components). */
export function ShellTitle({
  title,
  backHref,
  action,
}: {
  title?: string | null;
  backHref?: string | null;
  action?: AppBarAction | null;
}) {
  useShellTitle(title, backHref);
  useAppBarAction(action);
  return null;
}
