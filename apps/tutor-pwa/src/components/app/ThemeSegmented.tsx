"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "./Segmented";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

type ThemeValue = "system" | "light" | "dark";

/**
 * 3-state theme picker (ตามระบบ / สว่าง / มืด) for menus and settings.
 * Full width: equal thirds, but a segment never gets narrower than its own
 * icon and word. In the 288px account menu and on a 320px phone a third is
 * narrower than "ตามระบบ", which was cut to "ตาม…"; there the other two
 * segments give up the difference.
 */
export function ThemeSegmented({ className, fullWidth }: { className?: string; fullWidth?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const value = (mounted ? theme : "system") as ThemeValue;
  return (
    <SegmentedControl<ThemeValue>
      aria-label={t("shell.theme")}
      size="sm"
      fullWidth={fullWidth}
      className={cn(fullWidth && "[&>button]:min-w-max", className)}
      value={value === "light" || value === "dark" ? value : "system"}
      onValueChange={(next) => setTheme(next)}
      items={[
        { value: "system", label: t("shell.themeSystem"), icon: Monitor },
        { value: "light", label: t("shell.themeLight"), icon: Sun },
        { value: "dark", label: t("shell.themeDark"), icon: Moon },
      ]}
    />
  );
}
