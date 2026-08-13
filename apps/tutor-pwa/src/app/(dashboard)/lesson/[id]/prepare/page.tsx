"use client";

import { ArrowLeft, BookOpen, Compass, GraduationCap, MousePointer2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PrepareLessonModePage() {
  const params = useParams();
  const router = useRouter();
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
    <div className="mx-auto min-w-0 w-full max-w-none px-4 pb-24 sm:px-6 lg:px-10 lg:pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/lesson/${classId}`}>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">เตรียมสอน</h1>
          <p className="text-sm text-muted-foreground">เลือกวิธีเตรียมตัวก่อนเข้าสอนบทเรียนจริง</p>
        </div>
      </div>

      <Card className="mb-6 overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-card to-fuchsia-500/5">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Tutor preparation</p>
              <h2 className="mt-1 text-xl font-black text-foreground">ซ้อมให้พร้อม ก่อนเริ่มห้องเรียน</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                เลือกบทความเดียวกับที่จะใช้สอน แล้วทดลองฟังคำศัพท์ ดูคำถาม และทำความเข้าใจขั้นตอนต่าง ๆ ได้โดยไม่สร้างห้องเรียนหรือรอนักเรียน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <button
          type="button"
          onClick={() => router.push(modeHref("explore"))}
          className="group text-left"
        >
          <Card className="h-full border-2 border-sky-500/20 transition-all duration-300 hover:border-sky-500 hover:shadow-xl hover:shadow-sky-500/10">
            <CardContent className="flex min-h-[265px] flex-col p-7">
              <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 transition-transform duration-300 group-hover:scale-110 dark:text-sky-300">
                <Compass className="size-7" />
              </div>
              <h3 className="text-xl font-black text-foreground">สำรวจอิสระ</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                เปิดดูเนื้อหาเอง เลือกฟังคำศัพท์หรือประโยคที่อยากทบทวน และกดเปลี่ยนขั้นตอนได้ตามจังหวะของคุณ
              </p>
              <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-bold text-sky-600 dark:text-sky-300">
                <BookOpen className="size-4" /> เลือกบทความเพื่อเริ่มสำรวจ
              </span>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => router.push(modeHref("guided"))}
          className="group text-left"
        >
          <Card className="h-full border-2 border-violet-500/25 transition-all duration-300 hover:border-violet-500 hover:shadow-xl hover:shadow-violet-500/10">
            <CardContent className="flex min-h-[265px] flex-col p-7">
              <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 transition-transform duration-300 group-hover:scale-110 dark:text-violet-300">
                <MousePointer2 className="size-7" />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-xl font-black text-foreground">Demo แบบมีไกด์</h3>
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-black text-violet-600 dark:text-violet-300">แนะนำ</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                ระบบจะไฮไลต์จุดที่ต้องกดทีละขั้น พร้อมกล่องคำอธิบายว่าช่วงนี้ต้องทำอะไรและควรพูดกับนักเรียนอย่างไร
              </p>
              <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-bold text-violet-600 dark:text-violet-300">
                <Sparkles className="size-4" /> เดินตาม Guide ทีละขั้น
              </span>
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Sparkles className="size-4 shrink-0 text-violet-500" />
        โหมดเตรียมสอนเป็นพื้นที่ซ้อมส่วนตัว ไม่มีนักเรียน ไม่มีคะแนน และไม่สร้าง Live session
      </div>
    </div>
  );
}
