import type { ReactNode } from "react";
import { getLevelTone, levelToneClass } from "@/lib/cefr";
import { cn } from "@/lib/utils";

export interface LevelChipProps {
  /** CEFR level ("A0"…"C1"); picks the colour. Null/unknown → neutral grey. */
  cefr: unknown;
  /** Label; defaults to the level itself. */
  children?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Level-coloured pill: tinted background + solid dot in the level colour,
 * label in text-fg so it stays readable at 12px in both themes. Server-compatible.
 */
export function LevelChip({ cefr, children, size = "sm", className }: LevelChipProps) {
  const tone = levelToneClass[getLevelTone(cefr)];
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full font-bold whitespace-nowrap text-fg",
        size === "sm" ? "h-6 px-2.5 text-xs leading-[1.5]" : "h-[30px] px-3 text-[13px] leading-[1.5]",
        tone.soft,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tone.solid)} />
      <span className="truncate">{children ?? (typeof cefr === "string" ? cefr.trim().toUpperCase() : "")}</span>
    </span>
  );
}
