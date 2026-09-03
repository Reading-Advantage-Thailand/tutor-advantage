"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Compass, GraduationCap, MousePointer2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PrepareLessonModePage() {
  const params = useParams();
  const classId = params.id as string;
  const [articleId, setArticleId] = useState<string | null>(null);

  useEffect(() => {
    setArticleId(new URLSearchParams(window.location.search).get("articleId"));
  }, []);

  const modeHref = (mode: "explore" | "guided") => {
    if (articleId) {
      return `/lesson/${classId}/prepare/lesson?articleId=${encodeURIComponent(articleId)}&mode=${mode}`;
    }
    return `/lesson/${classId}/select?prepare=1&mode=${mode}`;
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-10 lg:pb-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/lesson/${classId}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lesson preparation</p>
            <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">เตรียมสอน</h1>
          </div>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm sm:flex">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          พื้นที่ซ้อมส่วนตัว
        </span>
      </div>

      <Card className="relative mb-8 overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/[0.14] via-card to-fuchsia-500/[0.07] shadow-sm">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-24 size-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <CardContent className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] lg:items-center lg:p-10">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Tutor preparation</p>
                <p className="mt-0.5 text-xs text-muted-foreground">ซ้อมก่อนเปิดห้องเรียนจริง</p>
              </div>
            </div>
            <h2 className="max-w-2xl text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
              เลือกวิธีซ้อมที่เข้ากับคุณ
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              ทำความคุ้นเคยกับ Lesson เดียวกับที่จะใช้สอนจริง ทดลองทุก Phase ได้อย่างปลอดภัย แล้วเลือกว่าจะเดินตามจังหวะของตัวเองหรือให้ระบบพาไปทีละขั้น
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-violet-500/20 bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground">
                {articleId ? "บทเรียนที่เลือกไว้พร้อมซ้อม" : "เลือกบทเรียนในขั้นถัดไป"}
              </span>
              <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                ไม่มีนักเรียนเข้าร่วม
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-background/65 p-5 shadow-lg shadow-violet-500/5 backdrop-blur-sm dark:border-white/10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Your rehearsal flow</p>
            <div className="mt-5 space-y-4">
              {[
                ["01", "เลือกสไตล์การซ้อม", "อิสระ หรือ มีไกด์"],
                ["02", "ทดลอง Lesson จริง", "เนื้อหาและ Phase เดียวกับคลาส"],
                ["03", "พร้อมเข้าสอน", "กลับมาเริ่มใหม่ได้ทุกเมื่อ"],
              ].map(([step, title, description]) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-[11px] font-black text-violet-600 dark:text-violet-300">
                    {step}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Choose your rehearsal style</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">คุณอยากเริ่มแบบไหน?</h2>
        </div>
        <p className="text-sm text-muted-foreground">เปลี่ยนโหมดได้ภายหลัง ไม่กระทบข้อมูลการสอนจริง</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Link
          href={modeHref("explore")}
          aria-label="เริ่มโหมดสำรวจอิสระ"
          className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-4"
        >
          <Card className="relative h-full overflow-hidden border-2 border-sky-500/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-sky-500/70 group-hover:shadow-xl group-hover:shadow-sky-500/10 group-focus-visible:border-sky-500">
            <div aria-hidden="true" className="absolute -right-16 -top-16 size-44 rounded-full bg-sky-500/[0.08] transition-transform duration-500 group-hover:scale-125" />
            <CardContent className="relative flex min-h-[370px] flex-col p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 transition-transform duration-300 group-hover:scale-110 dark:text-sky-300">
                  <Compass className="size-7" />
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                  <Clock3 className="size-3.5" /> ตามเวลาของคุณ
                </span>
              </div>
              <div className="mt-6">
                <h3 className="text-2xl font-black tracking-tight text-foreground">สำรวจอิสระ</h3>
                <p className="mt-2 text-sm font-semibold text-sky-700 dark:text-sky-300">เหมาะกับคนที่อยากทำความคุ้นเคยด้วยตัวเอง</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  เปิดดูเนื้อหา เลือกฟังคำศัพท์หรือประโยค และกดเปลี่ยน Phase ได้ตามจังหวะของคุณ ไม่มีลำดับตายตัว
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {["เลือก Phase ที่อยากดูได้ทันที", "ทดลองบทอ่าน เสียง และกิจกรรมใน Lesson", "เหมาะกับการกลับมาทบทวนจุดที่คุ้นเคยแล้ว"].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="mt-0.5 size-4 shrink-0 text-sky-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <span className="mt-auto flex items-center gap-2 pt-8 text-sm font-black text-sky-700 dark:text-sky-300">
                เริ่มสำรวจบทเรียน <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={modeHref("guided")}
          aria-label="เริ่ม Demo แบบมีไกด์"
          className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4"
        >
          <Card className="relative h-full overflow-hidden border-2 border-violet-500/25 bg-gradient-to-br from-violet-500/[0.04] via-card to-fuchsia-500/[0.05] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-violet-500/80 group-hover:shadow-xl group-hover:shadow-violet-500/10 group-focus-visible:border-violet-500">
            <div aria-hidden="true" className="absolute -right-16 -top-16 size-44 rounded-full bg-violet-500/[0.1] transition-transform duration-500 group-hover:scale-125" />
            <CardContent className="relative flex min-h-[370px] flex-col p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 transition-transform duration-300 group-hover:scale-110 dark:text-violet-300">
                  <MousePointer2 className="size-7" />
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-700 dark:text-violet-300">
                  <Sparkles className="size-3.5" /> แนะนำสำหรับครั้งแรก
                </span>
              </div>
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-black tracking-tight text-foreground">Demo แบบมีไกด์</h3>
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:text-violet-300">GUIDED</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-violet-700 dark:text-violet-300">เหมาะกับคนที่อยากเห็นภาพรวมครบทุกขั้นตอน</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  ระบบจะไฮไลต์จุดที่ต้องกดทีละขั้น พร้อมอธิบายว่าช่วงนี้ทำอะไรและควรพูดกับนักเรียนอย่างไร
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {["พาเดินครบลำดับ Phase ของ Lesson", "จำลองการโต้ตอบและคำตอบของนักเรียน", "มีคำแนะนำสำหรับ Tutor ระหว่างการซ้อม"].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="mt-0.5 size-4 shrink-0 text-violet-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <span className="mt-auto flex items-center gap-2 pt-8 text-sm font-black text-violet-700 dark:text-violet-300">
                เริ่ม Demo พร้อมไกด์ <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mt-7 border-border/70 bg-muted/20 shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground">ทั้งสองโหมดใช้ Lesson จริงเหมือนกัน</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">ต่างกันแค่รูปแบบการพาเรียนรู้ เนื้อหาและกิจกรรมจะอิงจากบทเรียนที่คุณเลือก</p>
              </div>
            </div>
            <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 lg:min-w-[430px]">
              {["ไม่สร้าง Live session", "ไม่มีคะแนนหรือผลกระทบจริง", "กลับมาเริ่มใหม่ได้เสมอ"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
                  <BookOpen className="size-3.5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
