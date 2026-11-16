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

/** Icon button that flips light ↔ dark (login/legal pages, lesson bar). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      id="btn-theme-toggle"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t("app.toggleTheme")}
      aria-pressed={mounted ? isDark : undefined}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-(--radius-ctl) text-fg-muted transition-colors hover:bg-press hover:text-fg pointer-coarse:size-11",
        className,
      )}
    >
      {mounted ? isDark ? <Sun aria-hidden="true" className="size-[18px]" /> : <Moon aria-hidden="true" className="size-[18px]" /> : <span className="size-[18px]" />}
    </button>
  );
}
