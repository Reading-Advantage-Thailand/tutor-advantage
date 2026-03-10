"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      id="btn-theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="สลับธีม"
      className={`p-2 rounded-lg transition-colors hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground ${className ?? ""}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
