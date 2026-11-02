import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SetupClassRequest } from "@/lib/tutorClassFlow";

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

import { setupClass } from "./actions";

const request: SetupClassRequest = {
  title: "English",
  meetingUrl: null,
  scheduleDescription: "5 ต.ค. 69 (18:00-20:00)",
  scheduleData: [{ date: "2026-10-05", start: "18:00", end: "20:00" }],
  startsAt: "2026-10-05",
  endsAt: "2026-10-05",
  totalHours: 2,
};

describe("setupClass", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    revalidatePath.mockReset();
    cookieValue.current = "tutor-token";
  });

  it("posts the setup to learning with the tutor session and refreshes the class pages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ class: { setupRequired: false } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(setupClass("class-1", request)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/classes\/class-1\/setup$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tutor-token");
    expect(JSON.parse(init.body)).toEqual(request);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/classes/class-1");
  });

  it("returns the learning error code so the form can explain it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ error: { code: "CLASS_SETUP_NOT_REQUIRED", message: "This class is already set up" } }, { status: 409 }),
      ),
    );

    await expect(setupClass("class-1", request)).resolves.toEqual({ ok: false, code: "CLASS_SETUP_NOT_REQUIRED" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("falls back to SETUP_FAILED for a non-JSON error or a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    await expect(setupClass("class-1", request)).resolves.toEqual({ ok: false, code: "SETUP_FAILED" });

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(setupClass("class-1", request)).resolves.toEqual({ ok: false, code: "SETUP_FAILED" });
  });

  it("does not call learning without a session", async () => {
    cookieValue.current = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(setupClass("class-1", request)).resolves.toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
