"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  BarChart2,
  GitBranch,
  Award,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useState, useEffect } from "react";

const primaryNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: t("app.navOverview") },
  { href: "/dashboard/classes", icon: BookOpen, label: t("app.navClasses") },
  { href: "/dashboard/chat", icon: MessageSquare, label: t("app.navChat") },
  { href: "/dashboard/earnings", icon: BarChart2, label: t("app.navEarnings") },
];

const secondaryNavItems = [
  { href: "/dashboard/network", icon: GitBranch, label: t("app.navNetwork") },
  { href: "/dashboard/performance", icon: Award, label: t("app.navPerformance") },
  { href: "/dashboard/settings", icon: Settings, label: t("app.navSettings") },
];

interface BottomNavProps {
  notifications?: {
    unreadChat?: number;
    availableAuctions?: number;
  };
}

export function BottomNav({ notifications: initialNotifications }: BottomNavProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const pollNotifications = async () => {
      try {
        const response = await fetch("/api/notifications/summary", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setNotifications(data);
      } catch {
        // Fail silently
      }
    };
    const timer = setInterval(pollNotifications, 10000);
    return () => clearInterval(timer);
  }, []);

  const isSecondaryActive = secondaryNavItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <>
      <nav
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 flex items-center justify-around rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl bg-white/85 dark:bg-neutral-900/85 py-2 px-2 lg:hidden"
        aria-label="Main navigation"
      >
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          const chatBadge = item.href === "/dashboard/chat" && (notifications?.unreadChat ?? 0) > 0;
          const auctionBadge = item.href === "/dashboard/classes" && (notifications?.availableAuctions ?? 0) > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center justify-center transition-all duration-200 rounded-xl shrink-0",
                active
                  ? "gap-1.5 px-3 py-2 bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400"
                  : "p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <div className="relative shrink-0">
                <Icon
                  className={cn(
                    "transition-all duration-200",
                    active ? "h-4 w-4" : "h-5 w-5",
                  )}
                />
                {/* Notification dots */}
                {chatBadge && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white dark:border-neutral-900 shadow-sm">
                    {(notifications?.unreadChat ?? 0) > 9 ? "9+" : notifications?.unreadChat}
                  </span>
                )}
                {auctionBadge && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold rounded-full border-2 border-white dark:border-neutral-900 shadow-sm">
                    {(notifications?.availableAuctions ?? 0) > 9 ? "9+" : notifications?.availableAuctions}
                  </span>
                )}
              </div>
              {active && (
                <span className="text-[11px] font-bold whitespace-nowrap leading-none">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="เพิ่มเติม"
          className={cn(
            "relative flex items-center justify-center transition-all duration-200 rounded-xl shrink-0",
            isSecondaryActive
              ? "gap-1.5 px-3 py-2 bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400"
              : "p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
        >
          <MoreHorizontal className={cn("transition-all duration-200", isSecondaryActive ? "h-4 w-4" : "h-5 w-5")} />
          {isSecondaryActive && (
            <span className="text-[11px] font-bold whitespace-nowrap leading-none">เพิ่มเติม</span>
          )}
        </button>
      </nav>

      {/* More Drawer */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl border-t border-border shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-foreground">เมนูเพิ่มเติม</h3>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="ปิด"
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 border",
                      active
                        ? "bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/20"
                        : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-border",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-[11px] font-bold whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
