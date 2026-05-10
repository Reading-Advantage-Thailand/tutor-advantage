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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { getNotificationsSummary } from "@/app/dashboard/actions";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ภาพรวม" },
  { href: "/dashboard/classes", icon: BookOpen, label: "คลาสเรียน" },
  { href: "/dashboard/chat", icon: MessageSquare, label: "ข้อความ" },
  { href: "/dashboard/earnings", icon: BarChart2, label: "รายได้" },
  { href: "/dashboard/performance", icon: Award, label: "ผลงาน" },
  { href: "/dashboard/settings", icon: Settings, label: "ตั้งค่า" },
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
  const prevUnreadRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const pollNotifications = async () => {
      try {
        const data = await getNotificationsSummary();
        setNotifications(data);
      } catch (error) {
        // Fail silently
      }
    };

    const timer = setInterval(pollNotifications, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-background/80 backdrop-blur-md border-t border-border pb-safe pt-2 px-2 lg:hidden">
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
            className={cn(
              "flex flex-col items-center justify-center w-full py-1 text-xs font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative mb-1">
              <div
                className={cn(
                  "p-1 rounded-full transition-colors",
                  active ? "bg-primary/10" : "bg-transparent"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              
              {/* Badges for Notifications */}
              {item.href === "/dashboard/chat" && notifications?.unreadChat ? (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold px-1 rounded-full border-2 border-background min-w-[16px] flex items-center justify-center">
                  {notifications.unreadChat}
                </span>
              ) : null}
              {item.href === "/dashboard/classes" && notifications?.availableAuctions ? (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold px-1 rounded-full border-2 border-background min-w-[16px] flex items-center justify-center">
                  {notifications.availableAuctions}
                </span>
              ) : null}
            </div>
            <span className="scale-90 origin-bottom">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
