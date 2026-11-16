import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
// Deep imports keep the client barrel out of this server component.
import { EmptyState, ErrorState } from "@/components/mobile/Feedback";
import { Screen } from "@/components/mobile/Screen";
import { CourseCard } from "@/components/courses/CourseCard";
import { CatalogRetry } from "@/components/courses/CatalogRetry";
import { AppBar } from "@/components/mobile/AppBar";
import { PublicFooter } from "@/components/courses/PublicFooter";
import { getPublicCourses } from "@/lib/publicCourseServer";
import { thaiCopy } from "@/lib/thaiText";

export const metadata: Metadata = { title: "คลาสภาษาอังกฤษที่เปิดขาย - Tutor Advantage" };
export const dynamic = "force-dynamic";

/**
 * Public course catalogue (patterns.md S3): app bar → one-line intro →
 * vertical course cards (two columns on tablets) → contact + footer links.
 * Load error: Reedy oops + retry; empty: Reedy calm.
 */
export default async function CoursesPage() {
  const courses = await getPublicCourses().catch(() => null);
  return (
    <Screen>
      <AppBar title="คลาสเรียนที่เปิดขาย" backHref="/" backLabel="Tutor Advantage" />
      <div className="mx-auto w-full max-w-2xl px-4 pt-2 pb-[calc(24px+var(--safe-bottom))] text-fg">
        <p className="t-body-s text-fg-muted">
          {thaiCopy("Reading Advantage และ Primary Advantage เรียนกับติวเตอร์ตามตารางของแต่ละคลาส ตรวจสอบรายละเอียดและยอดชำระได้ก่อนเข้าสู่ระบบ LINE")}
        </p>
        <div className="mt-5">
          {courses === null ? (
            <ErrorState
              card
              title="โหลดข้อมูลคลาสไม่สำเร็จ"
              description="กรุณาลองใหม่"
              secondaryAction={<CatalogRetry />}
            />
          ) : courses.length === 0 ? (
            <EmptyState
              card
              icon={CalendarX2}
              tone="neutral"
              title="ยังไม่มีคลาสเปิดขายขณะนี้"
              description="ติดต่อทีมงานเพื่อสอบถามรอบเรียนถัดไป"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
        <PublicFooter />
      </div>
    </Screen>
  );
}
