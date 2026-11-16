import { CheckCircle2, GraduationCap, Users } from "lucide-react";
import { Chip, UserAvatar } from "@/components/mobile";
import { formatLevelLabel, type CefrTone } from "@/lib/cefr";
import { getSeatInfo } from "@/lib/classAccess";
import { noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ToneHero } from "@/components/mobile/Hero";
import type { ClassDetail } from "./types";

/**
 * Full-bleed hero in the class's CEFR band colour (patterns.md S5.1): status
 * and level chips, the class name, the tutor line and the book. It continues
 * the tinted app bar above it; the first card below overlaps its bottom.
 */
export function ClassHero({ cls, tone }: { cls: ClassDetail; tone: CefrTone }) {
  const { seatsLeft, urgent } = getSeatInfo(cls.students, cls.maxStudents);
  const hours =
    cls.totalHours && cls.totalHours > 0
      ? `${t("classes.detail.liveHoursPrefix")} ${cls.totalHours} ${t("classes.detail.hourUnit")}`
      : null;

  return (
    <ToneHero tone={tone} aria-labelledby="class-hero-title">
      <div className="flex flex-wrap gap-2">
        {cls.isEnrolled ? (
          <Chip tone="success" size="md" icon={CheckCircle2}>
            {t("classes.detail.studying")}
          </Chip>
        ) : null}
        <Chip tone="paper" size="md" icon={GraduationCap}>
          {formatLevelLabel(cls.cefr, cls.level, t("classes.levelShort"))}
        </Chip>
        {cls.isEnrolled ? null : (
          <Chip tone={urgent ? "warning" : "paper"} size="md" icon={Users}>
            {seatsLeft <= 0
              ? t("classes.statusFull")
              : urgent
                ? `${t("classes.detail.remainingPrefix")} ${seatsLeft} ${t("classes.detail.seatsLeftSuffix")}`
                : `${seatsLeft} ${t("classes.detail.seatsAvailableSuffix")}`}
          </Chip>
        )}
      </div>
      <h2 id="class-hero-title" className="t-title-l mt-3 text-balance">
        {noOrphan(cls.name)}
      </h2>
      <p className="mt-2.5 flex min-w-0 items-center gap-2 text-[15px] leading-[1.6] font-semibold">
        <UserAvatar src={cls.tutor.pictureUrl} name={cls.tutor.name} size="sm" ring="surface" decorative />
        <span className="truncate">{`${t("classes.tutorPrefix")} ${cls.tutor.name}`}</span>
      </p>
      <p className="mt-1.5 text-sm leading-[1.6] text-pretty text-fg-muted">
        {cls.book}
        {hours ? ` · ${hours}` : ""}
      </p>
    </ToneHero>
  );
}
