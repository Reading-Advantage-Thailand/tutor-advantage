"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Icon button that flips light ↔ dark (top bar, app bar, login/legal pages):
 * 36px (44px under pointer: coarse), radius 8, and an aria-label that names
 * the theme it switches to ("สลับเป็นธีมมืด").
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  const label = !mounted ? t("shell.toggleTheme") : isDark ? t("shell.switchToLight") : t("shell.switchToDark");
  return (
    <button
      id="btn-theme-toggle"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg-muted transition-colors hover:bg-press hover:text-fg pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        className,
      )}
    >
      {mounted ? isDark ? <Sun aria-hidden="true" className="size-[18px]" /> : <Moon aria-hidden="true" className="size-[18px]" /> : <span className="size-[18px]" />}
    </button>
  );
}
