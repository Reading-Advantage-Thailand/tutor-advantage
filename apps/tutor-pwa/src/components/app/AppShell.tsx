"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { clearResourceCache } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { AppBar, TabBar } from "./MobileNav";
import { NotificationsProvider, type NotificationsSummary } from "./Notifications";
import { ShellProvider, type ShellUser } from "./ShellContext";
import { SideNav } from "./SideNav";
import { Toaster } from "./Toast";

import { SIDEBAR_COOKIE } from "./constants";
const LAST_TUTOR_KEY = "tutor-last-id";

export interface AppShellProps {
  user: ShellUser | null;
  initialNotifications?: Partial<NotificationsSummary> | null;
  /** Initial collapsed state from the SIDEBAR_COOKIE (server). */
  sidebarCollapsed?: boolean;
  children: ReactNode;
}

/**
 * Responsive app shell for /dashboard/*:
 * - ≥1280px: full sidebar (collapsible to a rail, remembered in a cookie)
 * - 768–1279px: icon rail with labels
 * - <768px: sticky top AppBar (title/back/bell) + bottom TabBar + "more" sheet
 * The document scrolls (no inner scroll container), safe areas are respected,
 * and one NotificationsProvider polls the summary for the whole shell.
 */
export function AppShell({ user, initialNotifications, sidebarCollapsed = false, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "rail" : "full"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Never show one tutor's cached client data to another on a shared device.
  useEffect(() => {
    if (!user?.tutorId) return;
    try {
      const last = localStorage.getItem(LAST_TUTOR_KEY);
      if (last && last !== user.tutorId) clearResourceCache(undefined, { revalidate: true });
      localStorage.setItem(LAST_TUTOR_KEY, user.tutorId);
    } catch {
      // storage unavailable: keys are tutor-scoped anyway
    }
  }, [user?.tutorId]);

  return (
    <ShellProvider user={user}>
      <NotificationsProvider initial={initialNotifications}>
        <div className="app-root" data-sidebar={collapsed ? "rail" : "full"}>
          <a
            href="#main-content"
            className="sr-only z-(--z-toast) rounded-lg bg-surface px-4 py-2 text-sm font-medium text-fg shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {t("shell.skipToContent")}
          </a>
          <SideNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          <div className="app-main">
            <AppBar />
            <main id="main-content" tabIndex={-1} className="app-content outline-none">
              {children}
            </main>
            <TabBar />
          </div>
          <Toaster />
        </div>
      </NotificationsProvider>
    </ShellProvider>
  );
}
