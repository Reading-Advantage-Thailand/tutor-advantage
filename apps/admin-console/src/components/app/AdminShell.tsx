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
import { TopBar } from "./TopBar";

const DevToolbar = dynamic(() => import("@/components/DevToolbar").then((m) => m.DevToolbar), { ssr: false });

const LAST_ADMIN_KEY = "admin-last-id";

/**
 * Desktop side nav width. "auto" (no saved choice): the 72px rail at
 * 1024–1279px and the full 248px nav from 1280px, decided in CSS so the
 * server and client markup are the same. "rail" / "full": the admin's own
 * choice from the toggle, remembered in SIDEBAR_COOKIE, at every width.
 */
export type SidebarMode = "auto" | "rail" | "full";

export interface AdminShellProps {
  /** Verified session from the root layout (null on /login and /unauthorized). */
  user: AdminShellUser | null;
  environment: AppEnvironment;
  devRoutes: boolean;
  /** Saved side-nav choice from SIDEBAR_COOKIE (server); "auto" when there is none. */
  sidebarMode?: SidebarMode;
  /** @deprecated Pass `sidebarMode`. true = "rail"; otherwise "auto". */
  sidebarCollapsed?: boolean;
  children: ReactNode;
}

/**
 * Responsive admin shell:
 * - ≥1024px: fixed side nav and a 56px top bar (breadcrumb, theme toggle,
 *   bell). The nav is a 72px rail at 1024–1279px and 248px from 1280px until
 *   the admin picks one with its toggle (SidebarMode, cookie)
 * - 768–1023px: sticky app bar + nav drawer
 * - <768px: app bar + bottom tab bar (3 role-aware sections + "เพิ่มเติม" drawer)
 * The document scrolls (no inner scroll container), safe areas are respected,
 * one AdminSummaryProvider polls /v1/admin/overview for badges + overview.
 * Public pages (/login, /unauthorized) render bare.
 */
export function AdminShell({ user, environment, devRoutes, sidebarMode, sidebarCollapsed = false, children }: AdminShellProps) {
  const pathname = usePathname() ?? "/";
  const [mode, setMode] = useState<SidebarMode>(sidebarMode ?? (sidebarCollapsed ? "rail" : "auto"));

  // The toggle saves an explicit choice, which wins over "auto" at every width.
  const setCollapsed = useCallback((collapsed: boolean) => {
    const next: SidebarMode = collapsed ? "rail" : "full";
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
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
          <div className="app-root" data-sidebar={mode}>
            <a
              href="#main-content"
              className="sr-only z-(--z-toast) rounded-(--radius-ctl) border border-clay-rim bg-surface-elevated px-4 py-2 text-sm font-semibold text-fg shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
            >
              {t("shell.skipToContent")}
            </a>
            <SideNav mode={mode} onCollapsedChange={setCollapsed} />
            <div className="app-main">
              <TopBar />
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
