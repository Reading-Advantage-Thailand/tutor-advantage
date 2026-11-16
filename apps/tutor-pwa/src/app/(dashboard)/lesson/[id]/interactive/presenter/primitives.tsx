"use client";

/**
 * Small building blocks shared by the presenter phases (components.md §7).
 * Sized for a projector: large type, high-contrast tokens, no glows or
 * gradients. The six lesson games never import anything from here.
 */
import type { LucideIcon } from "lucide-react";
import { Check, CircleCheck, Info, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile, ProgressBar, UserAvatar, clampPercent, type TileTone } from "@/components/app";
import { ReedyMini } from "@/components/mascot/ReedyMini";

/** Non-colour cue of each answer tile (components.md §6.1). */
export type AnswerShapeKind = "triangle" | "diamond" | "circle" | "square";

export interface OptionStyle {
  /** Tile fill + text colour (+ the dark-mode 2px inner rim). */
  tile: string;
  /** Letter badge background inside the tile. */
  badge: string;
  /** Results-chart bar colour (CSS colour, used as an SVG fill). */
  bar: string;
  shape: AnswerShapeKind;
}

/**
 * A–D answer colours, from the same --answer-* tokens as the student phones
 * (A berry red · B ocean blue · C sunshine · D deep violet), each with its
 * shape. They identify options, never right or wrong: the correct bar and
 * ring use --success-solid plus the word "ถูกต้อง".
 */
export const OPTION_STYLES: Record<string, OptionStyle> = {
  A: {
    tile: "bg-answer-a text-on-answer-a shadow-[inset_0_0_0_2px_var(--answer-rim)]",
    badge: "bg-[rgb(0_0_0/0.18)]",
    bar: "var(--answer-a)",
    shape: "triangle",
  },
  B: {
    tile: "bg-answer-b text-on-answer-b shadow-[inset_0_0_0_2px_var(--answer-rim)]",
    badge: "bg-[rgb(0_0_0/0.18)]",
    bar: "var(--answer-b)",
    shape: "diamond",
  },
  C: {
    tile: "bg-answer-c text-on-answer-c shadow-[inset_0_0_0_2px_var(--answer-c-edge)]",
    badge: "bg-[rgb(0_0_0/0.10)]",
    bar: "var(--answer-c)",
    shape: "circle",
  },
  D: {
    tile: "bg-answer-d text-on-answer-d shadow-[inset_0_0_0_2px_var(--answer-rim)]",
    badge: "bg-[rgb(0_0_0/0.18)]",
    bar: "var(--answer-d)",
    shape: "square",
  },
};
export const FALLBACK_OPTION_STYLE: OptionStyle = {
  tile: "bg-surface-muted text-fg shadow-[inset_0_0_0_1px_var(--clay-rim)]",
  badge: "bg-[rgb(0_0_0/0.06)]",
  bar: "var(--text-tertiary)",
  shape: "square",
};

/** Answer shape glyph (triangle A, diamond B, circle C, square D), currentColor at 92%. */
export function AnswerShape({ shape, className }: { shape: AnswerShapeKind; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("shrink-0 opacity-[0.92]", className)} fill="currentColor">
      {shape === "triangle" ? <path d="M12 3.2 22 20.4H2Z" /> : null}
      {shape === "diamond" ? <path d="M12 1.8 22.2 12 12 22.2 1.8 12Z" /> : null}
      {shape === "circle" ? <circle cx="12" cy="12" r="9.5" /> : null}
      {shape === "square" ? <rect x="3" y="3" width="18" height="18" rx="2.5" /> : null}
    </svg>
  );
}

/**
 * Letter badge for an option tile: the shape + the letter (Kodchasan 600).
 * 56px with a 40px letter at 1080p (components.md §6.1); 48/28 below xl.
 */
export function AnswerBadge({ letter, className }: { letter: string; className?: string }) {
  const style = OPTION_STYLES[letter] ?? FALLBACK_OPTION_STYLE;
  return (
    <span
      className={cn(
        "flex h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-(--radius-ctl) px-1.5 font-heading text-[1.75rem] leading-none font-semibold xl:h-14 xl:min-w-14 xl:text-[2.5rem]",
        style.badge,
        className,
      )}
    >
      <AnswerShape shape={style.shape} className="size-5 xl:size-6" />
      {letter}
    </span>
  );
}

