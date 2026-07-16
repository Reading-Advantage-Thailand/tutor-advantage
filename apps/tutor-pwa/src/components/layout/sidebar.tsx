"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  MessageSquare,
  BarChart2,
  GitBranch,
  Award,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { useState, useEffect, useRef } from "react";
import { t } from "@/lib/i18n";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: t("app.navOverview") },
  { href: "/dashboard/classes", icon: BookOpen, label: t("app.navClasses") },
  { href: "/dashboard/demo", icon: Sparkles, label: t("app.navDemo") },
  { href: "/dashboard/schedule", icon: Calendar, label: t("app.navSchedule") },
  { href: "/dashboard/chat", icon: MessageSquare, label: t("app.navChat") },
  { href: "/dashboard/earnings", icon: BarChart2, label: t("app.navEarnings") },
  { href: "/dashboard/network", icon: GitBranch, label: t("app.navNetwork") },
  { href: "/dashboard/performance", icon: Award, label: t("app.navPerformance") },
  { href: "/dashboard/settings", icon: Settings, label: t("app.navSettings") },
];

interface SidebarProps {
  notifications?: {
    unreadChat?: number;
    availableAuctions?: number;
  };
}



const playNotificationSound = () => {
  try {
    if (typeof window !== "undefined" && localStorage.getItem("app-notif-muted") === "true") return;
    const win = window as any;
    const ctx = win.__globalAudioCtx;
    
    if (!ctx || ctx.state !== "running") return;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.1);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (err) {
    // Silently fail
  }
};

export function Sidebar({ notifications: initialNotifications }: SidebarProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState(initialNotifications);
  const prevUnreadRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  // Play sound if unread chats increase
  useEffect(() => {
    const current = notifications?.unreadChat ?? 0;
    if (prevUnreadRef.current !== undefined && current > prevUnreadRef.current) {
      playNotificationSound();
    }
    prevUnreadRef.current = current;
  }, [notifications?.unreadChat]);

  useEffect(() => {
    const pollNotifications = async () => {
      try {
        const response = await fetch("/api/notifications/summary", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        setNotifications(data);
      } catch (error) {
        console.error("Sidebar notify fail", error);
      }
    };

    // Refresh every 10 seconds
    const intervalId = setInterval(pollNotifications, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(console.error);
    window.location.href = "/";
  };

  return (
    <aside className="flex flex-col h-full w-72 bg-gradient-to-b from-sidebar via-sidebar to-brand-50/5 dark:to-brand-900/5 text-sidebar-foreground border-r border-sidebar-border/50 relative">
      {/* Right edge gradient accent line */}
      <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-brand-400 via-brand-500 to-brand-600 opacity-60" aria-hidden="true" />
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-brand-500 rounded-xl shadow-md shadow-brand-500/40 ring-4 ring-brand-400/20 text-white">
          <Image
            src="/icons/icon-192.png"
            alt="Tutor Advantage"
            width={40}
            height={40}
            className="rounded-xl"
          />
        </div>
        <div className="min-w-0">
          <p className="font-black text-base text-foreground leading-tight tracking-tight">
            Tutor Advantage
          </p>
          <p className="text-xs font-bold text-brand-600 dark:text-brand-400 mt-0.5 uppercase tracking-widest leading-tight">
            Instructor
          </p>
        </div>
      </div>
      {/* Gradient separator */}
      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" aria-hidden="true" />

      {/* Nav */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-4 mt-4 px-4">
          Main Menu
        </p>
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
              id={`nav-${item.href.split("/").pop()}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 relative group",
                active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-foreground hover:translate-x-1",
              )}
            >
              {/* Active left border indicator */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-primary-foreground animate-scale-in"
                  aria-hidden="true"
                />
              )}
              <Icon className={cn("h-5 w-5 shrink-0 transition-transform", active ? "" : "group-hover:scale-110")} />
              <span className="flex-1">{item.label}</span>
              
              {/* Badges for Notifications */}
              {item.href === "/dashboard/chat" && notifications?.unreadChat ? (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center justify-center min-w-[20px] shadow-sm animate-pulse">
                  {notifications.unreadChat}
                </span>
              ) : null}
              {item.href === "/dashboard/classes" && notifications?.availableAuctions ? (
                <span className="bg-amber-500 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center justify-center min-w-[20px] shadow-sm">
                  {notifications.availableAuctions}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-4 space-y-2 mt-auto">
        <div className="backdrop-blur-sm bg-muted/20 rounded-3xl p-3 border border-border/30">
          <a
            href="https://lin.ee/R7Dccj9"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-help"
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold text-foreground bg-background hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/20 hover:shadow-md hover:border-l-2 hover:border-l-brand-500 transition-all duration-200 shadow-sm mb-2 border border-border/50"
          >
            <HelpCircle className="h-5 w-5 shrink-0 text-brand-500" />
            {t("app.contactTeam")}
          </a>
          <div className="flex items-center gap-1.5">
            <button
              id="btn-logout"
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 transition-all duration-200 hover:shadow-sm"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("app.logoutShort")}
            </button>
            <div className="bg-background/80 rounded-2xl p-1 border border-border/30 shadow-sm flex items-center justify-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Forced component refresh for hydration sync

