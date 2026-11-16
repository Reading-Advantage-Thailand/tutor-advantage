import type { CSSProperties, ReactNode } from "react";
import { getLevelTone, levelToneClass, normalizeCefr, type CefrTone } from "@/lib/cefr";
import { cn } from "@/lib/utils";

/** Blobs on a CEFR-tone hero: the paper-chip white, so they read on every band colour. */
const TONED_BLOBS = {
  "--hero-blob-a": "var(--hero-chip)",
  "--hero-blob-b": "var(--hero-chip)",
} as CSSProperties;

export interface ToneHeroProps {
  /**
   * CEFR band colour (class detail, lobby: patterns.md S5). Omit for the brand
   * hero (--hero-bg-base: progress, lesson result).
   */
  tone?: CefrTone;
  as?: "section" | "header" | "div";
  children: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}

/**
 * Full-bleed student hero (components.md §3.3): flat colour (no gradient),
 * rounded bottom 32, two decorative blobs from the shared `.hero-surface`
 * class. It sits right under an app bar of the same colour, so the two read
 * as one block (`.hero-under-bar` moves the top-right blob clear of the bar's
 * edge); the card after it overlaps it by 30px (`<HeroOverlap>`). Text on a
 * CEFR tone uses the normal text tokens (every tile colour keeps ≥ 4.5:1 with
 * them). Server-compatible.
 */
export function ToneHero({ tone, as: Tag = "section", children, className, ...rest }: ToneHeroProps) {
  const toned = tone !== undefined;
  return (
    <Tag
      aria-labelledby={rest["aria-labelledby"]}
      className={cn("hero-surface hero-under-bar px-4 pt-1 pb-[50px]", toned && [levelToneClass[tone].soft, "text-fg"], className)}
      style={toned ? TONED_BLOBS : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Content column that follows a <ToneHero>: pulled up 30px over the hero's
 * rounded bottom (its first child must be a card), 16px gutter, 20px gaps.
 * Server-compatible.
 */
export function HeroOverlap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative z-[2] -mt-[30px] flex flex-col gap-5 px-4 pb-6", className)}>{children}</div>;
}

/** Hero tone of a class: the same "A1" fallback as formatLevelLabel, so the colour and the label agree. */
export function classLevelTone(cefr: unknown): CefrTone {
  return getLevelTone(normalizeCefr(cefr) ?? "A1");
}
