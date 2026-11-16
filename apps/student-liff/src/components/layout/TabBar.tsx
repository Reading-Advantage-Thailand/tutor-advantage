"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { BookOpen, CircleUserRound, House, Sprout, type LucideIcon } from "lucide-react";
import { getActiveTab, type TabRoot } from "@/components/mobile/navigation";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TabItem {
  href: TabRoot;
  label: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { href: "/dashboard", label: t("app.navHome"), icon: House },
  { href: "/classes", label: t("app.navClasses"), icon: BookOpen },
  { href: "/progress", label: t("app.navProgress"), icon: Sprout },
  { href: "/profile", label: t("app.navProfile"), icon: CircleUserRound },
];

export interface TabBarNavProps {
  /** Tab drawn as active. */
  activeHref: TabRoot | null;
  onSelect?: (href: TabRoot, event: MouseEvent<HTMLAnchorElement>) => void;
  /** Render in normal flow instead of fixed (UI-kit previews only). */
  preview?: boolean;
  className?: string;
}

/**
 * Presentational tab bar (components.md §9): 76px + safe area, flat (no
 * ledge) with a 1.5px clay rim, 24px top corners and a soft float shadow.
 * Each tab is ≥ 56px tall; the active tab gets a 60×32 soft-jade pill, a
 * heavier icon stroke and aria-current="page" (not colour alone).
 * Used by <TabBar>; exported for the dev UI kit preview.
 */
export function TabBarNav({ activeHref, onSelect, preview = false, className }: TabBarNavProps) {
  return (
    <nav
      aria-label={t("common.tabBarAria")}
      className={cn(
        preview
          ? "relative flex h-[var(--tabbar-h)] rounded-t-3xl border-t-[1.5px] border-clay-rim bg-[var(--surface-nav)] px-2 pt-1.5 pb-2.5 shadow-[var(--shadow-float)]"
          : "tabbar",
        className,
      )}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => onSelect?.(href, event)}
            className={cn(
              "group flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-2xl select-none focus-visible:outline-offset-[-3px]",
              active ? "text-brand-fg" : "text-fg-muted",
            )}
          >
            <span className="relative flex h-8 w-[60px] items-center justify-center">
              <span
                aria-hidden="true"
                className={cn(
                  // Tailwind v4 scale-x-* sets the `scale` property (not `transform`).
                  "absolute inset-0 rounded-full transition-[opacity,scale,background-color] duration-[var(--duration-normal)] ease-[var(--ease-out)]",
                  active
                    ? "scale-x-100 bg-brand-soft opacity-100"
                    : "scale-x-50 bg-press opacity-0 group-active:scale-x-100 group-active:opacity-100",
                )}
              />
              <Icon aria-hidden="true" className="relative size-6" strokeWidth={active ? 2.4 : 2.1} />
            </span>
            <span className={cn("px-1 text-xs leading-[1.4] whitespace-nowrap", active ? "font-semibold" : "font-medium")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function scrollToTop() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/**
 * Persistent bottom tab bar. Mounted ONCE in the root layout (inside
 * .liff-root, after the page) so it never remounts between tabs. Visible only
 * on the exact tab roots /dashboard, /classes, /progress, /profile; hidden on
 * every pushed screen. Renders an in-flow spacer so content is never covered.
 *
 * - Optimistic active state: the tapped tab lights up immediately.
 * - Re-tapping the current tab scrolls the page to the top.
 */
export function TabBar() {
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);
  // Pending tap is tied to the path it was made on, so it expires on its own
  // once the navigation lands (no effect needed).
  const [pending, setPending] = useState<{ href: TabRoot; from: string } | null>(null);

  if (!activeTab) return null;

  const shownActive = pending && pending.from === pathname ? pending.href : activeTab;

  return (
    <>
      <div className="tabbar-spacer" data-tabbar-spacer="" aria-hidden="true" />
      <TabBarNav
        activeHref={shownActive}
        onSelect={(href, event) => {
          if (href === activeTab) {
            event.preventDefault();
            setPending(null);
            scrollToTop();
            return;
          }
          setPending({ href, from: pathname });
        }}
      />
    </>
  );
}
