import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reminders = vi.hoisted(() => ({
  sendClassSessionReminders: vi.fn(),
  sendBookPaymentReminders: vi.fn(),
}));

vi.mock("../services/ReminderService", () => ({
  DEFAULT_LEAD_MINUTES: 15,
  ...reminders,
}));

import { runBookPaymentReminders, runClassSessionReminders } from "./reminderController";

const summary = { considered: 2, sent: 1, skipped: 1, failed: 0, alreadyHandled: 0 };

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function request(key: string | undefined, body: unknown = {}) {
  return { headers: key === undefined ? {} : { "x-internal-key": key }, body } as never;
}

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_KEY", "internal-test-key");
  reminders.sendClassSessionReminders.mockResolvedValue(summary);
  reminders.sendBookPaymentReminders.mockResolvedValue(summary);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runClassSessionReminders", () => {
  it.each([undefined, "wrong-key", ""])("rejects key %j with 401", async (key) => {
    const res = response();
    await runClassSessionReminders(request(key), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "UNAUTHORIZED", message: "Invalid internal key" } });
    expect(reminders.sendClassSessionReminders).not.toHaveBeenCalled();
  });

  it("rejects every caller when INTERNAL_API_KEY is not configured", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "");
    const res = response();
    await runClassSessionReminders(request(""), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("runs with the default lead time and returns the summary", async () => {
    const res = response();
    await runClassSessionReminders(request("internal-test-key", undefined), res as never);

    expect(reminders.sendClassSessionReminders).toHaveBeenCalledWith({ leadMinutes: 15 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ leadMinutes: 15, ...summary });
  });

  it.each([
    [30, 30],
    [5, 5],
    [120, 120],
    [4, 15],
    [121, 15],
    [7.5, 15],
    ["abc", 15],
  ])("leadMinutes %j runs as %j", async (input, expected) => {
    const res = response();
    await runClassSessionReminders(request("internal-test-key", { leadMinutes: input }), res as never);

    expect(reminders.sendClassSessionReminders).toHaveBeenCalledWith({ leadMinutes: expected });
  });

  it("returns 500 when the run fails", async () => {
    reminders.sendClassSessionReminders.mockRejectedValue(new Error("db down"));
    const res = response();
    await runClassSessionReminders(request("internal-test-key"), res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Class session reminders failed", details: "db down" },
    });
  });
});

describe("runBookPaymentReminders", () => {
  it("rejects a bad key with 401", async () => {
    const res = response();
    await runBookPaymentReminders(request("nope"), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(reminders.sendBookPaymentReminders).not.toHaveBeenCalled();
  });

  it("returns the summary", async () => {
    const res = response();
    await runBookPaymentReminders(request("internal-test-key"), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(summary);
  });

  it("answers 503 when a delivery failed so Cloud Scheduler retries within the retry-key window", async () => {
    const partial = { considered: 3, sent: 1, skipped: 1, failed: 1, alreadyHandled: 0 };
    reminders.sendBookPaymentReminders.mockResolvedValue(partial);
    const res = response();
    await runBookPaymentReminders(request("internal-test-key"), res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "REMINDER_DELIVERIES_FAILED", message: "Some book payment reminders failed; retry the run" },
      ...partial,
    });
  });

  it("returns 500 when the run fails", async () => {
    reminders.sendBookPaymentReminders.mockRejectedValue(new Error("db down"));
    const res = response();
    await runBookPaymentReminders(request("internal-test-key"), res as never);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
