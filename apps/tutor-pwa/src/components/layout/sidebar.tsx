"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  BarChart2,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ภาพรวม" },
  { href: "/dashboard/classes", icon: BookOpen, label: "คลาสเรียน" },
  { href: "/dashboard/earnings", icon: BarChart2, label: "รายได้" },
  { href: "/dashboard/settings", icon: Settings, label: "ตั้งค่า" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full w-64 bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground shrink-0">
          TA
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
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
