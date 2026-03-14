"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  BarChart2,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ภาพรวม" },
  { href: "/dashboard/classes", icon: BookOpen, label: "คลาสเรียน" },
  { href: "/dashboard/earnings", icon: BarChart2, label: "รายได้" },
  { href: "/dashboard/settings", icon: Settings, label: "ตั้งค่า" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    document.cookie =
      "tutor_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setOpen(false);
    router.push("/");
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <ThemeToggle className="text-white hover:bg-white/10" />
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                  TA
                </div>
                <span className="font-semibold text-sm">Tutor Advantage</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
              <a
                href="https://line.me/oa"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                ช่วยเหลือ / LINE OA
              </a>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
