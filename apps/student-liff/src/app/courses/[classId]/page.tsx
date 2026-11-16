import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, BookOpenText, CalendarDays, ChevronRight, CircleX, GraduationCap, PackageCheck, Receipt, Undo2, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
// Deep imports keep the client barrel out of this server component.
import { Chip } from "@/components/mobile/Chip";
import { BottomActionBar, StatusScreen } from "@/components/mobile/Feedback";
import { IconTile, type IconTileTone } from "@/components/mobile/IconTile";
import { Screen } from "@/components/mobile/Screen";
import { UserAvatar } from "@/components/mobile/UserAvatar";
import { CatalogRetry } from "@/components/courses/CatalogRetry";
import { AppBar } from "@/components/mobile/AppBar";
import { PublicFooter } from "@/components/courses/PublicFooter";
import { getPublicCourse } from "@/lib/publicCourseServer";
import { formatSatang } from "@/lib/format";
import { checkoutPolicy } from "@/lib/content/legal";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { getLevelTone, levelToneClass } from "@/lib/cefr";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "รายละเอียดคลาสภาษาอังกฤษ - Tutor Advantage" };
export const dynamic = "force-dynamic";

/**
 * One section of the detail page: a container card (rim, no ledge) with a tile + Kodchasan title.
 * The title keeps Thai compounds whole (keepThaiWords), so a balanced title never cuts a word.
 */
