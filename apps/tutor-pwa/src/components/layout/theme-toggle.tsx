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
      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${className || "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
