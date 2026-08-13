import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPreparationArticle } from "../actions";
import PrepareLessonClient from "./PrepareLessonClient";

export default async function PreparationLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ articleId?: string; mode?: string }>;
}) {
  const { id: classId } = await params;
  const { articleId, mode } = await searchParams;
  const preparationMode = mode === "guided" ? "guided" : "explore";

  if (!articleId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-black text-foreground">ยังไม่ได้เลือกบทความ</h1>
          <p className="mt-2 text-sm text-muted-foreground">กลับไปเลือกบทความก่อนเริ่มเตรียมสอน</p>
          <Link href={`/lesson/${classId}/prepare`}>
            <Button className="mt-5 gap-2">
              <ArrowLeft className="size-4" /> กลับไปเลือกโหมด
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  try {
    const article = await getPreparationArticle(classId, articleId);
    return (
      <PrepareLessonClient
        classId={classId}
        article={article}
        mode={preparationMode}
      />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "โหลดบทเรียนไม่สำเร็จ";
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-black text-foreground">เปิดบทเรียนไม่ได้</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
          <Link href={`/lesson/${classId}/select?prepare=1&mode=${preparationMode}`}>
            <Button variant="outline" className="mt-5 gap-2">
              <ArrowLeft className="size-4" /> กลับไปเลือกบทความ
            </Button>
          </Link>
        </div>
      </div>
    );
  }
}
