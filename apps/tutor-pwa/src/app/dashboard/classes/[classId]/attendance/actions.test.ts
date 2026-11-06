import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceMeetingData, SaveAttendanceBody } from "./attendanceModel";

const { cookieValue, revalidatePath } = vi.hoisted(() => ({
  cookieValue: { current: "tutor-token" as string | undefined },
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "tutor_session" && cookieValue.current ? { value: cookieValue.current } : undefined),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { reloadAttendanceMeeting, saveAttendanceMeeting } from "./actions";

const body: SaveAttendanceBody = {
  date: "2026-11-05",
  start: "19:00",
  marks: [{ studentUserId: "s1", status: "PRESENT" }],
};

const data: AttendanceMeetingData = {
  meeting: { date: "2026-11-05", start: "19:00", end: "21:00", source: "SCHEDULED", inSchedule: true, movedFrom: null, markable: true },
  roster: [],
};

function respondWith(status: number, json: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(json), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("attendance actions", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    cookieValue.current = "tutor-token";
  });

  it("saves with the session token and refreshes the class pages", async () => {
    const fetchMock = respondWith(200, data);
    await expect(saveAttendanceMeeting("class-1", body)).resolves.toEqual({ ok: true, data });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/classes/class-1/attendance/meeting");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tutor-token" });
    expect(JSON.parse(init.body as string)).toEqual(body);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/classes/class-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/classes/class-1/attendance");
  });

  it("returns the server's error code and refreshes nothing", async () => {
    respondWith(409, { error: { code: "STUDENT_NOT_ENROLLED", message: "x", requestId: "r" } });
    await expect(saveAttendanceMeeting("class-1", body)).resolves.toEqual({ ok: false, code: "STUDENT_NOT_ENROLLED" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not call the service without a session", async () => {
    cookieValue.current = undefined;
    const fetchMock = respondWith(200, data);
    await expect(saveAttendanceMeeting("class-1", body)).resolves.toEqual({ ok: false, code: "UNAUTHORIZED" });
    await expect(reloadAttendanceMeeting("class-1", "2026-11-05", "19:00")).resolves.toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a network failure as a failed save", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    await expect(saveAttendanceMeeting("class-1", body)).resolves.toEqual({ ok: false, code: "SAVE_FAILED" });
    expect(consoleError).toHaveBeenCalled();
  });

  it("reloads the meeting by date and start", async () => {
    const fetchMock = respondWith(200, data);
    await expect(reloadAttendanceMeeting("class-1", "2026-11-05", "19:00")).resolves.toEqual({ ok: true, data });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("/v1/classes/class-1/attendance/meeting?date=2026-11-05&start=19%3A00");
  });
});
