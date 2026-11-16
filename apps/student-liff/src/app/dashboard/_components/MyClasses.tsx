import Link from "next/link";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { Chip, IconTile, SectionHeader } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { getLevelTone, levelToneClass, normalizeCefr } from "@/lib/cefr";
import { noOrphan } from "@/lib/format";
import { buildEnrollmentHref, getEnrollmentKey, type Enrollment } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Tappable card: rim + 4px clay ledge, presses down onto it. */
const cardClass =
  "relative flex min-h-[76px] items-center gap-3.5 overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface py-3.5 pr-3 pl-[18px] text-left shadow-[var(--shadow-tap)] transition-[translate,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] [-webkit-tap-highlight-color:transparent] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]";

function ClassCard({ enrollment }: { enrollment: Enrollment }) {
  const progress = Math.round(enrollment.progress || 0);
  const cefr = normalizeCefr(enrollment.seriesCefr);
  const tone = getLevelTone(cefr);
  const meta = [`${t("dashboard.tutorPrefix")} ${enrollment.tutorName}`, cefr].filter(Boolean).join(" · ");
  return (
    <Link href={buildEnrollmentHref(enrollment)} className={cardClass}>
      {/* CEFR colour band on the leading edge (neutral when the book has no level). */}
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", levelToneClass[tone].solid)} />
      <IconTile icon={BookOpen} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        {enrollment.isLive ? (
          <Chip tone="danger" dot className="mb-0.5">
            {t("dashboard.liveNow")}
          </Chip>
        ) : null}
        <span className="t-row block line-clamp-2 text-balance text-fg">{noOrphan(enrollment.name)}</span>
        <span className="t-body-s block truncate text-fg-muted">{meta}</span>
      </span>
      <span className="shrink-0 text-sm leading-[1.4] font-semibold text-brand-fg tabular-nums">{progress}%</span>
      <ChevronRight aria-hidden="true" className="-ml-1 size-5 shrink-0 text-fg-subtle" />
    </Link>
  );
}

/**
 * "คลาสของฉัน" (patterns.md S1.4): header with count + "ดูทั้งหมด", then the
 * paid classes as a vertical list of tappable cards (CEFR band, tile, title,
 * "ครู … · A0", progress, chevron; each opens the class lobby), then a
 * "find a class" link. Two columns on tablets. Server-compatible.
 */
export function MyClasses({ classes, count }: { classes: Enrollment[]; count: number }) {
  return (
    <section aria-labelledby="my-classes-title">
      <SectionHeader
        title={<span id="my-classes-title">{t("dashboard.myClasses")}</span>}
        count={count > 0 ? count : undefined}
        action={{ label: t("common.seeAll"), href: "/classes" }}
      />
      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {classes.map((enrollment, index) => (
          <ClassCard key={getEnrollmentKey(enrollment, index)} enrollment={enrollment} />
        ))}
      </div>
      <Link href="/classes" className={cn(buttonVariants({ variant: "ghost", size: "touch" }), "mt-2 -ml-2")}>
        <Search aria-hidden="true" />
        {t("dashboard.findClass")}
      </Link>
    </section>
  );
}
