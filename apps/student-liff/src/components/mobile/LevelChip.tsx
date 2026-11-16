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
 * Level-coloured pill (components.md §4): the CEFR band's tile colour with its
 * icon colour as text (every pair ≥ 4.6:1) and a 6px dot; text = the band.
 * sm: reading face 600 12 · md: Kodchasan 600 14. Server-compatible.
 */
export function LevelChip({ cefr, children, size = "sm", className }: LevelChipProps) {
  const tone = levelToneClass[getLevelTone(cefr)];
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "h-6 px-2.5 text-xs leading-[1.5]" : "h-8 px-3 font-heading text-sm leading-[1.4]",
        tone.soft,
        tone.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.solid)} />
      <span className="truncate">{children ?? (typeof cefr === "string" ? cefr.trim().toUpperCase() : "")}</span>
    </span>
  );
}