function DetailCard({ icon, tone, title, children }: { icon: LucideIcon; tone: IconTileTone; title?: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-[18px] shadow-[var(--shadow-card)]">
      {title ? (
        <div className="mb-2.5 flex items-center gap-3">
          <IconTile icon={icon} tone={tone} size="sm" />
          <h2 className="t-title text-balance text-fg">{keepThaiWords(title)}</h2>
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Public course detail (patterns.md S3): a hero in the course's CEFR tone
 * (title, level / book / tutor chips) under a transparent app bar, then the
 * sections as cards (what you learn, schedule, price, tutor, delivery,
 * cancellation) and a sticky bottom bar with the one primary action.
 */
export default async function CoursePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const course = await getPublicCourse(classId).catch(() => undefined);
  if (course === null) notFound();
  if (!course) {
    return (
      <Screen>
        <AppBar title="รายละเอียดคลาสภาษาอังกฤษ" titleAs="p" backHref="/courses" backLabel="คลาสเรียนทั้งหมด" />
        <StatusScreen
          as="h1"
          icon={CircleX}
          tone="amber"
          title="โหลดรายละเอียดคลาสไม่สำเร็จ"
          primaryAction={<CatalogRetry className="w-full" />}
          className="min-h-[50dvh]"
        />
        <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(24px+var(--safe-bottom))]">
          <PublicFooter />
        </div>
      </Screen>
    );
  }
  const date = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" }).format(new Date(value));
  const tone = levelToneClass[getLevelTone(course.cefr)];
  return (
    <Screen>
      <AppBar
        title={course.name}
        titleAs="p"
        titleOnScroll
        variant="transparent"
        backHref="/courses"
        backLabel="คลาสเรียนทั้งหมด"
      />

      {/* Hero in the course's CEFR tone; it runs up under the transparent app bar. */}
      <header
        className={cn(
          "-mt-[calc(var(--appbar-h)+var(--safe-top))] rounded-b-[32px] pt-[calc(var(--appbar-h)+var(--safe-top)+4px)] pb-7",
          tone.soft,
        )}
      >
        {/* Same box as the cards below (padding inside the max width), so title, chips and cards share one left edge. */}
        <div className="mx-auto w-full max-w-2xl px-4">
          <h1 className="t-title-l text-balance text-fg">{course.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="paper" size="md" icon={GraduationCap}>
              {course.program} · {course.cefr}
            </Chip>
            <Chip tone="paper" size="md" icon={BookOpen}>
              {course.book}
            </Chip>
            {course.tutor ? (
              <Chip tone="paper" size="md" icon={UserRound}>
                {course.tutor}
              </Chip>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4 pb-6 text-fg">
        <DetailCard icon={BookOpenText} tone="brand">
          {/* The copy keeps its phrases whole; the book title is data and wraps as it is. */}
          <p className="t-body">
            {keepThaiWords("คลาสภาษาอังกฤษกับติวเตอร์ ใช้หนังสือ ")}
            {course.book}
            {keepThaiWords(` มีบทอ่าน ${course.articleCount} เรื่อง พร้อม Reading Materials และ Assignments ผ่าน Student LIFF Portal`)}
          </p>
          {course.lessonTitles?.length ? (
            <div className="mt-4">
              <h2 className="t-title-s text-fg">บทเรียนในหนังสือ</h2>
              <ol className="mt-2 rounded-lg bg-surface-muted px-3.5 py-2.5 sm:columns-2 sm:gap-6">
                {course.lessonTitles.map((title, index) => (
                  <li key={index} className="flex break-inside-avoid items-baseline gap-3 py-1">
                    <span aria-hidden="true" className="w-6 shrink-0 text-right text-sm leading-[1.6] font-semibold text-fg-muted tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 text-[15px] leading-[1.6] text-fg" lang="en">
                      <span className="sr-only">{index + 1}. </span>
                      {title}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </DetailCard>

        <DetailCard icon={CalendarDays} tone="purple" title="ตารางเรียน">
          <p className="t-body-s whitespace-pre-line text-fg-muted">
            {course.schedule || <span className="block text-balance">{thaiCopy("ติดต่อทีมงานเพื่อยืนยันตารางเรียนก่อนสมัคร")}</span>}
          </p>
          {course.startsAt ? <p className="t-body-s mt-2">เริ่มเรียน: {date(course.startsAt)}</p> : null}
          {course.endsAt ? <p className="t-body-s">สิ้นสุด: {date(course.endsAt)}</p> : null}
        </DetailCard>

        <DetailCard icon={Receipt} tone="orange" title="ยอดชำระต่อผู้เรียนต่อแพ็กเกจ">
          <p className="mt-1">
            <span className="font-heading text-[32px] leading-[1.2] font-bold text-brand-fg">{formatSatang(course.packagePriceSatang)}</span>{" "}
            <span className="t-body-s text-fg-muted">THB</span>
          </p>
          <p className="t-body-s mt-2 text-fg-muted">{thaiCopy("ตรวจสอบยอดชำระอีกครั้งก่อนยืนยัน ชำระผ่าน PromptPay หรือบัตรเครดิต/เดบิต")}</p>
        </DetailCard>

        {course.tutor ? (
          <section className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4 shadow-[var(--shadow-card)]">
            <UserAvatar name={course.tutor} decorative />
            <p className="min-w-0 text-base leading-[1.6] font-semibold text-fg">ผู้สอน: {course.tutor}</p>
          </section>
        ) : null}

        <DetailCard icon={PackageCheck} tone="teal" title="สิ่งที่ได้รับและการส่งมอบ">
          <p className="t-body-s">{keepThaiWords(checkoutPolicy.delivery)}</p>
        </DetailCard>

        <DetailCard icon={Undo2} tone="neutral" title="การยกเลิกและคืนเงิน">
          <p className="t-body-s">{keepThaiWords(checkoutPolicy.cancellation)}</p>
          <p className="t-body-s mt-1">{keepThaiWords(checkoutPolicy.refund)}</p>
          <Link
            href="/terms"
            className="mt-1 -mb-2 inline-flex min-h-11 items-center font-heading text-[15px] leading-[1.6] font-semibold text-brand-fg underline decoration-brand-fg/40 underline-offset-4"
          >
            {/* The chevron rides with the last phrase so it stays beside the text when the link wraps. */}
            <span>
              <span className="whitespace-nowrap">อ่านเงื่อนไขและขั้นตอน</span>
              <wbr />
              <span className="whitespace-nowrap">
                คืนเงินทั้งหมด
                <ChevronRight aria-hidden="true" className="ml-0.5 inline size-4 align-[-2px]" />
              </span>
            </span>
          </Link>
        </DetailCard>

        <PublicFooter />
      </div>

      <BottomActionBar>
        {course.full ? (
          <p className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-[20px] bg-surface-muted px-4 text-center font-heading text-[17px] leading-[1.3] font-semibold text-fg-muted">
            <CircleX aria-hidden="true" className="size-5 shrink-0" />
            คลาสเต็มแล้ว
          </p>
        ) : (
          <Link
            href={"/login?redirect=" + encodeURIComponent("/classes/" + course.id)}
            className={cn(buttonVariants({ variant: "brand", size: "cta-lg" }), "h-auto min-h-14 w-full py-2 text-center whitespace-normal")}
          >
            {/* Authored break between the two phrases on narrow phones. */}
            <span>
              <span className="whitespace-nowrap">เข้าสู่ระบบ LINE</span> <span className="whitespace-nowrap">เพื่อสมัครคลาสนี้</span>
            </span>
          </Link>
        )}
      </BottomActionBar>
    </Screen>
  );
}
