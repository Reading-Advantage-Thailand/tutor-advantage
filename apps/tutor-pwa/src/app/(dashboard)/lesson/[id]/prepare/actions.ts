"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { getClassArticles } from "@/app/dashboard/classes/actions";

/**
 * Loads the full article for the private tutor preparation view.
 *
 * The class article list intentionally returns only display metadata. We
 * verify the article belongs to the tutor's class first, then use the
 * authenticated article endpoint to load vocabulary, questions and audio
 * metadata without creating a live lesson session.
 */
export async function getPreparationArticle(classId: string, articleId: string) {
  if (!classId || !articleId) throw new Error("Missing class or article");

  const classArticles = await getClassArticles(classId);
  const belongsToClass = (classArticles.articles || []).some(
    (article: { id?: string }) => article.id === articleId,
  );

  if (!belongsToClass) {
    throw new Error("บทความนี้ไม่อยู่ในคลาสที่คุณกำลังเตรียมสอน");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(
    `${LEARNING_URL}/v1/student/articles/${encodeURIComponent(articleId)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error("โหลดเนื้อหาบทเรียนไม่สำเร็จ");
  }

  const data = await response.json();
  return data.article ?? data;
}
