import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/courses/CourseCard";
import { CatalogRetry } from "@/components/courses/CatalogRetry";
import { PublicFooter } from "@/components/courses/PublicFooter";
import { getPublicCourses } from "@/lib/publicCourseServer";

export const metadata: Metadata = { title: "คลาสภาษาอังกฤษที่เปิดขาย - Tutor Advantage" };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await getPublicCourses().catch(() => null);
  return <main className="mx-auto w-full max-w-4xl px-4 py-8 text-fg">
    <Link href="/" className="text-sm font-semibold text-brand-fg">← Tutor Advantage</Link>
    <h1 className="mt-6 text-2xl font-extrabold">คลาสภาษาอังกฤษที่เปิดขาย</h1>
    <p className="mt-2 text-sm leading-relaxed text-fg-muted">Reading Advantage และ Primary Advantage เรียนกับติวเตอร์ตามตารางของแต่ละคลาส ตรวจสอบรายละเอียดและยอดชำระได้ก่อนเข้าสู่ระบบ LINE</p>
    <div className="mt-6">
      {courses === null ? <div role="alert" className="rounded-2xl border border-hairline bg-surface p-5">โหลดข้อมูลคลาสไม่สำเร็จ กรุณาลองใหม่<CatalogRetry /></div>
        : courses.length === 0 ? <p className="rounded-2xl bg-surface p-5">ยังไม่มีคลาสเปิดขายขณะนี้ ติดต่อทีมงานเพื่อสอบถามรอบเรียนถัดไป</p>
        : <div className="grid gap-4 sm:grid-cols-2">{courses.map((course) => <CourseCard key={course.id} course={course} />)}</div>}
    </div>
    <PublicFooter />
  </main>;
}
