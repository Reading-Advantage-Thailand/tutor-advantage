"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { publicCatalogStats, type PublicCourse } from "@/lib/publicCourses";
import { formatSatang } from "@/lib/format";
import { CourseCard } from "./CourseCard";

export function PublicCatalogPreview() {
  const [attempt, setAttempt] = useState(0);
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setCourses(null);
    fetch("/api/public/classes", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
        return response.json() as Promise<{ classes: PublicCourse[] }>;
      })
      .then((data) => { if (!controller.signal.aborted) setCourses(data.classes); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  if (failed) return <section role="alert" className="rounded-2xl bg-surface p-5 text-sm text-fg">โหลดข้อมูลคลาสไม่สำเร็จ<br /><button type="button" className="min-h-11 font-bold text-brand-fg" onClick={() => setAttempt((value) => value + 1)}>ลองใหม่</button></section>;
  if (!courses) return <section aria-busy="true" className="rounded-2xl bg-surface p-5 text-fg-muted">กำลังโหลดคลาสที่เปิดขาย...</section>;
  const stats = publicCatalogStats(courses);
  const purchasable = courses.filter((course) => !course.full);
  return <section className="space-y-4" aria-label="หลักสูตรที่เปิดขายจริง">
    <div className="grid grid-cols-3 gap-2">
      {[[stats.classes, "คลาสเปิดขาย"], [stats.books, "หนังสือในคลาส"], [stats.articles, "บทอ่านในหลักสูตร"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-hairline bg-surface p-3 text-center"><p className="text-xl font-bold text-fg">{value}</p><p className="mt-1 text-xs text-fg-muted">{label}</p></div>)}
    </div>
    <div className="flex items-center justify-between"><h2 className="font-bold text-fg">คลาสที่เปิดขาย</h2><Link href="/courses" className="py-3 text-sm font-semibold text-brand-fg">ดูทั้งหมด →</Link></div>
    {courses.length ? <>
      {purchasable.length ? <p className="text-sm text-fg-muted">ราคาแพ็กเกจที่เปิดขายเริ่มต้น {formatSatang(Math.min(...purchasable.map((course) => course.packagePriceSatang)))} ต่อผู้เรียน</p> : null}
      {courses.slice(0, 3).map((course) => <CourseCard key={course.id} course={course} />)}
    </> : <p className="text-sm text-fg-muted">ยังไม่มีคลาสเปิดขายขณะนี้ ติดต่อทีมงานเพื่อสอบถามรอบถัดไป</p>}
  </section>;
}
