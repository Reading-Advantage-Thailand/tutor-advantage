import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  oAuthIdentity: { findFirst: vi.fn() },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function PrismaClient() {
    return prisma;
  }),
}));

import { LineNotificationService } from "./LineNotificationService";

const userId = "55555555-5555-4555-8555-555555555555";
const retryKey = "8f0c2a4e-6b1d-4c3e-9a5f-0d7e1b2c3a4f";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token");
  vi.stubGlobal("fetch", fetchMock);
  prisma.user.findUnique.mockResolvedValue({ settings: {} });
  prisma.oAuthIdentity.findFirst.mockResolvedValue({ providerSubject: "U-line-subject" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LineNotificationService retry key", () => {
  it("sends X-Line-Retry-Key when a retry key is given", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await LineNotificationService.sendTextToUserWithResult(userId, "hello", {
      type: "notifyClassReminders",
      retryKey,
    });

    expect(result).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
      "X-Line-Retry-Key": retryKey,
    });
    expect(JSON.parse(init.body)).toEqual({
      to: "U-line-subject",
      messages: [{ type: "text", text: "hello" }],
    });
  });

  it("omits the header without a retry key", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await LineNotificationService.sendToUser(userId, "hello", { type: "notifyClassReminders" });

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-Line-Retry-Key");
  });

  it("treats 409 for a retry key as already accepted", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 });

    const result = await LineNotificationService.sendFlexToUserWithResult(userId, "alt", { type: "bubble" }, {
      type: "notifyClassReminders",
      retryKey,
    });

    expect(result).toEqual({ sent: true });
  });

  it("keeps 409 an error when no retry key was sent", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 });

    const result = await LineNotificationService.sendFlexToUserWithResult(userId, "alt", { type: "bubble" }, {
      type: "notifyClassReminders",
    });

    expect(result).toEqual({ sent: false, reason: "LINE_API_ERROR", lineStatus: 409 });
  });

  it("still honours the preference before calling LINE", async () => {
    prisma.user.findUnique.mockResolvedValue({ settings: { notifications: { notifyClassReminders: false } } });

    const result = await LineNotificationService.sendTextToUserWithResult(userId, "hello", {
      type: "notifyClassReminders",
      retryKey,
    });

    expect(result).toEqual({ sent: false, reason: "PREFERENCE_DISABLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
