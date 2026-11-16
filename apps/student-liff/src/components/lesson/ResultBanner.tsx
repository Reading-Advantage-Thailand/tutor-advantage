import { CircleCheck, CircleX, Star } from "lucide-react";
import type { ReactNode } from "react";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AnswerMiniTile, type AnswerLetter } from "./AnswerTiles";

export interface ResultBannerProps {
  /** correct: success card + points · wrong: neutral card (never red for a child's wrong answer). */
  outcome: "correct" | "wrong";
  /**
   * Headline. Write it as no-wrap phrases so Thai breaks between them, e.g.
   * <><span className="whitespace-nowrap">ถูกต้อง!</span> <span className="whitespace-nowrap">ทำได้ดีมาก</span></>.
   */
  title: ReactNode;
  /** Points earned on this question (correct only): the "+120 คะแนน" sunshine chip. */
  points?: number;
  /** One factual line from the data, e.g. "ตอบเร็วเป็นอันดับ 2 ของห้อง". */
  detail?: ReactNode;
  /** Wrong answer: the correct option, shown as a mini tile next to the detail. */
  correctLetter?: AnswerLetter | string;
  /** Show Reedy (cheer when correct, calm when wrong). Default true; one Reedy per screen. */
  mascot?: boolean;
  className?: string;
}

/**
 * Result banner after the reveal (components.md §6.3, bold graft restyled).
 * Correct: success card, circle-check + title in Kodchasan 700 24, the
 * "+N คะแนน" sun chip (the view's one reward group with the score pill) and
 * Reedy cheer 96. Wrong: neutral card, circle-x + title, the correct letter as
 * a mini tile, Reedy calm. Status is icon + words, never colour alone.
 * role="status" aria-live="polite"; enters with pop-in (no scale under reduced
 * motion). Server-compatible.
 */
export function ResultBanner({ outcome, title, points, detail, correctLetter, mascot = true, className }: ResultBannerProps) {
  const correct = outcome === "correct";
  const Icon = correct ? CircleCheck : CircleX;
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "animate-pop-in relative flex items-center gap-2 rounded-[var(--radius-card)] border-[1.5px] py-4 pr-2 pl-[18px]",
        correct
          ? "border-success-border bg-success-bg"
          : "border-clay-rim bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "flex items-start gap-2 font-heading text-2xl leading-[1.3] font-bold",
            correct ? "text-success-fg" : "text-fg",
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn("mt-1 size-7 shrink-0", correct ? "text-success-fg" : "text-fg-muted")}
            strokeWidth={2.6}
          />
          <span className="min-w-0">{title}</span>
        </h2>
        {correct && typeof points === "number" ? (
          <span className="mt-2 mb-1 inline-flex h-[30px] items-center gap-1 rounded-full bg-accent-solid px-2.5 text-[15px] leading-none font-semibold text-on-accent tabular-nums shadow-[inset_0_0_0_1.5px_var(--accent-edge)]">
            <Star aria-hidden="true" className="size-4 fill-current" strokeWidth={1.5} />
            +{points} {t("interactivePlay.pointsUnit")}
          </span>
        ) : null}
        {detail || (!correct && correctLetter) ? (
          <div className="mt-1 flex items-center gap-2.5">
            {!correct && correctLetter ? <AnswerMiniTile letter={correctLetter} /> : null}
            {detail ? <p className="min-w-0 text-[15px] leading-[1.6] text-fg">{detail}</p> : null}
          </div>
        ) : null}
      </div>
      {mascot ? <ReedyMini mood={correct ? "cheer" : "calm"} size="xl" decorative /> : null}
    </section>
  );
}
