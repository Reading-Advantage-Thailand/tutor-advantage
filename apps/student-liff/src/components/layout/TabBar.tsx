"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Activity, BookOpen, Home, User, type LucideIcon } from "lucide-react";
import { getActiveTab, type TabRoot } from "@/components/mobile/navigation";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TabItem {
  href: TabRoot;
  label: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { href: "/dashboard", label: t("app.navHome"), icon: Home },
  { href: "/classes", label: t("app.navClasses"), icon: BookOpen },
  { href: "/progress", label: t("app.navProgress"), icon: Activity },
  { href: "/profile", label: t("app.navProfile"), icon: User },
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
 * Presentational tab bar (Material-3 style active pill behind the icon).
 * Used by <TabBar>; exported for the dev UI kit preview.
 */
export function TabBarNav({ activeHref, onSelect, preview = false, className }: TabBarNavProps) {
  return (
    <nav
      aria-label={t("common.tabBarAria")}
      className={cn(
        preview
          ? "relative flex h-[var(--tabbar-h)] border-t border-hairline bg-surface"
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
              "group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pb-0.5 select-none focus-visible:outline-offset-[-4px]",
              active ? "text-brand-fg" : "text-fg-muted",
            )}
          >
            <span className="relative flex h-8 w-14 items-center justify-center">
              <span
                aria-hidden="true"
                className={cn(
                  // Tailwind v4 scale-x-* sets the `scale` property (not `transform`).
                  "absolute inset-0 rounded-full transition-[opacity,scale,background-color] duration-150 ease-out",
                  active
                    ? "scale-x-100 bg-brand-soft opacity-100"
                    : "scale-x-50 bg-press opacity-0 group-active:scale-x-100 group-active:opacity-100",
                )}
              />
              <Icon aria-hidden="true" className="relative size-6" strokeWidth={active ? 2.4 : 2} />
            </span>
            {/* line-height 1 without overflow clipping so Thai tone marks are never cut */}
            <span className={cn("px-1 text-[11.5px] leading-none whitespace-nowrap", active ? "font-bold" : "font-medium")}>
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
