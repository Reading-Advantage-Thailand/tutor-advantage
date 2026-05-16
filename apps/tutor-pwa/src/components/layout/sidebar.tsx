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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { useState, useEffect, useRef } from "react";
import { t } from "@/lib/i18n";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: t("app.navOverview") },
  { href: "/dashboard/classes", icon: BookOpen, label: t("app.navClasses") },
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

  const handleLogout = () => {
    // Redirect to the server-side logout route which will clear the httpOnly cookie
    window.location.href = "/api/auth/logout";
  };

  return (
    <aside className="flex flex-col h-full w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-brand-500 rounded-xl shadow-md text-white">
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

      {/* Nav */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3 mt-2">
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
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
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
        <div className="bg-muted/30 rounded-3xl p-4 border border-border/50">
          <a
            href="https://lin.ee/zqTz6feg"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-help"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-foreground bg-background hover:bg-brand-50 hover:text-brand-700 transition-colors shadow-sm mb-2 border border-border/50"
          >
            <HelpCircle className="h-5 w-5 shrink-0 text-brand-500" />
            {t("app.contactTeam")}
          </a>
          <div className="flex items-center gap-2">
            <button
              id="btn-logout"
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("app.logoutShort")}
            </button>
            <div className="bg-background rounded-2xl p-1.5 border border-border/50 shadow-sm flex items-center justify-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Forced component refresh for hydration sync

