"use client";

/**
 * Presenter phase bar (patterns.md T10, components.md §6.2 / §7): a 48px
 * phase tile, "เฟส 7 / 18 · คาบ 2 …", the phase name (the page's h1,
 * Kodchasan 600, 20 → 24 on the stage) and the 18-segment journey grouped by
 * period: done --brand-vivid, current --brand-solid with a page-colour gap
 * and a ring, upcoming --track. Each step carries "เฟส n · name" for screen
 * readers and aria-current="step" on the current one.
 *
 * In free-explore rehearsal every step is a button that jumps to that phase:
 * a thin segment with a 28px-tall hit row under a fine pointer, and a 44px
 * numbered step under a coarse pointer (touch), in a row that scrolls
 * sideways on phones and keeps the current step in view.
 */
import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownUp,
  BookOpen,
  CircleHelp,
  Gamepad2,
  Highlighter,
  Layers,
  Lightbulb,
  MessageCircleQuestion,
  MessagesSquare,
  MousePointerClick,
  NotebookPen,
  PenLine,
  Quote,
  Rocket,
  ScanSearch,
  SpellCheck,
  TextCursorInput,
  Trophy,
} from "lucide-react";
import { Chip, IconTile, type TileTone } from "@/components/app";
import { LESSON_PHASE, PHASE_GROUPS, PHASE_NAMES, TOTAL_LESSON_PHASES } from "@/lib/lessonPhases";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PERIOD_LABEL_KEYS = [
  "lesson.interactive.period1",
  "lesson.interactive.period2",
  "lesson.interactive.period3",
  "lesson.interactive.period4",
  "lesson.interactive.wrapUp",
] as const;

/** One tone per period (decorative tile tones, never sunshine). */
const PERIOD_TONES: TileTone[] = ["teal", "blue", "purple", "orange", "amber"];

const PHASE_ICONS: Record<number, LucideIcon> = {
  [LESSON_PHASE.LAUNCH]: Rocket,
  [LESSON_PHASE.FLASHCARDS]: Layers,
  [LESSON_PHASE.READ_ARTICLE]: BookOpen,
  [LESSON_PHASE.VOCABULARY_CONTEXT]: Highlighter,
  [LESSON_PHASE.DEEP_READING]: ScanSearch,
  [LESSON_PHASE.KEY_SENTENCES]: Quote,
  [LESSON_PHASE.COMPREHENSION]: CircleHelp,
  [LESSON_PHASE.GUIDED_RESPONSE]: PenLine,
  [LESSON_PHASE.VOCABULARY_PRACTICE]: SpellCheck,
  [LESSON_PHASE.VOCABULARY_GAME]: Gamepad2,
  [LESSON_PHASE.SENTENCE_PRACTICE]: TextCursorInput,
  [LESSON_PHASE.SENTENCE_ORDER]: ArrowDownUp,
  [LESSON_PHASE.GUIDED_WRITING]: NotebookPen,
  [LESSON_PHASE.SENTENCE_GAME]: Gamepad2,
  [LESSON_PHASE.LANGUAGE_QUESTIONS]: MessageCircleQuestion,
  [LESSON_PHASE.REFLECTION]: Lightbulb,
  [LESSON_PHASE.PAIR_CONVERSATION]: MessagesSquare,
  [LESSON_PHASE.WRAP_UP]: Trophy,
};

export function getPhaseGroupLabel(phase: number): string | null {
  const index = PHASE_GROUPS.findIndex((group) => group.phases.includes(phase));
  return index >= 0 ? t(PERIOD_LABEL_KEYS[index] ?? PERIOD_LABEL_KEYS[0]) : null;
}

export function getPhaseName(phase: number): string {
  return PHASE_NAMES[phase] ?? `${t("lesson.live.phaseWord")} ${phase}`;
}

/** Lucide icon of a phase (the phase tile). */
export function getPhaseIcon(phase: number): LucideIcon {
  return PHASE_ICONS[phase] ?? BookOpen;
}

/** Tile tone of a phase: its period's tone. */
export function getPhaseTone(phase: number): TileTone {
  const index = PHASE_GROUPS.findIndex((group) => group.phases.includes(phase));
  return PERIOD_TONES[index] ?? "brand";
}

export interface PhaseProgressProps {
  currentPhase: number;
  /** Free-explore rehearsal: steps are clickable. */
  interactive?: boolean;
  disabled?: boolean;
  onSelectPhase?: (phase: number) => void;
  className?: string;
}

