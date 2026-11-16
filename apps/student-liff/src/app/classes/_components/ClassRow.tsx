import Link from "next/link";
import { CalendarDays, ChevronRight, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Chip, type ChipTone } from "@/components/mobile";
import { formatLevelLabel, getLevelTone, levelToneClass, normalizeCefr } from "@/lib/cefr";
import { getSeatInfo } from "@/lib/classAccess";
import { formatTHB, noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import { keepThaiWords } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { getClassStatusBadge, type ClassListItem } from "./classesList";

interface RowChip {
  tone: ChipTone;
  label: string;
  dot?: boolean;
  icon?: LucideIcon;
}

/**
 * The row's one status chip (patterns.md S4): a closed or full class says so
 * (dot + word); an open class shows its free seats (warning tone when few).
 */
function getRowChip(cls: ClassListItem): RowChip {
  const { seatsLeft, urgent } = getSeatInfo(cls.enrolled, cls.capacity);
  const badge = getClassStatusBadge(cls.status);
  const isFull = badge === "full" || seatsLeft <= 0;
  if (badge === "closed") return { tone: "neutral", dot: true, label: t("classes.statusClosed") };
  if (isFull) return { tone: "warning", dot: true, label: t("classes.statusFull") };
  return {
    tone: urgent ? "warning" : "neutral",
    icon: Users,
    label: `${t("classes.seatsLeftPrefix")} ${seatsLeft} ${t("classes.seatsLeftSuffix")}`,
  };
}

/**
 * One catalog class as a flat list row inside the catalog's ListGroup card
 * (patterns.md S4: no ledge, the card is the container). Order of importance:
 * class name → tutor and level → schedule → seats chip and price. The leading
 * tile carries the CEFR band colour and its code (the level is also spelled
 * out in the text line). `onPressStart` fires on touch-down so the class
 * detail request starts before the tap finishes navigating.
 *
 * Grid: tile | name + tutor/level | chevron, then the schedule, seats chip
 * and price. Below 360px that second block spans the whole row under the
 * tile, so the schedule keeps its time instead of being clamped away.
 */
export function ClassRow({ cls, onPressStart }: { cls: ClassListItem; onPressStart?: (classId: string) => void }) {
  // Same "A1" fallback as formatLevelLabel so label and colour always agree.
  const cefr = normalizeCefr(cls.cefr) ?? "A1";
  const levelTone = levelToneClass[getLevelTone(cefr)];
  const chip = getRowChip(cls);
  const tutorText = `${t("classes.tutorPrefix")} ${cls.tutor}`;
  const levelText = formatLevelLabel(cls.cefr, cls.level, t("classes.levelShort"));

  return (
    <Link
      href={`/classes/${cls.id}`}
      id={`class-card-${cls.id}`}
      data-leading=""
      onPointerDown={onPressStart ? () => onPressStart(cls.id) : undefined}
      className="list-row grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3.5 px-4 py-3.5 text-left transition-colors duration-[var(--duration-fast)] [--row-divider-inset:78px] focus-visible:outline-offset-[-3px] active:bg-press"
    >
      <span
        aria-hidden="true"
        className={cn(
          "col-start-1 row-start-1 row-end-3 mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-tile)] text-base leading-none font-semibold tabular-nums max-[359px]:row-end-2",
          levelTone.soft,
          levelTone.text,
        )}
      >
        {cefr}
      </span>
      <span className="col-start-2 row-start-1 min-w-0">
        {/* A heading by role (the parent is a span inside the row link), so the list can be walked by heading. */}
        <span role="heading" aria-level={2} className="t-row line-clamp-2 block text-balance text-fg">
          {noOrphan(cls.name)}
        </span>
        {/* Only the tutor name truncates; the level always shows in full. */}
        <span className="mt-0.5 flex min-w-0 text-sm leading-[1.6] text-fg-muted">
          <span className="min-w-0 truncate" title={tutorText}>
            {tutorText}
          </span>
          <span className="shrink-0 whitespace-pre">{` · ${levelText}`}</span>
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="col-start-3 row-start-1 row-end-3 mt-3.5 -mr-1 size-5 shrink-0 text-fg-subtle max-[359px]:row-end-2"
      />
      <span className="col-start-2 col-end-3 row-start-2 min-w-0 max-[359px]:col-start-1 max-[359px]:col-end-4 max-[359px]:mt-2">
        <span className="mt-0.5 flex items-start gap-1.5 text-sm leading-[1.6] text-fg-muted">
          <CalendarDays aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-fg-subtle" />
          <span className="line-clamp-3 min-w-0">{keepThaiWords(cls.nextSession || t("classes.detail.tba"))}</span>
        </span>
        <span className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Chip tone={chip.tone} dot={chip.dot} icon={chip.icon}>
            {chip.label}
          </Chip>
          <span className="ml-auto shrink-0 text-right leading-[1.4]">
            <span className="text-[17px] font-semibold text-fg tabular-nums">
              {cls.price === 0 ? t("classes.free") : formatTHB(cls.price)}
            </span>
            {cls.price === 0 ? null : <span className="ml-1 text-xs text-fg-muted">{t("classes.perCourse")}</span>}
          </span>
        </span>
      </span>
    </Link>
  );
}
