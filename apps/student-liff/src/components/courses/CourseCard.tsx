import Link from "next/link";
import { formatSatang } from "@/lib/format";
import type { PublicCourse } from "@/lib/publicCourses";

export function CourseCard({ course }: { course: PublicCourse }) {
  return (
    <Link href={"/courses/" + course.id} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-5 text-fg shadow-sm focus-visible:outline-2 focus-visible:outline-brand-solid">
      <p className="text-xs font-semibold text-brand-fg">{course.program} · {course.cefr}</p>
      <h2 className="text-lg font-bold">{course.name}</h2>
      <p className="text-sm text-fg-muted">{course.book} · {course.articleCount} บทอ่าน</p>
      {course.tutor ? <p className="text-sm">ติวเตอร์: {course.tutor}</p> : null}
      <p className="text-sm leading-relaxed text-fg-muted">{course.schedule || "ติดต่อทีมงานเพื่อยืนยันตารางเรียน"}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span className="text-lg font-bold text-brand-fg">{formatSatang(course.packagePriceSatang)} <span className="text-xs font-normal">ต่อผู้เรียน/แพ็กเกจ</span></span>
        <span className="text-xs font-semibold">{course.full ? "คลาสเต็ม" : "ดูรายละเอียด"}</span>
      </div>
    </Link>
  );
}