/** Segment fill: done / current (gap + ring) / upcoming. */
function segmentClass(isCurrent: boolean, isPast: boolean) {
  return cn(
    "block h-2 w-full rounded-full transition-colors duration-(--duration-normal) xl:h-3",
    isCurrent
      ? "bg-brand-solid shadow-[0_0_0_2px_var(--surface-bg),0_0_0_3.5px_var(--brand-solid)]"
      : isPast
        ? "bg-brand-vivid"
        : "bg-track",
  );
}

/** Touch step (44px numbered square). */
function touchStepClass(isCurrent: boolean, isPast: boolean) {
  return cn(
    "hidden size-11 items-center justify-center rounded-(--radius-ctl) text-sm font-semibold tabular-nums pointer-coarse:inline-flex",
    isCurrent
      ? "bg-brand-solid text-on-brand"
      : isPast
        ? "bg-brand-soft text-brand-soft-fg"
        : "bg-surface-muted text-fg-muted shadow-[inset_0_0_0_1px_var(--clay-rim)]",
  );
}

export function PhaseProgress({ currentPhase, interactive = false, disabled = false, onSelectPhase, className }: PhaseProgressProps) {
  const listRef = React.useRef<HTMLOListElement>(null);

  // Touch rehearsal on a phone: keep the current numbered step in view (the
  // row scrolls sideways; the page never does).
  React.useEffect(() => {
    if (!interactive) return;
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = Math.max(0, current.offsetLeft - list.clientWidth / 2 + current.offsetWidth / 2);
  }, [currentPhase, interactive]);

  if (currentPhase === 0) return null;
  const groupLabel = getPhaseGroupLabel(currentPhase);
  const Icon = getPhaseIcon(currentPhase);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3 xl:gap-4">
        <IconTile icon={Icon} tone={getPhaseTone(currentPhase)} size="lg" className="max-sm:size-10 max-sm:[&_svg]:size-5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-fg-muted xl:text-base">
            {t("lesson.live.stepWord")}{" "}
            <span className="font-semibold text-fg tabular-nums">
              {currentPhase}/{TOTAL_LESSON_PHASES}
            </span>
            {groupLabel ? <span className="max-md:hidden"> · {groupLabel}</span> : null}
            {/* Below 640px the hint chip is hidden: say it here instead. */}
            {interactive ? <span className="sm:hidden"> · {t("lesson.live.freeExploreHint")}</span> : null}
          </p>
          <h1 className="truncate font-heading text-xl leading-[1.35] font-semibold text-fg lg:text-[1.375rem] xl:text-2xl">
            {getPhaseName(currentPhase)}
          </h1>
        </div>
        {interactive ? (
          <Chip tone="info" icon={MousePointerClick} className="max-sm:hidden">
            {t("lesson.live.freeExploreHint")}
          </Chip>
        ) : null}
      </div>

      <ol
        ref={listRef}
        aria-label={t("lesson.live.progressLabel")}
        className={cn(
          "flex items-center gap-2",
          interactive && "scrollbar-hide pointer-coarse:-mx-1 pointer-coarse:overflow-x-auto pointer-coarse:px-1 pointer-coarse:py-1",
        )}
      >
        {PHASE_GROUPS.map((group) => (
          <li
            key={group.label}
            className={cn("flex min-w-0 flex-1 gap-[3px]", interactive && "pointer-coarse:flex-none pointer-coarse:gap-1.5")}
            style={{ flexGrow: group.phases.length }}
          >
            {group.phases.map((phase) => {
              const isCurrent = phase === currentPhase;
              const isPast = phase < currentPhase;
              const label = `${t("lesson.live.phaseWord")} ${phase} · ${getPhaseName(phase)}`;
              return interactive ? (
                <button
                  key={phase}
                  type="button"
                  onClick={() => onSelectPhase?.(phase)}
                  disabled={isCurrent || disabled}
                  aria-label={label}
                  title={label}
                  aria-current={isCurrent ? "step" : undefined}
                  className="group flex min-w-0 flex-1 items-center rounded-full py-2.5 disabled:cursor-default pointer-coarse:flex-none pointer-coarse:rounded-(--radius-ctl) pointer-coarse:py-0"
                >
                  <span
                    className={cn(
                      segmentClass(isCurrent, isPast),
                      "pointer-coarse:hidden",
                      !isCurrent && "group-hover:bg-brand-vivid",
                    )}
                  />
                  <span aria-hidden="true" className={touchStepClass(isCurrent, isPast)}>
                    {phase}
                  </span>
                </button>
              ) : (
                <span key={phase} title={label} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 flex-1 py-1.5">
                  <span className={segmentClass(isCurrent, isPast)} />
                  <span className="sr-only">{label}</span>
                </span>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}
