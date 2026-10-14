// Relative imports: the root vitest config maps "@" to another app.
import { StudentApiError, studentApi } from "../../../../lib/api";
import type { ClassArticleDetail, ClassDetail, TutorReview } from "./types";

export function fetchClassDetail(classId: string): Promise<{ class: ClassDetail }> {
  return studentApi.getClassDetails(classId);
}

/**
 * Lessons of one book cycle ("" = the server's default cycle). 402 (book not
 * paid) means "no lessons to show", as before; any other failure is thrown so
 * the screen can offer a retry (it used to be swallowed, leaving an empty list).
 */
export async function fetchClassArticles(classId: string, cycleId: string): Promise<ClassArticleDetail[]> {
  try {
    const data = await studentApi.getClassArticles(classId, cycleId || undefined);
    return data.articles || [];
  } catch (error) {
    if (error instanceof StudentApiError && error.status === 402) return [];
    throw error;
  }
}

/** The student's own review; a failed load counts as "no review yet" (unchanged behaviour). */
export async function fetchClassReview(classId: string): Promise<{ review: TutorReview | null }> {
  try {
    const data = await studentApi.getClassReview(classId);
    return { review: data.review || null };
  } catch {
    return { review: null };
  }
}