/**
 * Presenter answer tile (components.md §6.1): the option's --answer-* fill,
 * the shape + letter badge, option text Noto 600 /1.4 (26 on laptops, 30 at
 * 1080p) and an optional 44px speak button. The one tile markup for
 * ChoiceQuestionStage and the ui-kit. The speak button's focus outline uses
 * the tile's text colour: the blue focus ring disappears on the blue B tile,
 * the text colour keeps ≥ 5:1 on every answer fill.
 *
 * Reveal (`state`): the correct tile gets a 6px --success-solid outer ring
 * and a "ถูกต้อง" success chip with a check (word + icon, never the tile
 * colour); the other tiles fade to .45.
 */
export function OptionTile({
  letter,
  children,
  onSpeak,
  speakLabel,
  speakTitle,
  lang,
  state = "default",
  correctLabel,
  className,
}: {
  letter: string;
  /** The option text. */
  children: ReactNode;
  /** Shows the speak button. */
  onSpeak?: () => void;
  speakLabel?: string;
  speakTitle?: string;
  lang?: string;
  /** default while answering · correct / dimmed after the reveal. */
  state?: "default" | "correct" | "dimmed";
  /** Word on the correct tile's chip ("ถูกต้อง"). */
  correctLabel?: string;
  className?: string;
}) {
  const style = OPTION_STYLES[letter] ?? FALLBACK_OPTION_STYLE;
  return (
    <div
      className={cn(
        "relative flex min-h-20 min-w-0 items-center gap-3 rounded-(--radius-answer) p-4 transition-opacity duration-(--duration-normal) xl:min-h-24",
        style.tile,
        state === "correct" && "outline-[6px] outline-offset-2 outline-success-solid outline-solid",
        state === "dimmed" && "opacity-45",
        className,
      )}
    >
      <AnswerBadge letter={letter} />
      <span
        lang={lang}
        className="min-w-0 flex-1 text-xl leading-[1.4] font-semibold break-words whitespace-normal lg:text-[1.625rem] xl:text-[1.875rem]"
      >
        {children}
      </span>
      {state === "correct" && correctLabel ? (
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-success-bg px-3.5 text-base leading-none font-semibold text-success-fg shadow-[inset_0_0_0_1px_var(--success-border)] xl:h-11 xl:text-xl">
          <Check aria-hidden="true" className="size-5 shrink-0 xl:size-6" strokeWidth={2.6} />
          {correctLabel}
        </span>
      ) : null}
      {onSpeak ? (
        <button
          type="button"
          onClick={onSpeak}
          aria-label={speakLabel}
          title={speakTitle}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[rgb(0_0_0/0.15)] transition-colors duration-(--duration-fast) hover:bg-[rgb(0_0_0/0.25)] focus-visible:outline-current"
        >
          <Volume2 aria-hidden="true" className="size-5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The question on the stage: Kodchasan 600 /1.3, 28 → 36 on laptops → 44 at
 * 1080p. An h2 under the phase bar's h1 (the phase name).
 */
export function StageQuestion({ children, className, lang }: { children: ReactNode; className?: string; lang?: string }) {
  return (
    <h2
      lang={lang}
      className={cn(
        "font-heading text-[1.75rem] leading-[1.3] font-semibold break-words text-balance-th text-fg xl:text-[2.25rem] 2xl:text-[2.75rem]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/**
 * 44px round speak button for stage prompts (question, word, sentence):
 * brand-soft fill, Volume2 20. Keeps the global 3px focus outline.
 */
export function StageSpeakButton({
  onClick,
  label,
  title,
  tourTarget,
  className,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  tourTarget?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour-target={tourTarget}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg transition-colors duration-(--duration-fast) hover:bg-brand-soft-border",
        className,
      )}
    >
      <Volume2 aria-hidden="true" className="size-5" />
    </button>
  );
}

/**
 * Stage header block: a 40/48 tone tile, a small eyebrow and a Noto 600 title
 * (20 → 24 on the stage). Used above the stage panels that have no question.
 */
export function StageHeading({
  icon,
  tone = "brand",
  eyebrow,
  title,
  aside,
  className,
}: {
  icon: LucideIcon;
  tone?: TileTone;
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Right side: a chip or a stat. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <IconTile icon={icon} tone={tone} size="lg" className="max-sm:size-10" />
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-sm font-medium text-fg-muted xl:text-base">{thaiLabel(eyebrow)}</p> : null}
        <h2 className="text-xl leading-[1.4] font-semibold text-balance-th text-fg xl:text-2xl">{thaiLabel(title)}</h2>
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
    </div>
  );
}

/* ─── Podium (components.md §6.5, presenter size) ─────────────────────── */

export interface PodiumEntry {
  key: string;
  name: string;
  pictureUrl?: string | null;
  score: number;
  /**
   * Podium slot 1–3 in score order (1 centre, 2 left, 3 right). Tied players
   * keep the server order, so the slot is stable; it only picks the column.
   */
  place: 1 | 2 | 3;
  /**
   * Shared competition place (14, 7, 7 → 1, 2, 2); defaults to the slot.
   * The numeral, block height, medal, avatar size and accessible name follow it.
   */
  rank?: number | null;
}

/** Column order follows the slot: 2nd slot left, 1st centre, 3rd right. */
const PODIUM_SLOT_ORDER = { 1: "order-2", 2: "order-1", 3: "order-3" } as const;

/** Block height and avatar size follow the shared place (1st: the UserAvatar "stage" size, 64 → 80). */
const PODIUM_RANK = {
  1: { block: "h-[88px] xl:h-[120px]", avatar: "" },
  2: { block: "h-16 xl:h-[88px]", avatar: "size-14 text-lg xl:size-16 xl:text-xl" },
  3: { block: "h-12 xl:h-16", avatar: "size-14 text-lg xl:size-16 xl:text-xl" },
} as const;

/** The medal (block fill and avatar ring) follows the shared place, so a tie for 2nd is silver twice. */
const PODIUM_MEDAL = {
  1: { block: "bg-medal-gold", ring: "ring-4 ring-medal-gold" },
  2: { block: "bg-medal-silver", ring: "ring-4 ring-medal-silver" },
  3: { block: "bg-medal-bronze", ring: "ring-4 ring-medal-bronze" },
} as const;

/** A place 1–3 for the look tables; anything else falls back to the slot. */
const podiumRank = (rank: number | null | undefined, slot: 1 | 2 | 3): 1 | 2 | 3 =>
  rank === 1 || rank === 2 || rank === 3 ? rank : slot;

/**
 * Wrap-up podium: blocks 88 / 64 / 48 tall (120 / 88 / 64 on the stage) in
 * gold / silver / bronze by shared place (ties share a place: two students on
 * place 2 stand on two equal silver "2" blocks) with the Kodchasan numeral in
 * --on-medal, and the avatar, name and "N คะแนน" above each. The podium is
 * the view's one reward group. Missing slots keep their column so the 1st
 * slot stays centred.
 */
export function PodiumStage({
  entries,
  scoreUnit,
  className,
  animated = false,
  compact = false,
}: {
  entries: PodiumEntry[];
  scoreUnit: string;
  className?: string;
  /** Adds the shared rank-card entrance (off under reduced motion). */
  animated?: boolean;
  /** Narrow column (game ranking beside its list): names 16, smaller avatars. */
  compact?: boolean;
}) {
  return (
    <ol className={cn("grid grid-cols-3 items-end gap-3 xl:gap-5", className)}>
      {([2, 1, 3] as const).map((place) => {
        const entry = entries.find((item) => item.place === place);
        const order = PODIUM_SLOT_ORDER[place];
        if (!entry) return <li key={place} aria-hidden="true" className={order} />;
        const rank = podiumRank(entry.rank, place);
        const look = PODIUM_RANK[rank];
        const medal = PODIUM_MEDAL[rank];
        return (
          <li key={entry.key} className={cn("flex min-w-0 flex-col items-center gap-1.5", order, animated && "game-rank-card")}>
            <UserAvatar
              name={entry.name}
              src={entry.pictureUrl}
              toneKey={entry.key}
              size={rank === 1 && !compact ? "stage" : undefined}
              className={cn(compact ? "size-12 text-base" : look.avatar, medal.ring, "ring-offset-2 ring-offset-surface")}
            />
            <p
              className={cn(
                "mt-1 w-full truncate text-center leading-[1.4] font-semibold text-fg",
                compact ? "text-base" : "text-lg xl:text-[1.75rem]",
              )}
              title={entry.name}
            >
              {entry.name}
            </p>
            <p className="text-base leading-none font-semibold text-fg tabular-nums xl:text-xl">
              {entry.score}
              <span className="ml-1 text-sm font-medium text-fg-muted xl:text-base">{scoreUnit}</span>
            </p>
            <div
              className={cn(
                "mt-1.5 flex w-full items-start justify-center rounded-t-(--radius-card) pt-2 font-heading text-[2rem] leading-none font-semibold text-on-medal shadow-[inset_0_-6px_0_rgb(0_0_0/0.08)] xl:text-[2.5rem]",
                look.block,
                medal.block,
              )}
            >
              <span aria-hidden="true">{rank}</span>
              <span className="sr-only">#{rank}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Waiting / empty stage message (components.md §7 StageEmpty family): Reedy
 * (calm by default) 120, a Noto 600 title (24 → 28) and one line of help.
 * At most one Reedy per stage.
 */
export function StageWaiting({
  title,
  description,
  mood = "calm",
  action,
  as: Title = "p",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  mood?: "calm" | "cheer" | "sleepy";
  /** Heading level of the title (h1 when it is the whole stage, e.g. phase 0). */
  as?: "p" | "h1" | "h2";
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 items-center justify-center p-6", className)}>
      <div className="flex max-w-xl flex-col items-center gap-3 rounded-(--radius-card) border border-clay-rim bg-surface px-8 py-8 text-center shadow-card">
        <ReedyMini mood={mood} size="lg" decorative />
        <Title className="text-2xl leading-[1.4] font-semibold text-balance-th text-fg xl:text-[1.75rem]">{title}</Title>
        {description ? <p className="text-base leading-[1.6] text-fg-muted xl:text-lg xl:leading-[1.6]">{description}</p> : null}
        {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Panel surface used for every presenter block: card, 1px clay rim, radius 16. */
export function StagePanel({
  className,
  children,
  as: Tag = "section",
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "aside";
  "data-tour-target"?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag className={cn("rounded-(--radius-card) border border-clay-rim bg-surface shadow-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Small label above a heading (Thai, no uppercase/tracking): 14 on laptops, 16 at 1080p. */
export function StageEyebrow({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-sm leading-[1.6] font-medium text-fg-muted xl:text-base", className)}>
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 text-brand-fg" /> : null}
      {/* One flex item for the text, so the kept words inside it wrap as one run. */}
      {typeof children === "string" ? <span className="min-w-0">{thaiLabel(children)}</span> : children}
    </p>
  );
}

/** "ส่งแล้ว 8 / 12 คน" with a progress bar — the tutor's main waiting signal. */
export function AnswerProgress({
  answered,
  total,
  label,
  note,
  className,
  "data-tour-target": tourTarget,
}: {
  answered: number;
  total: number;
  label: string;
  note?: ReactNode;
  className?: string;
  "data-tour-target"?: string;
}) {
  const pct = total > 0 ? clampPercent((answered / total) * 100) : 0;
  const complete = total > 0 && answered >= total;
  return (
    <div data-tour-target={tourTarget} className={cn("flex w-full max-w-md flex-col items-center gap-2", className)}>
      <p role="status" aria-live="polite" className="text-base text-fg-muted">
        {label}{" "}
        <span className={cn("text-xl font-semibold tabular-nums", complete ? "text-success-fg" : "text-fg")}>
          {answered} / {total}
        </span>
      </p>
      <ProgressBar value={pct} tone={complete ? "success" : "brand"} label={`${label} ${answered} / ${total}`} />
      {note ? <div className="text-sm font-medium text-fg-muted">{note}</div> : null}
    </div>
  );
}

/** Rehearsal-only status line ("รอนักเรียนตอบ… 2/4 คน"): info tone with an icon. */
export function PreparationStatus({ text, done }: { text: string | null; done?: boolean }) {
  if (!text) return null;
  const Icon = done ? CircleCheck : Info;
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", done ? "text-success-fg" : "text-info-fg")}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {text}
    </p>
  );
}

/**
 * Large number + label well for result summaries: value Noto 600 40 tabular.
 * Wrong/"needs work" counts use the neutral tone, not danger (children see
 * the projector).
 */
export function ResultStat({
  label,
  value,
  unit,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral" | "brand";
  className?: string;
}) {
  const toneClass = {
    success: "bg-success-bg text-success-fg",
    danger: "bg-danger-bg text-danger-fg",
    warning: "bg-warning-bg text-warning-fg",
    info: "bg-info-bg text-info-fg",
    neutral: "bg-surface-muted text-fg",
    brand: "bg-brand-soft text-brand-soft-fg",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-1 rounded-(--radius-ctl) px-4 py-3", toneClass, className)}>
      <p className="text-sm font-medium text-fg-muted">{label}</p>
      <p className="text-[2.5rem] leading-none font-semibold tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-base font-medium text-fg-muted">{unit}</span> : null}
      </p>
    </div>
  );
}

/** Centred message for phases without enough content: a card with Reedy calm 120 and one line. */
export function StageEmpty({ message, tourTarget, statusTarget }: { message: string; tourTarget?: string; statusTarget?: string }) {
  return (
    <div data-tour-target={tourTarget} className="flex flex-1 items-center justify-center p-6">
      <div
        data-tour-target={statusTarget}
        className="flex max-w-xl flex-col items-center gap-4 rounded-(--radius-card) border border-clay-rim bg-surface px-8 py-8 text-center shadow-card"
      >
        <ReedyMini mood="calm" size="lg" decorative />
        <p className="text-xl font-semibold text-balance-th text-fg-muted">{message}</p>
      </div>
    </div>
  );
}
