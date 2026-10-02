"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { getLessonArticles } from "../_lib/server";

/**
 * Loads the full article for the private tutor preparation view.
 *
 * The class article list intentionally returns only display metadata. We
 * verify the article belongs to the tutor's class, then use the
 * authenticated article endpoint to load vocabulary, questions and audio
 * metadata without creating a live lesson session. Both requests run in
 * parallel; the article is only returned once membership is confirmed.
 */
export async function getPreparationArticle(classId: string, articleId: string) {
  if (!classId || !articleId) throw new Error("Missing class or article");

  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const articleRequest = fetch(`${LEARNING_URL}/v1/student/articles/${encodeURIComponent(articleId)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  // Avoid an unhandled rejection if the membership check fails first.
  articleRequest.catch(() => undefined);

  const classArticles = await getLessonArticles(classId);
  if (!classArticles.some((article) => article.id === articleId)) {
    throw new Error("บทความนี้ไม่อยู่ในคลาสที่คุณกำลังเตรียมสอน");
  }

  const response = await articleRequest;
  if (!response.ok) {
    throw new Error("โหลดเนื้อหาบทเรียนไม่สำเร็จ");
  }

  const data = await response.json();
  return data.article ?? data;
}
