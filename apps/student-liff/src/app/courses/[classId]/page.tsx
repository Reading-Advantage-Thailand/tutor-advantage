import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogRetry } from "@/components/courses/CatalogRetry";
import { PublicFooter } from "@/components/courses/PublicFooter";
import { getPublicCourse } from "@/lib/publicCourseServer";
import { formatSatang } from "@/lib/format";
import { checkoutPolicy } from "@/lib/content/legal";

export const metadata: Metadata = { title: "รายละเอียดคลาสภาษาอังกฤษ - Tutor Advantage" };
export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const course = await getPublicCourse(classId).catch(() => undefined);
  if (course === null) notFound();
  if (!course) return <main className="mx-auto max-w-2xl p-6 text-fg"><h1 className="text-xl font-bold">โหลดรายละเอียดคลาสไม่สำเร็จ</h1><CatalogRetry /><PublicFooter /></main>;
  const date = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" }).format(new Date(value));
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 text-fg">
    <Link href="/courses" className="text-sm font-semibold text-brand-fg">← คลาสเรียนทั้งหมด</Link>
    <article className="mt-5 space-y-5 rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-sm font-semibold text-brand-fg">{course.program} · {course.cefr}</p>
      <h1 className="text-2xl font-extrabold">{course.name}</h1>
      <p>คลาสภาษาอังกฤษกับติวเตอร์ ใช้หนังสือ {course.book} มีบทอ่าน {course.articleCount} เรื่อง พร้อม Reading Materials และ Assignments ผ่าน Student LIFF Portal</p>
      {course.tutor ? <p>ผู้สอน: {course.tutor}</p> : null}
      {course.lessonTitles?.length ? <section><h2 className="font-bold">บทเรียนในหนังสือ</h2><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-fg-muted">{course.lessonTitles.map((title, index) => <li key={index}>{title}</li>)}</ol></section> : null}
      <section><h2 className="font-bold">ตารางเรียน</h2><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{course.schedule || "ติดต่อทีมงานเพื่อยืนยันตารางเรียนก่อนสมัคร"}</p>
        {course.startsAt ? <p className="mt-2 text-sm">เริ่มเรียน: {date(course.startsAt)}</p> : null}
        {course.endsAt ? <p className="text-sm">สิ้นสุด: {date(course.endsAt)}</p> : null}
      </section>
      <section><h2 className="font-bold">สิ่งที่ได้รับและการส่งมอบ</h2><p className="mt-1 text-sm leading-relaxed">{checkoutPolicy.delivery}</p></section>
      <section><h2 className="font-bold">ยอดชำระต่อผู้เรียนต่อแพ็กเกจ</h2><p className="mt-2 text-3xl font-extrabold text-brand-fg">{formatSatang(course.packagePriceSatang)} <span className="text-sm">THB</span></p><p className="mt-2 text-sm text-fg-muted">ตรวจสอบยอดชำระอีกครั้งก่อนยืนยัน ชำระผ่าน PromptPay หรือบัตรเครดิต/เดบิต</p></section>
      <section><h2 className="font-bold">การยกเลิกและคืนเงิน</h2><p className="mt-1 text-sm leading-relaxed">{checkoutPolicy.refund}</p><Link href="/terms" className="inline-block py-3 text-sm font-semibold text-brand-fg underline">อ่านเงื่อนไขและขั้นตอนคืนเงินทั้งหมด</Link></section>
      {course.full ? <p className="rounded-xl bg-fill-muted p-4 text-center font-semibold">คลาสเต็มแล้ว</p> : <Link href={"/login?redirect=" + encodeURIComponent("/classes/" + course.id)} className="block rounded-xl bg-brand-solid px-4 py-4 text-center font-bold text-white">เข้าสู่ระบบ LINE เพื่อสมัครคลาสนี้</Link>}
    </article>
    <PublicFooter />
  </main>;
}
