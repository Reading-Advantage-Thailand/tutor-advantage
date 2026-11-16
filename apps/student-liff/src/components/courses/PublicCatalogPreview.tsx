"use client";
import { AlertTriangle, CalendarX2, RotateCw } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { IconTile, LoadingAnnouncement, SectionHeader, Skeleton, StatStrip } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { publicCatalogStats, type PublicCourse } from "@/lib/publicCourses";
import { formatSatang } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CourseCardSkeleton } from "./CatalogSkeletons";
import { CourseCard } from "./CourseCard";

/** Container card: rim + soft shadow, no ledge. */
const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/**
 * Authored Thai break for a short static label: each phrase is nowrap and the only
 * break opportunity is the <wbr> between them ("หนังสือ / ในคลาส", never "หนังสือใน / คลาส").
 * The text content (and accessible name) stays the joined label.
 */
function Phrases({ parts }: { parts: readonly string[] }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <wbr /> : null}
      <span className="whitespace-nowrap">{part}</span>
    </Fragment>
  ));
}

/**
 * Landing facts + live catalogue (patterns.md S2.4–5): the three stats in ONE
 * divided card (static Kodchasan numbers), "คลาสที่เปิดขาย" + "ดูทั้งหมด", the
 * starting price and up to three course cards. Loading is a skeleton of that
 * layout; errors and the empty catalogue use a tone tile (the landing hero
 * already has the screen's one Reedy).
 */
export function PublicCatalogPreview({ className }: { className?: string }) {
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

  if (failed) {
    return (
      <section role="alert" className={cn(cardClass, "flex flex-col items-center px-5 py-6 text-center", className)}>
        <IconTile icon={AlertTriangle} tone="amber" size="lg" shape="circle" />
        <p className="t-title mt-3 text-fg">โหลดข้อมูลคลาสไม่สำเร็จ</p>
        <Button variant="brandSoft" size="touch" className="mt-4" onClick={() => setAttempt((value) => value + 1)}>
          <RotateCw aria-hidden="true" />
          ลองใหม่
        </Button>
      </section>
    );
  }

  if (!courses) {
    return (
      <section aria-busy="true" className={className}>
        <LoadingAnnouncement label="กำลังโหลดคลาสที่เปิดขาย..." />
        <div aria-hidden="true">
          <div className={cn(cardClass, "grid grid-cols-3 px-1 py-3.5")}>
            {[0, 1, 2].map((index) => (
              <div key={index} className={cn("flex flex-col items-center gap-2 px-1.5", index > 0 && "border-l-[1.5px] border-hairline")}>
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-[22px] flex min-h-11 items-center justify-between">
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <div className="mt-3">
            <CourseCardSkeleton />
          </div>
        </div>
      </section>
    );
  }

  const stats = publicCatalogStats(courses);
  const purchasable = courses.filter((course) => !course.full);
  return (
    <section className={className} aria-label="หลักสูตรที่เปิดขายจริง">
      <StatStrip
        items={[
          { value: stats.classes, label: <Phrases parts={["คลาส", "เปิดขาย"]} /> },
          { value: stats.books, label: <Phrases parts={["หนังสือ", "ในคลาส"]} /> },
          { value: stats.articles, label: <Phrases parts={["บทอ่าน", "ในหลักสูตร"]} /> },
        ]}
      />
      <SectionHeader
        className="mt-[22px]"
        title="คลาสที่เปิดขาย"
        action={{ label: "ดูทั้งหมด", href: "/courses" }}
      />
      {courses.length ? (
        <>
          {purchasable.length ? (
            <p className="t-body-s text-fg-muted">
              ราคาแพ็กเกจที่เปิดขายเริ่มต้น {formatSatang(Math.min(...purchasable.map((course) => course.packagePriceSatang)))} ต่อผู้เรียน
            </p>
          ) : null}
          <div className="mt-3 grid gap-3">
            {courses.slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} headingLevel="h3" />
            ))}
          </div>
        </>
      ) : (
        <div className={cn(cardClass, "flex items-center gap-3.5 p-4")}>
          <IconTile icon={CalendarX2} tone="neutral" size="sm" />
          <p className="t-body-s text-fg-muted">ยังไม่มีคลาสเปิดขายขณะนี้ ติดต่อทีมงานเพื่อสอบถามรอบถัดไป</p>
        </div>
      )}
    </section>
  );
}
