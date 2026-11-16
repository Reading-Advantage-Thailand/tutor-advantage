"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: number;
}

/**
 * 44px round icon toggle between light and dark (components.md §8). Tonal
 * look: card fill, 1.5px clay rim and a 3px clay ledge (it is tappable). The
 * aria-label names the theme it switches to.
 */
export function ThemeToggle({ className = "", size = 22 }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("app.lightMode") : t("app.darkMode")}
      className={cn(
        "theme-toggle-btn inline-flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-clay-rim bg-surface text-fg shadow-[0_3px_0_var(--clay-ledge)] transition-[translate,transform,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]",
        className,
      )}
    >
      <Icon aria-hidden="true" width={size} height={size} strokeWidth={2.1} className={isDark ? "text-accent-fg" : "text-fg-muted"} />
    </button>
  );
}
