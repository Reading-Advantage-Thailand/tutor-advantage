"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { clearResourceCache } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { isPublicPath } from "@/lib/routes";
import type { AppEnvironment } from "@/lib/security";
import { AdminSummaryProvider } from "./AdminSummary";
import { SIDEBAR_COOKIE } from "./constants";
import { MobileNav } from "./MobileNav";
import { ShellProvider, type AdminShellUser } from "./ShellContext";
import { SideNav } from "./SideNav";
import { Toaster } from "./Toast";

const DevToolbar = dynamic(() => import("@/components/DevToolbar").then((m) => m.DevToolbar), { ssr: false });

const LAST_ADMIN_KEY = "admin-last-id";

export interface AdminShellProps {
  /** Verified session from the root layout (null on /login and /unauthorized). */
  user: AdminShellUser | null;
  environment: AppEnvironment;
  devRoutes: boolean;
  /** Initial collapsed state from SIDEBAR_COOKIE (server). */
  sidebarCollapsed?: boolean;
  children: ReactNode;
}

/**
 * Responsive admin shell:
 * - ≥1024px: fixed sidebar (248px, collapsible to a 72px rail; cookie)
 * - 768–1023px: sticky app bar + nav drawer
 * - <768px: app bar + bottom tab bar (3 role-aware sections + "เพิ่มเติม" drawer)
 * The document scrolls (no inner scroll container), safe areas are respected,
 * one AdminSummaryProvider polls /v1/admin/overview for badges + overview.
 * Public pages (/login, /unauthorized) render bare.
 */
export function AdminShell({ user, environment, devRoutes, sidebarCollapsed = false, children }: AdminShellProps) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "rail" : "full"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Never show one admin's cached data to another on a shared device.
  useEffect(() => {
    if (!user?.userId) return;
    try {
      const last = localStorage.getItem(LAST_ADMIN_KEY);
      if (last && last !== user.userId) clearResourceCache(undefined, { revalidate: true });
      localStorage.setItem(LAST_ADMIN_KEY, user.userId);
    } catch {
      // storage unavailable: keys are user-scoped anyway
    }
  }, [user?.userId]);

  const bare = !user || isPublicPath(pathname);

  return (
    <ShellProvider user={user} environment={environment} devRoutes={devRoutes}>
      {bare ? (
        <>
          {children}
          <Toaster />
        </>
      ) : (
        <AdminSummaryProvider>
          <div className="app-root" data-sidebar={collapsed ? "rail" : "full"}>
            <a
              href="#main-content"
              className="sr-only z-(--z-toast) rounded-lg bg-surface px-4 py-2 text-sm font-medium text-fg shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              {t("shell.skipToContent")}
            </a>
            <SideNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
            <div className="app-main">
              <MobileNav>
                <main id="main-content" tabIndex={-1} className="app-content outline-none">
                  {children}
                </main>
              </MobileNav>
            </div>
            <Toaster />
            {devRoutes && user.role === "ADMIN" ? <DevToolbar /> : null}
          </div>
        </AdminSummaryProvider>
      )}
    </ShellProvider>
  );
}
