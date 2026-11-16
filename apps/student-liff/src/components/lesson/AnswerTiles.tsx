import { Check } from "lucide-react";
import type { MouseEventHandler } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * Live-lesson answer tiles A–D (components.md §6.1, tokens.md §8.2). One shared
 * definition with the tutor presenter (OPTION_STYLES): the same --answer-*
 * tokens, A berry · B ocean · C sunshine · D deep violet, each with a shape
 * (triangle, diamond, circle, square) and its letter. Tile colour never says
 * right or wrong: feedback is the result banner (icon + words). The six games
 * must not import this. Server-compatible.
 */

export type AnswerLetter = "A" | "B" | "C" | "D";

export const ANSWER_LETTERS: readonly AnswerLetter[] = ["A", "B", "C", "D"];

/** Token-based classes per option (fill, letter colour, ledge) for custom layouts. */
export const ANSWER_OPTIONS: ReadonlyArray<{
  label: AnswerLetter;
  /** Fill + letter colour utilities. */
  bg: string;
  /** Edge colour utility (ledge / boundary). */
  edge: string;
  shape: "triangle" | "diamond" | "circle" | "square";
}> = [
  { label: "A", bg: "bg-answer-a text-on-answer-a", edge: "text-answer-a-edge", shape: "triangle" },
  { label: "B", bg: "bg-answer-b text-on-answer-b", edge: "text-answer-b-edge", shape: "diamond" },
  { label: "C", bg: "bg-answer-c text-on-answer-c", edge: "text-answer-c-edge", shape: "circle" },
  { label: "D", bg: "bg-answer-d text-on-answer-d", edge: "text-answer-d-edge", shape: "square" },
];

/** True for the four MCQ letters (case-insensitive, trimmed). */
export function isAnswerLetter(value: unknown): value is AnswerLetter {
  return typeof value === "string" && /^[A-D]$/.test(value.trim().toUpperCase());
}

function normalise(letter: string): AnswerLetter {
  const upper = letter.trim().toUpperCase();
  return (isAnswerLetter(upper) ? upper : "A") as AnswerLetter;
}

/** The non-colour cue of each option, drawn in the tile's letter colour. */
export function AnswerShape({ letter, className }: { letter: AnswerLetter | string; className?: string }) {
  const shape = ANSWER_OPTIONS[ANSWER_LETTERS.indexOf(normalise(letter))].shape;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("answer-shape", className)}>
      {shape === "triangle" ? (
        <path d="M12 3.5 22 20.5H2Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      ) : shape === "diamond" ? (
        <path d="M12 2 22 12 12 22 2 12Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      ) : shape === "circle" ? (
        <circle cx="12" cy="12" r="10" fill="currentColor" />
      ) : (
        <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" />
      )}
    </svg>
  );
}

export interface AnswerTileProps {
  letter: AnswerLetter | string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * idle (tappable, ledge) · chosen (submitted: keeps its colour, white inner
   * ring + check badge) · dimmed (another tile was chosen, or read-only: .45,
   * no ledge). chosen/dimmed are aria-disabled.
   */
  state?: "idle" | "chosen" | "dimmed";
  /** Accessible name; defaults to "คำตอบ A". */
  label?: string;
  className?: string;
}

/**
 * One phone answer tile: min-height 120, radius 24, letter in Kodchasan 700 64,
 * shape 26px top-left, 6px ledge in the option's edge colour. Letters only on
 * the phone (the class reads the options on the teacher's screen).
 */
export function AnswerTile({ letter, onClick, state = "idle", label, className }: AnswerTileProps) {
  const value = normalise(letter);
  const locked = state !== "idle";
  return (
    <button
      type="button"
      data-answer={value.toLowerCase()}
      data-state={state}
      aria-label={label ?? `${t("articleReader.answerPrefix")} ${value}`}
      aria-disabled={locked || undefined}
      aria-pressed={state === "chosen" ? true : undefined}
      onClick={locked ? undefined : onClick}
      className={cn("answer-tile", className)}
    >
      <AnswerShape letter={value} />
      <span aria-hidden="true">{value}</span>
      {state === "chosen" ? (
        <span className="answer-check" aria-hidden="true">
          <Check className="size-5" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

/** 44px mini tile (answer echo, wrong-answer banner): the option colour, shape and letter. Decorative. */
export function AnswerMiniTile({ letter, className }: { letter: AnswerLetter | string; className?: string }) {
  const value = normalise(letter);
  return (
    <span aria-hidden="true" data-answer={value.toLowerCase()} className={cn("answer-mini", className)}>
      <AnswerShape letter={value} />
      {value}
    </span>
  );
}
