"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminRole } from "@/lib/routes";
import type { AppEnvironment } from "@/lib/security";

/** Signed-in admin, resolved from the verified JWT by the root layout (server). */
export interface AdminShellUser {
  userId: string;
  role: AdminRole;
  email: string | null;
  name: string | null;
  picture: string | null;
}

interface ShellContextValue {
  user: AdminShellUser | null;
  environment: AppEnvironment;
  devRoutes: boolean;
  /** Title registered by the current page's <PageHeader> (mobile app bar). */
  title: string | null;
  setTitle: (title: string | null) => void;
  /** Back target registered by the current page. */
  backHref: string | null;
  setBackHref: (href: string | null) => void;
}

const ShellContext = createContext<ShellContextValue>({
  user: null,
  environment: "development",
  devRoutes: false,
  title: null,
  setTitle: () => {},
  backHref: null,
  setBackHref: () => {},
});

export function ShellProvider({
  user,
  environment,
  devRoutes,
  children,
}: {
  user: AdminShellUser | null;
  environment: AppEnvironment;
  devRoutes: boolean;
  children: ReactNode;
}) {
  const [title, setTitle] = useState<string | null>(null);
  const [backHref, setBackHref] = useState<string | null>(null);
  const value = useMemo(
    () => ({ user, environment, devRoutes, title, setTitle, backHref, setBackHref }),
    [user, environment, devRoutes, title, backHref],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}

/**
 * The signed-in admin (verified server-side from the JWT, not from client
 * cookies). Use `userId` as the first segment of every useCachedResource key
 * and `role` to hide actions the backend would refuse. Null on /login.
 */
export function useAdminSession(): AdminShellUser | null {
  return useContext(ShellContext).user;
}

/** Shorthand: does the signed-in admin have one of these roles? */
export function useHasRole(...roles: AdminRole[]): boolean {
  const user = useAdminSession();
  return Boolean(user && roles.includes(user.role));
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
