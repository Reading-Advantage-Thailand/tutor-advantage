import { CircleAlert, CircleCheck, Presentation, Star, ThumbsUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatPhaseStep, getPhaseMeta } from "./phaseMeta";
import { TOTAL_LESSON_PHASES } from "@/lib/lessonPhases";
import { Chip, IconTile, Skeleton, Spinner, type IconTileTone } from "@/components/mobile";
import { ReedyMini, type ReedyMood } from "@/components/mascot/ReedyMini";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AiRichText } from "./AiRichText";
import { getAiScoreTone, type AiScoreTone } from "./aiScore";
import { AnswerMiniTile, isAnswerLetter } from "./AnswerTiles";
import { RankBadge } from "./RankBadge";

/*
 * Presentational building blocks for the live-lesson phases (play page + phase
 * components), components.md §6.2. Containers are cards with a rim and no
 * ledge; the score pill is the screen's one sunshine reward element.
 * Server-compatible.
 */

export const lessonCardClass =
  "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

const cardClass = lessonCardClass;

/** Column every phase renders into (max 560px: the 2×2 tiles cap on tablets, centred by the page). */
export function PhaseColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("phase-enter flex w-full max-w-[560px] flex-col gap-3.5", className)}>{children}</div>;
}

/**
 * Lesson journey: one segment per phase (8px, gap 3). Done = brand-vivid,
 * current = brand-solid with a paper gap + ring, upcoming = track. The current
 * step is jade, not sunshine (sunshine belongs to the score). aria-hidden: pair
 * it with the "ขั้นที่ 7/18" caption, which is the text equivalent.
 */
export function PhaseJourney({ phase, total = TOTAL_LESSON_PHASES, className }: {
  phase: number;
  total?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("journey", className)} style={{ ["--journey-steps" as string]: total }}>
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        return <span key={step} data-step={step < phase ? "done" : step === phase ? "now" : "next"} />;
      })}
    </div>
  );
}

/** Phase row: tone tile 48 + "ขั้นที่ 7/18" caption + phase name (h2), then the journey. */
export function PhaseHeader({ phase, icon, title, tone, className }: {
  phase: number;
  icon?: LucideIcon;
  title?: string;
  tone?: IconTileTone;
  className?: string;
}) {
  const meta = getPhaseMeta(phase);
  return (
    <section aria-label={formatPhaseStep(phase)} className={className}>
      <div className="flex items-center gap-3">
        <IconTile icon={icon ?? meta.icon} tone={tone ?? meta.tone} size="md" />
        <div className="min-w-0">
          <p className="text-xs leading-[1.5] font-medium text-fg-muted">{formatPhaseStep(phase)}</p>
          <h2 className="font-heading text-lg leading-[1.4] font-semibold text-balance text-fg">{title ?? meta.label}</h2>
        </div>
      </div>
      <PhaseJourney phase={phase} className="mt-2.5" />
    </section>
  );
}

/**
 * Score pill for the lesson top bar: the screen's one reward element. 36px
 * sunshine pill, filled star, reading face 600 16 with tabular figures (the
 * number ticks). Pass `bump` (e.g. a changing key) to replay the 1 → 1.12 → 1
 * spring when points land; reduced motion keeps it still.
 */
export function ScorePill({ score, bump, className }: { score: number; bump?: boolean; className?: string }) {
  return (
    <span
      role="status"
      aria-label={`${t("interactivePlay.totalScore")} ${score} ${t("interactivePlay.pointsUnit")}`}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent-solid pr-3 pl-2.5 text-base leading-none font-semibold text-on-accent tabular-nums shadow-[inset_0_0_0_1.5px_var(--accent-edge)]",
        bump && "animate-score-bump",
        className,
      )}
    >
      <Star aria-hidden="true" className="size-[18px] fill-current" strokeWidth={1.5} />
      {score}
    </span>
  );
}

/**
 * Instruction card for a phase: tone tile + title (h2) and an optional tip. The
 * step ("ขั้นที่ 7/18") lives in the PhaseHeader above, so it is not repeated.
 * Pass `tile={false}` when the card sits right under the PhaseHeader, which
 * already shows the phase's tone tile.
 */
