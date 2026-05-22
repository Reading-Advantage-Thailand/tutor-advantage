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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: t("app.navOverview") },
  { href: "/dashboard/classes", icon: BookOpen, label: t("app.navClasses") },
  { href: "/dashboard/chat", icon: MessageSquare, label: t("app.navChat") },
  { href: "/dashboard/earnings", icon: BarChart2, label: t("app.navEarnings") },
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

// End audio helper removal

export function BottomNav({ notifications: initialNotifications }: BottomNavProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const pollNotifications = async () => {
      try {
        const response = await fetch("/api/notifications/summary", {
          cache: "no-store",
        });
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

  return (
    <nav
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 flex items-center justify-around rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl bg-white/80 dark:bg-neutral-900/80 py-2 px-3 lg:hidden"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex flex-col items-center justify-center w-full py-2 px-2 rounded-xl text-xs font-medium transition-all duration-200",
              active
                ? "bg-brand-50 dark:bg-brand-900/30 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative mb-1">
              <Icon
                className={cn(
                  "h-5 w-5 transition-all duration-200 group-hover:scale-110",
                  active && "scale-110 text-primary"
                )}
              />

              {/* Badges for Notifications */}
              {item.href === "/dashboard/chat" && notifications?.unreadChat ? (
                <span className="absolute -top-2 -right-2 animate-bounce bg-gradient-to-r from-red-500 to-rose-500 text-white text-[9px] font-bold px-1 rounded-full border-2 border-white dark:border-neutral-900 min-w-[16px] flex items-center justify-center shadow-md">
                  {notifications.unreadChat}
                </span>
              ) : null}
              {item.href === "/dashboard/classes" && notifications?.availableAuctions ? (
                <span className="absolute -top-2 -right-2 animate-bounce bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[9px] font-bold px-1 rounded-full border-2 border-white dark:border-neutral-900 min-w-[16px] flex items-center justify-center shadow-md">
                  {notifications.availableAuctions}
                </span>
              ) : null}
            </div>
            <span
              className={cn(
                "scale-90 origin-bottom transition-all duration-200",
                active ? "font-bold text-primary" : ""
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
