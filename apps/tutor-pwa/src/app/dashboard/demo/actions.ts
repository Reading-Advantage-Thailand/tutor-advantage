"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { revalidatePath } from "next/cache";

export interface Book {
  bookId: string;
  bookCode: string;
  title: string;
  cefrLevel: string;
  levelNumber: number;
  articleCount: number;
}

export interface DemoClass {
  classId: string;
  title: string;
  bookId: string;
  bookTitle: string;
  cefrLevel: string;
  expiresAt: string;
  referralToken: string | null;
  enrolledCount: number;
  capacity: number;
}

async function getToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");
  return token;
}

export async function getBooks(): Promise<Book[]> {
  const token = await getToken();
  const res = await fetch(`${LEARNING_URL}/v1/books`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch books");
  const data = await res.json();
  return data.books ?? data ?? [];
}

export async function getMyDemoClasses(): Promise<DemoClass[]> {
  const token = await getToken();
  const res = await fetch(`${LEARNING_URL}/v1/classes?isDemo=true`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.classes ?? [];
}

export async function createDemoClass(bookId: string): Promise<DemoClass> {
  const token = await getToken();
  const res = await fetch(`${LEARNING_URL}/v1/classes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      bookId,
      title: "ห้องทดลองสอน (Demo)",
      capacity: 30,
      isDemo: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "สร้างห้อง Demo ไม่สำเร็จ");
  }
  revalidatePath("/dashboard/demo");
  const data = await res.json();
  return data.class ?? data;
}
