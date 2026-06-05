"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";

export interface DemoLessonSummary {
  articleId: string;
  level: number;
  cefr: string;
  title: string;
  summary: string;
  genre: string | null;
}

export async function getDemoLessons(): Promise<DemoLessonSummary[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/demo/lessons`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch demo lessons");
  }

  const data = (await res.json()) as { lessons: DemoLessonSummary[] };
  return data.lessons || [];
}
