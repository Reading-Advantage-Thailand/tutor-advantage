import { LEARNING_URL } from "@/lib/service-urls";
import {
  loadFailureKind,
  type AttendanceMeetingData,
  type AttendanceOverview,
} from "./attendanceModel";

export type AttendanceLoad<T> = { kind: "ok"; data: T } | { kind: "notFound" } | { kind: "unavailable" } | { kind: "failed" };

async function loadJson<T>(url: string, token: string, context: string): Promise<AttendanceLoad<T>> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      return { kind: loadFailureKind(res.status, err?.error?.code) };
    }
    return { kind: "ok", data: (await res.json()) as T };
  } catch (error) {
    console.error(`[attendance] ${context} failed:`, error);
    return { kind: "failed" };
  }
}

export function loadAttendanceOverview(classId: string, token: string) {
  return loadJson<AttendanceOverview>(`${LEARNING_URL}/v1/classes/${encodeURIComponent(classId)}/attendance`, token, "load overview");
}

export function loadAttendanceMeetingData(classId: string, date: string, start: string, token: string) {
  const query = new URLSearchParams({ date, start });
  return loadJson<AttendanceMeetingData>(
    `${LEARNING_URL}/v1/classes/${encodeURIComponent(classId)}/attendance/meeting?${query.toString()}`,
    token,
    "load meeting",
  );
}