export function PhaseIntroCard({ phase, icon, title, tip, tone, tile = true }: {
  phase: number;
  /** Overrides the phase icon from phaseMeta. */
  icon?: LucideIcon;
  title?: string;
  tip?: string | null;
  tone?: IconTileTone;
  tile?: boolean;
}) {
  const meta = getPhaseMeta(phase);
  const Icon = icon ?? meta.icon;
  const text = tip ?? meta.tip;
  return (
    <section className={cn(cardClass, "flex items-start gap-3.5 px-[18px] py-4")}>
      {tile ? <IconTile icon={Icon} tone={tone ?? meta.tone} size="md" /> : null}
      <div className="min-w-0 flex-1 self-center">
        <h2 className="font-heading text-lg leading-[1.4] font-semibold text-balance text-fg">{title ?? meta.label}</h2>
        {text ? <p className="mt-0.5 text-[15px] leading-[1.6] text-balance text-fg-muted">{text}</p> : null}
      </div>
    </section>
  );
}

/**
 * "โปรดดูที่หน้าจอ" row: tone tile 64 + tip text + Reedy calm 88 (the screen's
 * one Reedy; no looping motion while children answer). Pass `mascot={false}`
 * when Reedy is already on screen.
 */
export function LookAtScreenRow({ label, tone = "brand", mascot = true }: { label: string; tone?: IconTileTone; mascot?: boolean }) {
  return (
    <div className={cn(cardClass, "flex items-center gap-3.5 py-3 pr-2 pl-4")}>
      <IconTile icon={Presentation} tone={tone} size="lg" className="size-16 rounded-[20px]" />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg leading-[1.4] font-semibold text-fg">{t("interactivePlay.lookAtScreen")}</p>
        <p className="mt-0.5 text-[15px] leading-[1.6] text-balance text-fg-muted">{label}</p>
      </div>
      {mascot ? <ReedyMini mood="calm" size="md" decorative /> : null}
    </div>
  );
}

/** Card with a header row (icon tile + title) for answer forms and results. */
export function PhaseCard({ icon, tone = "brand", title, children, className }: {
  icon: LucideIcon;
  tone?: IconTileTone;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(cardClass, "overflow-hidden", className)}>
      <div className="flex items-center gap-3 border-b-[1.5px] border-hairline px-[18px] py-3">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h2 className="min-w-0 font-heading text-[17px] leading-[1.4] font-semibold text-balance text-fg">{title}</h2>
      </div>
      <div className="flex flex-col gap-4 px-[18px] pt-4 pb-[18px]">{children}</div>
    </section>
  );
}

const statusToneClass = {
  success: "border-success-border bg-success-bg",
  warning: "border-warning-border bg-warning-bg",
  info: "border-info-border bg-info-bg",
  danger: "border-danger-border bg-danger-bg",
  neutral: "border-clay-rim bg-surface shadow-[var(--shadow-card)]",
} as const;

const statusTitleClass = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
  danger: "text-danger-fg",
  neutral: "text-fg",
} as const;

const statusIconClass = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
  danger: "text-danger-fg",
  neutral: "text-brand-fg",
} as const;

/**
 * Status banner (tone card, radius 24): answer sent, everyone answered, missed
 * (warning), waiting / reconnecting (info), finished (success). Icon + title in
 * the tone colour, a muted line under it, and optionally Reedy (96) at the
 * right — only when no other Reedy is on screen.
 */
