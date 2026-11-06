"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { loadAttendanceMeetingData } from "./attendance-server";
import type { AttendanceMeetingData, SaveAttendanceBody } from "./attendanceModel";

/** Result instead of a throw so the form can show the server's reason (thrown messages are hidden in production). */
export type AttendanceActionResult = { ok: true; data: AttendanceMeetingData } | { ok: false; code: string };

export async function saveAttendanceMeeting(classId: string, body: SaveAttendanceBody): Promise<AttendanceActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return { ok: false, code: "UNAUTHORIZED" };

  let data: AttendanceMeetingData;
  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes/${encodeURIComponent(classId)}/attendance/meeting`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { ok: false, code: err?.error?.code || "SAVE_FAILED" };
    }
    data = (await res.json()) as AttendanceMeetingData;
  } catch (error) {
    console.error("[saveAttendanceMeeting] request failed:", error);
    return { ok: false, code: "SAVE_FAILED" };
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  revalidatePath(`/dashboard/classes/${classId}/attendance`);
  return { ok: true, data };
}

/** Fresh roster for the open form, e.g. after a save was refused because a student left the class. */
export async function reloadAttendanceMeeting(classId: string, date: string, start: string): Promise<AttendanceActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return { ok: false, code: "UNAUTHORIZED" };
  const result = await loadAttendanceMeetingData(classId, date, start, token);
  return result.kind === "ok" ? { ok: true, data: result.data } : { ok: false, code: "LOAD_FAILED" };
}
