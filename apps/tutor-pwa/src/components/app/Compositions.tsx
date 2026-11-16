import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { ProgressBar, UserAvatar, levelIconClass, levelTone } from "./Atoms";

/*
 * Dashboard compositions (redesign 2026-11; components.md §3.4–3.5,
 * patterns.md T1). Pages pass their own Thai strings (the i18n keys stay in
 * the pages), so these stay presentation-only. Server-compatible.
 */

/* ─── WalletHero ──────────────────────────────────────────────────────── */

export interface WalletHeroGoal {
  /** "ยอดสะสมเดือนนี้" */
  currentLabel: ReactNode;
  /** "฿8,450" (tabular) */
  currentValue: ReactNode;
  /** "เป้าหมายเรทถัดไป" */
  targetLabel: ReactNode;
  /** "฿10,000" */
  targetValue: ReactNode;
  /** 0–100 */
  progress: number;
  /** Accessible name of the progress bar ("ยอดสะสม 85% ของเป้าหมาย"). */
  progressLabel: string;
  /** "ขาดอีก <b>฿1,550</b> เพื่อขึ้นเรทถัดไป" — wrap the amount in <b> for the sunshine accent. */
  note?: ReactNode;
}

export interface WalletHeroProps {
  /** "รายได้ประมาณการเดือนนี้" */
  label: ReactNode;
  /** Static hero number, e.g. "฿2,958" (Kodchasan 600 36). */
  amount: ReactNode;
  /** Ink chip at the top right, e.g. "เรท 35%". */
  chip?: ReactNode;
  /** "คอมมิชชัน 35% จากยอดสะสม ฿8,450" */
  subline?: ReactNode;
  goal?: WalletHeroGoal;
  /** Optional on-ink action (<Button variant="on-ink">) on its own row under the sub-line. */
  action?: ReactNode;
  /**
   * Compact secondary on-ink link (<Button variant="on-ink" size="sm">
   * "ดูรายละเอียด") at the right of the amount line, so it takes no row of its
   * own on phones; it drops under the amount only when both do not fit.
   */
  compactAction?: ReactNode;
  className?: string;
}

/**
 * Wallet hero (components.md §3.4): the one ink surface per screen. Amount
 * block, then the goal block (below on narrow widths; right half with a
 * divider once the hero is ≥ 600px wide, via a container query). The goal bar
 * is sunshine on the ink track; focus inside uses --focus-ring-ink.
 */