export function StatusCard({ icon: Icon, eyebrow, title, description, tone = "neutral", mascot, children }: {
  /** Decorative Lucide icon before the title. */
  icon?: LucideIcon;
  /** Small label above the title, e.g. "จบคำถามแล้ว". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: keyof typeof statusToneClass;
  /** Reedy at the right of the card (one Reedy per screen). */
  mascot?: ReedyMood;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-card)] border-[1.5px] py-4 pl-[18px]",
        mascot ? "pr-2 max-[360px]:pr-[18px]" : "pr-[18px]",
        statusToneClass[tone],
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className={cn("mb-1 text-[13px] leading-[1.5] font-semibold", statusTitleClass[tone])}>{eyebrow}</p> : null}
        <h2 className={cn("flex items-start gap-2 font-heading text-lg leading-[1.4] font-semibold text-balance", statusTitleClass[tone])}>
          {Icon ? <Icon aria-hidden="true" className={cn("mt-0.5 size-6 shrink-0", statusIconClass[tone])} strokeWidth={2.4} /> : null}
          <span className="min-w-0">{title}</span>
        </h2>
        {description ? <p className={cn("mt-1 text-sm leading-[1.6] text-balance text-fg-muted", Icon && "pl-8")}>{description}</p> : null}
        {children ? <div className={cn(Icon && "pl-8")}>{children}</div> : null}
      </div>
      {/* Below 360px the words need the width: Reedy steps aside. */}
      {mascot ? <ReedyMini mood={mascot} size="xl" narrowSize="hidden" narrowBelow={360} decorative /> : null}
    </div>
  );
}

/**
 * What the student sent, echoed back while waiting. `big` for a single A–D
 * answer: the option's mini tile (colour + shape + letter) and "ตัวเลือก B",
 * never the option text. `status` (after the reveal) is a chip with a word,
 * e.g. <Chip tone="success" icon={Check}>ถูกต้อง</Chip>.
 */
export function AnswerEcho({ children, big, status }: { children: ReactNode; big?: boolean; status?: ReactNode }) {
  if (big && isAnswerLetter(children)) {
    const letter = String(children).trim().toUpperCase();
    return (
      <div className={cn(cardClass, "flex items-center gap-3 px-3.5 py-3")}>
        <AnswerMiniTile letter={letter} />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-[1.5] font-medium text-fg-muted">{t("interactivePlay.yourAnswer")}</p>
          <p className="text-base leading-[1.5] font-semibold text-fg">
            {t("lessonHistory.optionPrefix")} {letter}
          </p>
        </div>
        {status}
      </div>
    );
  }
  return (
    <div className={cn(cardClass, "px-[18px] py-3.5", big && "text-center")}>
      <p className="text-xs leading-[1.5] font-medium text-fg-muted">{t("interactivePlay.yourAnswer")}</p>
      {big ? (
        <p className="mt-1 font-heading text-[40px] leading-[1.2] font-bold break-words text-brand-fg">{children}</p>
      ) : (
        <p className="mt-0.5 text-base leading-[1.65] font-semibold break-words text-fg">{children}</p>
      )}
      {status ? <div className="mt-2 flex justify-center">{status}</div> : null}
    </div>
  );
}

/** "Sent to AI" placeholder while the AI checks an answer (info tone, skeleton lines). */
export function AiPendingCard() {
  return (
    <div role="status" className="rounded-[var(--radius-card)] border-[1.5px] border-info-border bg-info-bg px-[18px] py-4">
      <p className="flex items-center gap-2 font-heading text-base leading-[1.45] font-semibold text-info-fg">
        <Spinner size="sm" />
        {t("interactivePlay.sendingAi")}
      </p>
      <div aria-hidden="true" className="mt-3 flex items-center gap-3">
        <Skeleton className="size-12 shrink-0 rounded-[var(--radius-tile)]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-2.5 rounded-full" />
          <Skeleton className="h-2.5 w-5/6 rounded-full" />
          <Skeleton className="h-2.5 w-2/3 rounded-full" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.aiChecking")}</p>
    </div>
  );
}

/*
 * AI score tones. A low score is never red for a child: it uses the neutral
 * tone with the words "ลองอีกครั้ง".
 */
const feedbackToneClass: Record<AiScoreTone, { box: string; text: string; bar: string; chip: "success" | "warning" | "neutral" }> = {
  success: { box: "border-success-border bg-success-bg", text: "text-success-fg", bar: "bg-success-solid", chip: "success" },
  // Not bg-warning-solid: that is the sunshine of the score pill, and a view has one reward colour.
  warning: { box: "border-warning-border bg-warning-bg", text: "text-warning-fg", bar: "bg-warning-fg", chip: "warning" },
  danger: { box: "border-clay-rim bg-surface-muted", text: "text-fg", bar: "bg-icon-neutral", chip: "neutral" },
};

