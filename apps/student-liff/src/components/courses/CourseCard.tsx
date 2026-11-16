import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/mobile/Chip";
import { LevelChip } from "@/components/mobile/LevelChip";
import { getLevelTone, levelToneClass } from "@/lib/cefr";
import { formatSatang } from "@/lib/format";
import type { PublicCourse } from "@/lib/publicCourses";
import { cn } from "@/lib/utils";

export interface CourseCardProps {
  course: PublicCourse;
  /** Title level: h2 on /courses (under the page h1), h3 under a section header. */
  headingLevel?: "h2" | "h3";
}

/**
 * Course card (patterns.md S2.5 / S3): a tappable card (rim + clay ledge)
 * with the CEFR colour band on top, the level chip, the class name, book and
 * reading count, tutor, schedule and the static price (Kodchasan 700 26).
 * Server-compatible.
 */
export function CourseCard({ course, headingLevel: Heading = "h2" }: CourseCardProps) {
  const tone = levelToneClass[getLevelTone(course.cefr)];
  return (
    <Link
      href={"/courses/" + course.id}
      className="relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-[18px] pt-[22px] pb-[18px] text-fg shadow-[var(--shadow-tap)] transition-[translate,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] [-webkit-tap-highlight-color:transparent] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]"
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-2", tone.solid)} />
      <LevelChip cefr={course.cefr} size="md" className="self-start">
        {course.program} · {course.cefr}
      </LevelChip>
      <Heading className="t-title-l mt-2 text-balance">{course.name}</Heading>
      <p className="t-body-s text-fg-muted">
        {course.book} · {course.articleCount} บทอ่าน
      </p>
      {course.tutor ? <p className="t-body-s text-fg">ติวเตอร์: {course.tutor}</p> : null}
      <p className="t-body-s text-fg-muted">{course.schedule || "ติดต่อทีมงานเพื่อยืนยันตารางเรียน"}</p>
      <span className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <span>
          <span className="font-heading text-[26px] leading-[1.2] font-bold text-brand-fg">
            {formatSatang(course.packagePriceSatang)}
          </span>{" "}
          <span className="t-body-s text-fg-muted">ต่อผู้เรียน/แพ็กเกจ</span>
        </span>
        {course.full ? (
          <Chip tone="danger" size="md" dot>
            คลาสเต็ม
          </Chip>
        ) : (
          <span className="inline-flex items-center gap-0.5 font-heading text-[15px] leading-[1.3] font-semibold text-brand-fg">
            ดูรายละเอียด
            <ChevronRight aria-hidden="true" className="size-5" />
          </span>
        )}
      </span>
    </Link>
  );
}
