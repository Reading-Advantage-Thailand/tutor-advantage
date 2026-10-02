import { CheckCircle2, GraduationCap, Users } from "lucide-react";
import { Chip } from "@/components/mobile";
import { formatLevelLabel } from "@/lib/cefr";
import { getSeatInfo } from "@/lib/classAccess";
import { t } from "@/lib/i18n";
import type { ClassDetail } from "./types";

/** Friendly green header card: level + seats (or "studying") chips, class name, book. */
export function ClassHero({ cls }: { cls: ClassDetail }) {
  const { seatsLeft, urgent } = getSeatInfo(cls.students, cls.maxStudents);
  const hours =
    cls.totalHours && cls.totalHours > 0
      ? `${t("classes.detail.liveHoursPrefix")} ${cls.totalHours} ${t("classes.detail.hourUnit")}`
      : null;

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-brand p-5 text-white shadow-[var(--shadow-card)]">
      <span aria-hidden="true" className="pointer-events-none absolute -top-12 -right-10 size-36 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap gap-2">
        {cls.isEnrolled ? (
          <Chip tone="onBrand" size="md" icon={CheckCircle2}>
            {t("classes.detail.studying")}
          </Chip>
        ) : null}
        <Chip tone="onBrand" size="md" icon={GraduationCap}>
          {formatLevelLabel(cls.cefr, cls.level, t("classes.levelShort"))}
        </Chip>
        {cls.isEnrolled ? null : (
          <Chip tone={urgent ? "warning" : "onBrand"} size="md" icon={Users}>
            {seatsLeft <= 0
              ? t("classes.statusFull")
              : urgent
                ? `${t("classes.detail.remainingPrefix")} ${seatsLeft} ${t("classes.detail.seatsLeftSuffix")}`
                : `${seatsLeft} ${t("classes.detail.seatsAvailableSuffix")}`}
          </Chip>
        )}
      </div>
      <h2 className="relative mt-3 text-[22px] leading-[1.45] font-extrabold">{cls.name}</h2>
      <p className="relative mt-1 text-sm leading-[1.6] text-white/85">
        {cls.book}
        {hours ? ` · ${hours}` : ""}
      </p>
    </section>
  );
}
