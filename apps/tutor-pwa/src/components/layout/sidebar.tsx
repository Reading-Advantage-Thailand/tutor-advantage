"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  BarChart2,
  Award,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { getNotificationsSummary } from "@/app/dashboard/actions";
import { useState, useEffect, useRef } from "react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ภาพรวม" },
  { href: "/dashboard/classes", icon: BookOpen, label: "คลาสเรียน" },
  { href: "/dashboard/chat", icon: MessageSquare, label: "ข้อความ" },
  { href: "/dashboard/earnings", icon: BarChart2, label: "รายได้" },
  { href: "/dashboard/performance", icon: Award, label: "ผลงาน" },
  { href: "/dashboard/settings", icon: Settings, label: "ตั้งค่า" },
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
        const data = await getNotificationsSummary();
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
    <aside className="flex flex-col h-full w-64 bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 shrink-0 flex items-center justify-center">
          <Image
            src="/icons/icon-192.png"
            alt="Tutor Advantage"
            width={36}
            height={36}
            className="rounded-lg shadow-sm"
          />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-sidebar-foreground leading-none">
            Tutor Advantage
          </p>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5 leading-none">
            ระบบครูผู้สอน
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-2">
          เมนูหลัก
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              
              {/* Badges for Notifications */}
              {item.href === "/dashboard/chat" && notifications?.unreadChat ? (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center justify-center min-w-[20px]">
                  {notifications.unreadChat}
                </span>
              ) : null}
              {item.href === "/dashboard/classes" && notifications?.availableAuctions ? (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center justify-center min-w-[20px]">
                  {notifications.availableAuctions}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-0.5">
        <a
          href="https://line.me/oa"
          target="_blank"
          rel="noopener noreferrer"
          id="nav-help"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          ช่วยเหลือ / LINE OA
        </a>
        <div className="flex items-center gap-1">
          <button
            id="btn-logout"
            onClick={handleLogout}
            className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            ออกจากระบบ
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
