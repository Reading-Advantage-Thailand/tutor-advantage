import Link from "next/link";
import { Search } from "lucide-react";
import { Chip, HScroll, IconTile, LevelChip, ProgressBar, SectionHeader } from "@/components/mobile";
import { getLevelTone, levelToneClass, normalizeCefr } from "@/lib/cefr";
import { buildEnrollmentHref, getEnrollmentKey, type Enrollment } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";

const cardClass =
  "pressable flex shrink-0 flex-col rounded-[var(--radius-card)] border border-hairline bg-surface p-4 text-left shadow-[var(--shadow-card)] active:bg-press";

function ClassCard({ enrollment }: { enrollment: Enrollment }) {
  const progress = Math.round(enrollment.progress || 0);
  const cefr = normalizeCefr(enrollment.seriesCefr);
  return (
    <Link
      href={buildEnrollmentHref(enrollment)}
      className={`${cardClass} relative w-[78%] max-w-[300px] gap-1 overflow-hidden pt-5`}
    >
      {/* Level colour band; brand green when the book has no CEFR level. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1.5 ${cefr ? levelToneClass[getLevelTone(cefr)].solid : "bg-brand-vivid"}`}
      />
      {enrollment.isLive || cefr ? (
        <span className="mb-1 flex flex-wrap items-center gap-1.5">
          {enrollment.isLive ? (
            <Chip tone="danger" dot>
              {t("dashboard.liveNow")}
            </Chip>
          ) : null}
          {cefr ? <LevelChip cefr={cefr} /> : null}
        </span>
      ) : null}
      <span className="line-clamp-2 text-[15px] leading-[1.5] font-bold text-fg">{enrollment.name}</span>
      <span className="truncate text-[13px] leading-[1.5] text-fg-muted">
        {t("dashboard.tutorPrefix")} {enrollment.tutorName}
      </span>
      <span className="mt-auto flex items-center gap-2 pt-3">
        <ProgressBar value={progress} size="sm" label={t("dashboard.progressLabel")} className="flex-1" />
        <span className="shrink-0 text-xs leading-[1.5] font-semibold text-brand-fg tabular-nums">{progress}%</span>
      </span>
    </Link>
  );
}

/**
 * "คลาสของฉัน": paid classes as a snapping horizontal carousel (each card opens
 * the class lobby), ending with a "find a class" card. Server-compatible.
 */
export function MyClasses({ classes, count }: { classes: Enrollment[]; count: number }) {
  return (
    <section aria-labelledby="my-classes-title">
      <SectionHeader
        title={<span id="my-classes-title">{t("dashboard.myClasses")}</span>}
        count={count > 0 ? count : undefined}
        action={{ label: t("common.seeAll"), href: "/classes" }}
      />
      <HScroll snap gap={12}>
        {classes.map((enrollment, index) => (
          <ClassCard key={getEnrollmentKey(enrollment, index)} enrollment={enrollment} />
        ))}
        <Link href="/classes" className={`${cardClass} w-[140px] items-center justify-center gap-2 text-center`}>
          <IconTile icon={Search} tone="brand" />
          <span className="text-sm leading-[1.5] font-semibold text-brand-fg">{t("dashboard.findClass")}</span>
        </Link>
      </HScroll>
    </section>
  );
}
