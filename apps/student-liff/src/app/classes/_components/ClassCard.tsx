import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { Chip, LevelChip, UserAvatar } from "@/components/mobile";
import { formatLevelLabel, getLevelTone, levelToneClass, normalizeCefr } from "@/lib/cefr";
import { getSeatInfo } from "@/lib/classAccess";
import { formatTHB, noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getClassStatusBadge, type ClassListItem } from "./classesList";

const cardClass =
  "pressable relative block overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface p-4 pt-5 text-left shadow-[var(--shadow-card)] active:bg-press";

/**
 * Catalog card: the whole card is the tap target (no fake CTA pill). Order of
 * importance: class name → tutor → schedule → level · seats · price.
 * `onPressStart` fires on touch-down so the class detail request starts
 * before the tap finishes navigating.
 */
export function ClassCard({ cls, onPressStart }: { cls: ClassListItem; onPressStart?: (classId: string) => void }) {
  const { seatsLeft, urgent } = getSeatInfo(cls.enrolled, cls.capacity);
  const badge = getClassStatusBadge(cls.status);
  const isFull = badge === "full" || seatsLeft <= 0;
  // Same "A1" fallback as formatLevelLabel so label and colour always agree.
  const cefr = normalizeCefr(cls.cefr) ?? "A1";
  const levelTone = levelToneClass[getLevelTone(cefr)];

  return (
    <Link
      href={`/classes/${cls.id}`}
      id={`class-card-${cls.id}`}
      className={cardClass}
      onPointerDown={onPressStart ? () => onPressStart(cls.id) : undefined}
    >
      {/* Level colour band (A0 teal · A1 green · A2 orange · B1 blue · B2 purple · C1 pink) */}
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${levelTone.solid}`} />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-base leading-[1.5] font-bold text-balance text-fg">{noOrphan(cls.name)}</h2>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-[13px] leading-[1.5] text-fg-muted">
            <UserAvatar name={cls.tutor} size="xs" decorative />
            <span className="truncate">{cls.tutor}</span>
          </p>
        </div>
        {badge ? (
          <Chip tone={badge === "full" ? "danger" : "neutral"} dot>
            {badge === "full" ? t("classes.statusFull") : t("classes.statusClosed")}
          </Chip>
        ) : null}
      </div>

      <p className="mt-3 flex items-start gap-2 text-[13px] leading-[1.5] text-fg-muted">
        <CalendarDays aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-fg-subtle" />
        <span className="line-clamp-2">{cls.nextSession || t("classes.detail.tba")}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        <LevelChip cefr={cefr}>{formatLevelLabel(cls.cefr, cls.level, t("classes.levelShort"))}</LevelChip>
        <Chip tone={isFull ? "danger" : urgent ? "warning" : "neutral"} icon={Users}>
          {isFull
            ? t("classes.statusFull")
            : `${t("classes.seatsLeftPrefix")} ${seatsLeft} ${t("classes.seatsLeftSuffix")}`}
        </Chip>
        <p className="ml-auto shrink-0 text-right leading-[1.4]">
          <span className="text-lg font-extrabold text-fg tabular-nums">
            {cls.price === 0 ? t("classes.free") : formatTHB(cls.price)}
          </span>
          {cls.price === 0 ? null : <span className="ml-1 text-xs text-fg-muted">{t("classes.perCourse")}</span>}
        </p>
      </div>
    </Link>
  );
}
