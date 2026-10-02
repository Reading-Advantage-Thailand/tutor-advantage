"use client";

/**
 * Lesson progress header: current period + phase name, "7 / 18" and an
 * 18-step track grouped by period. In free-explore rehearsal every step is a
 * button that jumps to that phase.
 */
import { PHASE_GROUPS, PHASE_NAMES, TOTAL_LESSON_PHASES } from "@/lib/lessonPhases";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PERIOD_LABEL_KEYS = [
  "lesson.interactive.period1",
  "lesson.interactive.period2",
  "lesson.interactive.period3",
  "lesson.interactive.period4",
  "lesson.interactive.wrapUp",
] as const;

export function getPhaseGroupLabel(phase: number): string | null {
  const index = PHASE_GROUPS.findIndex((group) => group.phases.includes(phase));
  return index >= 0 ? t(PERIOD_LABEL_KEYS[index] ?? PERIOD_LABEL_KEYS[0]) : null;
}

export function getPhaseName(phase: number): string {
  return PHASE_NAMES[phase] ?? `${t("lesson.live.phaseWord")} ${phase}`;
}

export interface PhaseProgressProps {
  currentPhase: number;
  /** Free-explore rehearsal: steps are clickable. */
  interactive?: boolean;
  disabled?: boolean;
  onSelectPhase?: (phase: number) => void;
  className?: string;
}

export function PhaseProgress({ currentPhase, interactive = false, disabled = false, onSelectPhase, className }: PhaseProgressProps) {
  if (currentPhase === 0) return null;
  const groupLabel = getPhaseGroupLabel(currentPhase);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="truncate text-lg font-semibold text-fg lg:text-xl">
            <span className="tabular-nums text-fg-muted">{currentPhase}.</span> {getPhaseName(currentPhase)}
          </h2>
          {groupLabel ? <span className="hidden truncate text-sm text-fg-muted md:inline">· {groupLabel}</span> : null}
        </div>
        <p className="shrink-0 text-sm text-fg-muted">
          {interactive ? (
            t("lesson.live.freeExploreHint")
          ) : (
            <>
              {t("lesson.live.phaseWord")}{" "}
              <span className="font-semibold tabular-nums text-fg">
                {currentPhase} / {TOTAL_LESSON_PHASES}
              </span>
            </>
          )}
        </p>
      </div>

      <ol className="flex items-center gap-1" aria-label={t("lesson.live.progressLabel")}>
        {PHASE_GROUPS.map((group, groupIndex) => (
          <li key={group.label} className={cn("flex min-w-0 flex-1 gap-1", groupIndex > 0 && "ml-1.5")} style={{ flexGrow: group.phases.length }}>
            {group.phases.map((phase) => {
              const isCurrent = phase === currentPhase;
              const isPast = phase < currentPhase;
              const bar = cn(
                "h-2 w-full rounded-full transition-colors",
                isCurrent ? "bg-brand-solid" : isPast ? "bg-brand-vivid/45" : "bg-fill-muted",
              );
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
                  className="group flex flex-1 items-center py-1.5 disabled:cursor-default"
                >
                  <span className={cn(bar, !isCurrent && "group-hover:bg-brand-vivid")} />
                </button>
              ) : (
                <span key={phase} title={label} aria-current={isCurrent ? "step" : undefined} className="flex flex-1 py-1.5">
                  <span className={bar} />
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
