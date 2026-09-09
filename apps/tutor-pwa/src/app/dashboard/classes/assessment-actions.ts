"use server";
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";

export async function assessmentAction(cycleId: string, action: "report" | "comment", payload?: { attemptId: string; comment: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(cycleId) || !["report", "comment"].includes(action)) throw new Error("คำขอไม่ถูกต้อง");
  const token = (await cookies()).get("tutor_session")?.value;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบ");
  const suffix = action === "comment" ? `attempts/${encodeURIComponent(payload?.attemptId || "")}/comment` : action;
  const response = await fetch(`${LEARNING_URL}/v1/book-cycles/${cycleId}/assessment/${suffix}`, {
    method: action === "report" ? "GET" : "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    ...(action === "comment" ? { body: JSON.stringify({ comment: payload?.comment }) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "โหลดผลประเมินไม่สำเร็จ");
  return data;
}
