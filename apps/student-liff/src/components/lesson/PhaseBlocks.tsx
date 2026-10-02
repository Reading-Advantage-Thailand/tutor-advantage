import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatPhaseStep, getPhaseMeta } from "./phaseMeta";
import { Chip, IconTile, iconTileToneClass, Skeleton, Spinner, type IconTileTone } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getAiScoreTone, type AiScoreTone } from "./aiScore";

/* Presentational building blocks for the live-lesson phases (play page + phase components). Server-compatible. */

const cardClass = "rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]";

/** Column every phase renders into (max 448px, centred by the page). */
export function PhaseColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("phase-enter flex w-full max-w-md flex-col gap-3", className)}>{children}</div>;
}

/** Big intro card for a phase: emoji, "ขั้นที่ n/18", phase name and an optional tip. */
export function PhaseIntroCard({ phase, emoji, title, tip, tone }: {
  phase: number;
  emoji?: string;
  title?: string;
  tip?: string | null;
  tone?: IconTileTone;
}) {
  const meta = getPhaseMeta(phase);
  const toneClass = iconTileToneClass[tone ?? meta.tone];
  return (
    <section className={cn("rounded-[var(--radius-card)] px-5 py-6 text-center", toneClass)}>
      <p aria-hidden="true" className="text-[56px] leading-[1.15]">{emoji ?? meta.emoji}</p>
      <Chip size="sm" className="mt-3 bg-surface text-fg-muted">{formatPhaseStep(phase)}</Chip>
      <h2 className="mt-2 text-[22px] leading-[1.4] font-extrabold text-fg">{title ?? meta.label}</h2>
      {(tip ?? meta.tip) ? <p className="mt-1 text-[15px] leading-[1.6] text-fg-muted">{tip ?? meta.tip}</p> : null}
    </section>
  );
}

/** "โปรดดูที่หน้าจอ" row under a look-at-screen intro. */
export function LookAtScreenRow({ label, tone = "brand" }: { label: string; tone?: IconTileTone }) {
  return (
    <div className={cn(cardClass, "flex items-center gap-3 p-4")}>
      <span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-xl", iconTileToneClass[tone])}>👆</span>
      <div className="min-w-0">
        <p className="text-[15px] leading-[1.5] font-bold text-fg">{t("interactivePlay.lookAtScreen")}</p>
        <p className="text-[13px] leading-[1.5] text-fg-muted">{label}</p>
      </div>
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
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h2 className="min-w-0 text-[15px] leading-[1.5] font-bold text-fg">{title}</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  );
}

const statusToneClass = {
  success: "border-success-border bg-success-bg",
  warning: "border-warning-border bg-warning-bg",
  neutral: "border-hairline bg-surface shadow-[var(--shadow-card)]",
} as const;

const statusTitleClass = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  neutral: "text-fg",
} as const;

/** Short centred status: answer sent, everyone answered, skipped, game finished… */
export function StatusCard({ emoji, eyebrow, title, description, tone = "neutral", children }: {
  emoji?: string;
  /** Small label above the emoji, e.g. "จบคำถามแล้ว". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: keyof typeof statusToneClass;
  children?: ReactNode;
}) {
  return (
    <div role="status" className={cn("rounded-[var(--radius-card)] border px-5 py-5 text-center", statusToneClass[tone])}>
      {eyebrow ? <p className={cn("mb-1 text-[13px] leading-[1.5] font-bold", statusTitleClass[tone])}>{eyebrow}</p> : null}
      {emoji ? <p aria-hidden="true" className="text-[32px] leading-[1.2]">{emoji}</p> : null}
      <h2 className={cn("mt-1 text-[17px] leading-[1.45] font-bold", statusTitleClass[tone])}>{title}</h2>
      {description ? <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{description}</p> : null}
      {children}
    </div>
  );
}

/** What the student sent, echoed back while waiting. `big` for a single A–D letter. */
export function AnswerEcho({ children, big }: { children: ReactNode; big?: boolean }) {
  return (
    <div className={cn(cardClass, "p-4", big && "text-center")}>
      <p className="text-[13px] leading-[1.5] font-semibold text-brand-fg">{t("interactivePlay.yourAnswer")}</p>
      {big ? (
        <p className="mt-1 text-[56px] leading-[1.15] font-black text-brand-fg">{children}</p>
      ) : (
        <p className="mt-1 text-[15px] leading-[1.6] font-semibold break-words text-fg">{children}</p>
      )}
    </div>
  );
}

/** "Sent to AI" placeholder while the AI checks an answer. */
export function AiPendingCard() {
  return (
    <div role="status" className={cn(cardClass, "p-4")}>
      <p className="flex items-center gap-2 text-[13px] leading-[1.5] font-semibold text-info-fg">
        <Spinner size="sm" />
        {t("interactivePlay.sendingAi")}
      </p>
      <div aria-hidden="true" className="mt-3 flex items-center gap-3">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-2.5 rounded-full" />
          <Skeleton className="h-2.5 w-5/6 rounded-full" />
          <Skeleton className="h-2.5 w-2/3 rounded-full" />
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.aiChecking")}</p>
    </div>
  );
}

const feedbackToneClass: Record<AiScoreTone, { box: string; text: string; stroke: string }> = {
  success: { box: "border-success-border bg-success-bg", text: "text-success-fg", stroke: "var(--success-fg)" },
  warning: { box: "border-warning-border bg-warning-bg", text: "text-warning-fg", stroke: "var(--warning-fg)" },
  danger: { box: "border-danger-border bg-danger-bg", text: "text-danger-fg", stroke: "var(--danger-fg)" },
};

/** Score out of 5 as a ring (short answer) or a plain number (writing). */
export function AiScore({ score, ring }: { score: number; ring?: boolean }) {
  const tone = feedbackToneClass[getAiScoreTone(score)];
  if (!ring) {
    return (
      <p className={cn("text-center text-[36px] leading-[1.2] font-black tabular-nums", tone.text)}>
        {score}
        <span className="text-base font-semibold text-fg-muted"> / 5</span>
      </p>
    );
  }
  return (
    <div className="relative mx-auto size-28">
      <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--fill-muted)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={tone.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="264"
          strokeDashoffset={264 - (264 * score) / 5}
          style={{ animation: "score-ring-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-[30px] leading-[1.2] font-black tabular-nums", tone.text)}>{score}</span>
        <span className="text-xs leading-[1.5] text-fg-muted">{t("interactivePlay.fullScore")}</span>
      </div>
    </div>
  );
}

/** AI feedback text box, tinted by the score (or info-blue without a score). */
export function AiFeedbackText({ score, children }: { score?: number; children: ReactNode }) {
  const box = score === undefined ? "border-info-border bg-info-bg" : feedbackToneClass[getAiScoreTone(score)].box;
  return (
    <div className={cn("rounded-2xl border p-4", box)}>
      <p className="text-[15px] leading-[1.6] font-medium whitespace-pre-line text-fg">{children}</p>
    </div>
  );
}

/** "รอคุณครูไปหน้าถัดไป…" footer line. */
export function WaitingNextLine({ children }: { children?: ReactNode }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-[13px] leading-[1.5] font-semibold text-fg-muted">
      <Spinner size="sm" className="text-brand-fg" />
      {children ?? t("interactivePlay.waitingNextPage")}
    </p>
  );
}