const aiScoreStep: Record<AiScoreTone, { level: number; word: () => string; icon: LucideIcon }> = {
  success: { level: 3, word: () => t("interactivePlay.aiScoreGreat"), icon: CircleCheck },
  warning: { level: 2, word: () => t("interactivePlay.aiScoreOkay"), icon: ThumbsUp },
  danger: { level: 1, word: () => t("interactivePlay.aiScoreTryAgain"), icon: CircleAlert },
};

/**
 * AI score out of 5 (components.md §6.2): the number (reading face, tabular),
 * a 3-step meter and a word chip (ดีมาก / พอใช้ / ลองอีกครั้ง), so the result
 * is never colour alone. `ring` keeps the "เต็ม 5" caption of the short-answer
 * phase; without it the number reads "4 / 5".
 */
export function AiScore({ score, ring }: { score: number; ring?: boolean }) {
  const toneKey = getAiScoreTone(score);
  const tone = feedbackToneClass[toneKey];
  const step = aiScoreStep[toneKey];
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className={cn("flex items-baseline gap-1.5 leading-[1.2] font-semibold tabular-nums", tone.text)}>
        <span className="text-[40px]">{score}</span>
        <span className="text-base font-medium text-fg-muted">{ring ? t("interactivePlay.fullScore") : "/ 5"}</span>
      </p>
      <div aria-hidden="true" className="flex w-full max-w-[220px] gap-1.5">
        {[1, 2, 3].map((value) => (
          <span key={value} className={cn("h-2.5 flex-1 rounded-full", value <= step.level ? tone.bar : "bg-track")} />
        ))}
      </div>
      <Chip tone={tone.chip} size="md" icon={step.icon}>
        {step.word()}
      </Chip>
    </div>
  );
}

/**
 * AI feedback text box, tinted by the score (or info without a score). AI text
 * (a string) is shown with the safe markdown subset of AiRichText (bold,
 * lists, paragraphs), so learners never see "**" or "*   " markers.
 */
export function AiFeedbackText({ score, children }: { score?: number; children: ReactNode }) {
  const box = score === undefined ? "border-info-border bg-info-bg" : feedbackToneClass[getAiScoreTone(score)].box;
  return (
    <div className={cn("rounded-[var(--radius-tile)] border-[1.5px] px-4 py-3.5", box)}>
      {typeof children === "string" ? (
        <AiRichText text={children} className="text-base leading-[1.65] text-fg" />
      ) : (
        <p className="text-base leading-[1.65] whitespace-pre-line text-fg">{children}</p>
      )}
    </div>
  );
}

/** "รอคุณครูไปขั้นถัดไป" footer line: presentation icon + words, role="status". */
export function WaitingNextLine({ children }: { children?: ReactNode }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-center text-sm leading-[1.6] text-fg-muted">
      <Presentation aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.1} />
      {children ?? t("interactivePlay.waitTeacherNext")}
    </p>
  );
}

/**
 * Rank strip under the answer tiles (card, no ledge): Reedy happy 48
 * (decorative), "อันดับตอนนี้ · คุณอันดับ 2", the score (tabular) and the rank
 * medal. No answered counts on the phone. Pass `mascot={false}` when Reedy is
 * already on screen.
 */
export function RankStrip({ rank, score, mascot = true, className }: {
  rank: number | null | undefined;
  score: number;
  mascot?: boolean;
  className?: string;
}) {
  const hasRank = typeof rank === "number" && rank > 0;
  return (
    <div role="status" className={cn(cardClass, "flex items-center gap-3 rounded-[20px] py-2 pr-3.5 pl-2", !mascot && "pl-4", className)}>
      {mascot ? <ReedyMini mood="happy" size="xs" decorative /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base leading-[1.5] font-semibold text-fg">
          {t("interactivePlay.leaderboardTitle")}
          {hasRank ? ` · ${t("interactivePlay.youRankPrefix")} ${rank}` : null}
        </p>
        <p className="text-sm leading-[1.6] text-fg-muted">
          <span className="tabular-nums">{score}</span> {t("interactivePlay.pointsUnit")}
        </p>
      </div>
      <RankBadge rank={hasRank ? rank : null} medal={score > 0} size="sm" />
    </div>
  );
}
