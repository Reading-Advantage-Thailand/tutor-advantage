"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  BarChart2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ภาพรวม" },
  { href: "/dashboard/classes", icon: BookOpen, label: "คลาสเรียน" },
  { href: "/dashboard/earnings", icon: BarChart2, label: "รายได้" },
  { href: "/dashboard/settings", icon: Settings, label: "ตั้งค่า" },
];

export function BottomNav() {
  const pathname = usePathname();

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
            <div
              className={cn(
                "mb-1 p-1 rounded-full transition-colors",
                active ? "bg-primary/10" : "bg-transparent"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="scale-90 origin-bottom">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
