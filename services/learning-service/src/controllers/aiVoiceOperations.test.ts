import { describe, expect, it, vi } from "vitest";

vi.mock("../services/AiVoiceService", () => ({
  AiVoiceError: class AiVoiceError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  },
  getVoiceOperations: vi.fn(async () => ({ attempts: 2 })),
}));

import { getVoiceOperations } from "../services/AiVoiceService";
import { getVoiceOperationsMetrics } from "./aiVoiceController";

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("voice operations access", () => {
  it("rejects student and tutor roles", async () => {
    for (const role of ["STUDENT", "TUTOR"]) {
      const res = response();
      await getVoiceOperationsMetrics({ user: { userId: "user", role }, query: {} } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(getVoiceOperations).not.toHaveBeenCalled();
    }
  });

  it("returns a bounded window for admins", async () => {
    const res = response();
    await getVoiceOperationsMetrics({ user: { userId: "admin", role: "ADMIN" }, query: { days: "365" } } as never, res as never);
    expect(getVoiceOperations).toHaveBeenCalledWith(30);
    expect(res.json).toHaveBeenCalledWith({ attempts: 2 });
  });
});
