"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu, MoreHorizontal } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useWorkQueues } from "./AdminSummary";
import { CountBadge } from "./CountBadge";
import { EnvBadge } from "./EnvBadge";
import { getBackHref, getDefaultTitle, isNavItemActive, tabItemsFor } from "./navigation";
import { useShell } from "./ShellContext";
import { ThemeToggle } from "./ThemeToggle";

const NavDrawerImpl = dynamic(() => import("./NavDrawerImpl").then((m) => m.NavDrawerImpl), { ssr: false });

function useNavDrawer() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);
  return {
    pathname,
    open,
    armed,
    openDrawer: () => {
      setArmed(true);
      setOpen(true);
    },
    setOpen,
  };
}

/**
 * Phones + tablets (<1024px): sticky top bar with the menu button (opens
 * the nav drawer), back button on nested pages, page title, environment pill
 * and theme toggle; plus the bottom tab bar on phones (<768px).
 * Wraps the page <main> so the tab-bar spacer comes after the content.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const drawer = useNavDrawer();
  const { title, backHref: registeredBack, environment, user, devRoutes } = useShell();
  const queues = useWorkQueues();
  const backHref = registeredBack ?? getBackHref(drawer.pathname);
  const barTitle = title ?? getDefaultTitle(drawer.pathname);
  const tabs = tabItemsFor(user?.role, devRoutes);
  const drawerCount = queues.settlements + queues.adjustments + queues.exceptions + (user?.role === "ADMIN" ? queues.verifications : 0);
  const tabActive = tabs.some((item) => isNavItemActive(item, drawer.pathname));

  return (
    <>
      <header className="app-appbar">
        <div className="flex h-(--appbar-h) items-center gap-1 px-2 md:px-4">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={t("shell.back")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg hover:bg-press"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={drawer.openDrawer}
              // The pending count is part of the name: an aria-label replaces the
              // button's content, so a hidden span inside it would never be read.
              aria-label={
                drawerCount > 0
                  ? `${t("shell.openMenu")} ${t("shell.itemsCount", { count: drawerCount })}`
                  : t("shell.openMenu")
              }
              aria-haspopup="dialog"
              aria-expanded={drawer.open}
              className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg hover:bg-press"
            >
              <Menu aria-hidden="true" className="size-[22px]" />
              {drawerCount > 0 ? (
                <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger-solid ring-2 ring-surface-nav" />
              ) : null}
            </button>
          )}
          <p className="min-w-0 flex-1 truncate pl-1 text-[1.0625rem] leading-[1.35] font-semibold text-fg">{barTitle}</p>
          <EnvBadge environment={environment} className="max-sm:hidden" />
          <ThemeToggle className="size-11" />
          {backHref ? (
            <button
              type="button"
              onClick={drawer.openDrawer}
              aria-label={t("shell.openMenu")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg-muted hover:bg-press hover:text-fg md:hidden"
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>
      </header>

      {children}

      {tabs.length > 0 ? (
        <>
          <div className="app-tabbar-spacer" aria-hidden="true" />
          <nav className="app-tabbar" style={{ "--tab-count": tabs.length + 1 } as CSSProperties} aria-label={t("shell.mainNavigation")}>
            {tabs.map((item) => {
              const active = isNavItemActive(item, drawer.pathname);
              const Icon = item.icon;
              const count = item.badge ? queues[item.badge] : 0;
              return (
                <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <span className={pillClass(active)}>
                    <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                    <CountBadge aria-hidden count={count} className="absolute -top-1.5 right-0 h-5 min-w-5 px-1.5 ring-2 ring-surface-nav" />
                  </span>
                  <span className="max-w-full truncate px-0.5">{item.label}</span>
                  {count > 0 ? <span className="sr-only">{` ${t("shell.itemsCount", { count })}`}</span> : null}
                </Link>
              );
            })}
            <button type="button" onClick={drawer.openDrawer} aria-haspopup="dialog" aria-expanded={drawer.open} className={tabClass(!tabActive && drawer.pathname !== "/")}>
              <span className={pillClass(!tabActive && drawer.pathname !== "/")}>
                <MoreHorizontal aria-hidden="true" className="size-[22px]" />
              </span>
              <span>{t("shell.navMore")}</span>
            </button>
          </nav>
        </>
      ) : null}

      {drawer.armed ? <NavDrawerImpl open={drawer.open} onOpenChange={drawer.setOpen} pathname={drawer.pathname} /> : null}
    </>
  );
}

function tabClass(active: boolean) {
  return cn(
    "group/tab flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-xs leading-[1.4] font-semibold transition-colors",
    active ? "text-brand-fg" : "text-fg-muted",
  );
}

/** The pill behind a tab's icon: jade when the tab is current, the press tint while another tab is held down. */
function pillClass(active: boolean) {
  return cn(
    "relative flex h-[30px] w-14 items-center justify-center rounded-full transition-colors",
    active ? "bg-brand-soft" : "group-active/tab:bg-press",
  );
}