export function WalletHero({ label, amount, chip, subline, goal, action, compactAction, className }: WalletHeroProps) {
  const labelId = useId();
  return (
    <section className={cn("ds-wallet", className)} aria-labelledby={labelId}>
      <div className="ds-wallet-body">
        <div className="min-w-0">
          <div className="ds-wallet-top">
            <p id={labelId} className="ds-wallet-label">
              {label}
            </p>
            {chip ? (
              <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-ink-chip px-2.5 text-[0.8125rem] leading-none font-semibold whitespace-nowrap text-ink-fg">
                {chip}
              </span>
            ) : null}
          </div>
          {compactAction ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="ds-wallet-amount">{amount}</p>
              <div className="flex shrink-0 items-center gap-2">{compactAction}</div>
            </div>
          ) : (
            <p className="ds-wallet-amount">{amount}</p>
          )}
          {subline ? <p className="ds-wallet-sub">{thaiCopy(subline)}</p> : null}
          {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
        </div>
        {goal ? (
          <div className="ds-wallet-goal">
            <div className="ds-wallet-goal-row">
              <span className="ds-wallet-label">{goal.currentLabel}</span>
              <span className="ds-wallet-label text-right">{goal.targetLabel}</span>
            </div>
            <div className="ds-wallet-goal-row">
              <span className="ds-wallet-goal-value">{goal.currentValue}</span>
              <span className="ds-wallet-goal-value">{goal.targetValue}</span>
            </div>
            <ProgressBar value={goal.progress} tone="ink" label={goal.progressLabel} />
            {goal.note ? <p className="ds-wallet-short">{goal.note}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ─── StatStrip ───────────────────────────────────────────────────────── */

export interface StatStripItem {
  label: ReactNode;
  /** Pre-formatted number (Noto 600 22 tabular; not a hero number). */
  value: ReactNode;
  /** Small line under the value (12 --text-tertiary). */
  hint?: ReactNode;
  /** Makes the cell a link. */
  href?: string;
}

/**
 * Joined stat strip (components.md §3.5): one card, 3 (or 4) cells with
 * hairline dividers. Four cells become a 2×2 grid on phones. Replaces separate
 * 2×2 stat cards on phones. Labels and hints wrap balanced (no one-word last
 * line in a narrow cell).
 *
 * `align="center"`: when a grid or flex parent stretches the strip (beside a
 * taller card), the spare height is split above and below the content, and
 * the cells share one row grid (subgrid), so labels, values and hints line up
 * across cells even when one label wraps or one cell has no hint.
 */
export function StatStrip({
  items,
  align = "start",
  className,
  "aria-label": ariaLabel,
}: {
  items: StatStripItem[];
  /** "start" (default): content at the top of each cell. "center": centred and aligned across cells (see above). */
  align?: "start" | "center";
  className?: string;
  "aria-label"?: string;
}) {
  const centred = align === "center";
  // Rows: spare · label · value · hint · spare. Each cell spans them as a subgrid.
  const cellClass = centred ? "row-span-5 grid grid-rows-subgrid" : "block";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("ds-card ds-strip overflow-hidden", centred && "grid-rows-[1fr_auto_auto_auto_1fr]", className)}
      data-cells={items.length >= 4 ? "4" : undefined}
    >
      {items.map((item, index) => {
        const body = (
          <>
            <span className={cn("ds-strip-label block", centred && "row-start-2")}>{item.label}</span>
            <span className={cn("ds-strip-value block", centred && "row-start-3")}>{item.value}</span>
            {item.hint ? <span className={cn("ds-strip-hint block", centred && "row-start-4")}>{item.hint}</span> : null}
          </>
        );
        return item.href ? (
          <Link
            key={index}
            href={item.href}
            className={cn(
              cellClass,
              "transition-colors duration-(--duration-fast) outline-none hover:bg-row-hover active:bg-press focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-solid focus-visible:outline-focus-ring",
            )}
          >
            {body}
          </Link>
        ) : (
          <div key={index} className={centred ? cellClass : undefined}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ─── AvatarStack ─────────────────────────────────────────────────────── */

/** Overlapping initials (30px, 2px card ring, −8px), at most `max`. Decorative: pair it with a count. */
export function AvatarStack({ names, max = 4, className }: { names: string[]; max?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("ds-avatar-stack", className)}>
      {names.slice(0, max).map((name, index) => (
        <UserAvatar key={`${name}-${index}`} name={name} size="sm" maxInitials={1} className="size-[30px] text-xs" />
      ))}
    </span>
  );
}

/* ─── NextClassCard ───────────────────────────────────────────────────── */

export interface NextClassCardProps {
  /** "คลาสถัดไป" */
  label: ReactNode;
  /** Chip at the top right, e.g. <Chip tone="brand" dot>วันนี้</Chip>. */
  chip?: ReactNode;
  /** Start time, a static hero number ("17:00", Kodchasan 600 32). */
  time: ReactNode;
  /** "ถึง 18:00 · อีก 35 นาที" */
  timeNote?: ReactNode;
  /** Class name ("English"). */
  title: ReactNode;
  /** Lines under the title ("Primary Origins 2 (A0)", "บทที่ 6 · The Friendly Dolphin"). */
  lines?: ReactNode[];
  /** Student names for the avatar stack. */
  studentNames?: string[];
  /** "6 นักเรียน" */
  studentsLabel?: ReactNode;
  /** The page's one primary (<Button size="lg">เริ่มสอนสด</Button>). */
  primaryAction?: ReactNode;
  /** Outline action ("ดูคลาส"). */
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * Next-class card (patterns.md T1.4, bold graft): label + chip, the big start
 * time, the class lines, an avatar stack, then the primary "เริ่มสอนสด" and a
 * secondary "ดูคลาส". A container card (rim, no ledge): the buttons are the
 * tap targets. A flex column: when a grid stretches the card (row-span), the
 * content stays together at the top and the action row keeps to the bottom.
 */
export function NextClassCard({
  label,
  chip,
  time,
  timeNote,
  title,
  lines,
  studentNames,
  studentsLabel,
  primaryAction,
  secondaryAction,
  className,
}: NextClassCardProps) {
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className={cn("ds-card flex flex-col gap-2.5 px-[18px] pt-4 pb-[18px]", className)}>
      <div className="flex items-center justify-between gap-3">
        <p id={labelId} className="type-label text-fg-muted">
          {label}
        </p>
        {chip}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="type-hero-time text-fg">{time}</span>
        {timeNote ? <span className="type-body-s text-fg-muted">{timeNote}</span> : null}
      </p>
      <div className="min-w-0">
        <p className="type-card text-balance-th text-fg">{title}</p>
        {lines?.map((line, index) => (
          <p key={index} className="type-body-s text-fg-muted">
            {line}
          </p>
        ))}
      </div>
      {studentNames?.length || studentsLabel ? (
        <div className="flex items-center gap-2.5">
          {studentNames?.length ? <AvatarStack names={studentNames} /> : null}
          {studentsLabel ? <span className="type-body-s text-fg-muted">{studentsLabel}</span> : null}
        </div>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 pt-1">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  );
}

/* ─── SessionList / SessionRow ────────────────────────────────────────── */

/** Time column: "default" 52px (17:00 over 60 นาที) · "wide" 72px (untimed labels: "ตามนัดหมาย", "ตลอดวัน (24 ชม.)"). */
export type SessionTimeColumn = "default" | "wide";

/** Card of today's session rows (one <ul>). `timeColumn` sets one time-column width for every row. */
export function SessionList({
  children,
  timeColumn = "default",
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  /** "wide" when any row shows an untimed label, so the whole list keeps one column width. */
  timeColumn?: SessionTimeColumn;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ul
      aria-label={ariaLabel}
      data-time-column={timeColumn === "wide" ? "wide" : undefined}
      className={cn("ds-card overflow-hidden", className)}
    >
      {children}
    </ul>
  );
}

export interface SessionRowProps {
  /** "17:00" (tabular), or an untimed label ("ตามนัดหมาย"; use timeColumn="wide"). */
  time: ReactNode;
  /** "60 นาที" */
  duration?: ReactNode;
  /** Class name. */
  title: ReactNode;
  /** CEFR band ("A0") for the level dot colour. */
  level?: string | null;
  /** "6 คน · A0 · บทที่ 6" */
  meta?: ReactNode;
  /** Opens the class/session. The title becomes a stretched link. */
  href?: string;
  /**
   * Right side: a "ถัดไป" chip for the session already in the next-class
   * card, a tonal "เริ่มสอน" button for one that can start now, else nothing
   * (a chevron shows when the row links).
   */
  trailing?: ReactNode;
  /** This row's time-column width (a SessionList's `timeColumn` sets it for every row). */
  timeColumn?: SessionTimeColumn;
  className?: string;
}

/**
 * Today's-session row (patterns.md T1.6, calm graft): a 52px time column
 * (72px "wide" for untimed labels), the level dot + class name, the seats
 * line, and one trailing element. The row is flat; when it links, the title
 * is a stretched link and a trailing button sits above it (no nested
 * interactive elements). The trailing wrapper itself lets taps through, so a
 * plain chip there still opens the row; only real controls inside it take
 * the tap.
 */
export function SessionRow({ time, duration, title, level, meta, href, trailing, timeColumn, className }: SessionRowProps) {
  const dotClass = levelIconClass[levelTone(level)];
  return (
    <li
      data-time-column={timeColumn === "wide" ? "wide" : undefined}
      className={cn("ds-session-row max-[360px]:flex-wrap max-[360px]:gap-y-2", href && "has-[a:hover]:bg-row-hover", className)}
    >
      <span className="ds-session-time">
        <span className="block text-base leading-[1.3] font-semibold text-fg tabular">{time}</span>
        {duration ? <span className="type-caption text-fg-subtle">{duration}</span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-card text-fg">
          <span aria-hidden="true" className={cn("ds-level-dot", dotClass)} />
          {href ? (
            <Link
              href={href}
              className="outline-none after:absolute after:inset-0 focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-solid focus-visible:after:outline-focus-ring"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </span>
        {meta ? <span className="block type-body-s text-fg-muted">{meta}</span> : null}
      </span>
      {trailing ? (
        // Below 360px the trailing chip or button drops under the text (in line with it) so the title keeps its width.
        <span className="pointer-events-none relative z-[1] flex shrink-0 items-center max-[360px]:basis-full max-[360px]:pl-[calc(var(--session-time-w,52px)+14px)] [&_:is(a,button,input,select,textarea,label,summary,[role=button],[role=switch],[role=checkbox],[role=menuitem],[tabindex])]:pointer-events-auto">
          {trailing}
        </span>
      ) : null}
      {href && !trailing ? <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-fg-subtle" /> : null}
    </li>
  );
}
