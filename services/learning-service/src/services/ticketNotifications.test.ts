import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const discord = vi.hoisted(() => ({ postDiscordEmbeds: vi.fn() }));
const line = vi.hoisted(() => ({ buildLiffDeepLink: vi.fn(), sendTextToUserWithResult: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/shared-config")>()),
  postDiscordEmbeds: discord.postDiscordEmbeds,
  logger,
}));
vi.mock("./LineNotificationService", () => ({ LineNotificationService: line }));

import { buildNewTicketEmbed, notifyNewTicket, notifyRequester, requesterTicketLink } from "./ticketNotifications";

const TICKET = "22222222-2222-4222-8222-222222222222";
const STUDENT = "11111111-1111-4111-8111-111111111111";
const ticket = {
  ticketId: TICKET,
  ticketNumber: 7,
  category: "REFUND",
  requesterRole: "STUDENT",
  dueAt: new Date("2026-11-05T16:59:59.999Z"),
  createdAt: new Date("2026-11-02T03:00:00Z"),
  // Fields that must never reach Discord:
  subject: "ขอคืนเงิน somchai@example.com",
  requesterUserId: STUDENT,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DISCORD_TICKETS_WEBHOOK_URL", "https://discord.test/tickets");
  vi.stubEnv("ADMIN_CONSOLE_URL", "https://admin.test");
  vi.stubEnv("TUTOR_PWA_URL", "https://tutor.test/");
  discord.postDiscordEmbeds.mockResolvedValue({ ok: true });
  line.sendTextToUserWithResult.mockResolvedValue({ sent: true });
  line.buildLiffDeepLink.mockImplementation((path: string) => `https://liff.test/?redirect=${encodeURIComponent(path)}`);
});
afterEach(() => vi.unstubAllEnvs());

describe("new-ticket Discord embed", () => {
  it("carries number, Thai category, role and deadline only", () => {
    const embed = buildNewTicketEmbed(ticket);
    expect(embed.title).toBe("คำร้องใหม่ #7");
    expect(embed.url).toBe(`https://admin.test/support/tickets/${TICKET}`);
    expect(embed.fields?.map((f) => f.value).slice(0, 2)).toEqual(["คืนเงิน/ยกเลิก", "นักเรียน"]);
    expect(embed.fields?.[2].value).toMatch(/2569/); // Thai Buddhist year
    const visible = JSON.stringify({ ...embed, url: undefined });
    expect(visible).not.toContain(TICKET);
    expect(visible).not.toContain(STUDENT);
    expect(visible).not.toContain("somchai");
    expect(visible).not.toContain("ขอคืนเงิน");
  });

  it("posts only to DISCORD_TICKETS_WEBHOOK_URL, never the ops channel", async () => {
    notifyNewTicket(ticket);
    await flush();
    expect(discord.postDiscordEmbeds).toHaveBeenCalledWith([expect.objectContaining({ title: "คำร้องใหม่ #7" })], {
      webhookUrl: "https://discord.test/tickets",
    });

    vi.clearAllMocks();
    vi.stubEnv("DISCORD_TICKETS_WEBHOOK_URL", "");
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.test/ops");
    notifyNewTicket(ticket);
    await flush();
    expect(discord.postDiscordEmbeds).not.toHaveBeenCalled();
  });

  it("logs a failed post without alerting", async () => {
    discord.postDiscordEmbeds.mockResolvedValue({ ok: false, reason: "HTTP_ERROR" });
    notifyNewTicket(ticket);
    await flush();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ alert: false, reason: "HTTP_ERROR" }));
  });
});

describe("requester LINE notice", () => {
  it("links students into the LIFF and tutors into the PWA", () => {
    expect(requesterTicketLink("STUDENT", TICKET)).toBe(`https://liff.test/?redirect=${encodeURIComponent(`/support/${TICKET}`)}`);
    expect(requesterTicketLink("TUTOR", TICKET)).toBe(`https://tutor.test/dashboard/support/${TICKET}`);
    vi.stubEnv("TUTOR_PWA_URL", "");
    expect(requesterTicketLink("TUTOR", TICKET)).toBe("");
  });

  it("sends Thai text with the ticket number and link as a LINE message preference", async () => {
    notifyRequester({ ticketId: TICKET, ticketNumber: 7, requesterUserId: STUDENT, requesterRole: "TUTOR" }, "REPLY");
    await flush();
    expect(line.sendTextToUserWithResult).toHaveBeenCalledWith(
      STUDENT,
      `ทีมงานตอบคำร้อง #7 แล้ว\nดูรายละเอียด: https://tutor.test/dashboard/support/${TICKET}`,
      { type: "notifyLineMessages" },
    );
  });

  it("swallows send failures", async () => {
    line.sendTextToUserWithResult.mockRejectedValue(new Error("boom"));
    notifyRequester({ ticketId: TICKET, ticketNumber: 7, requesterUserId: STUDENT, requesterRole: "STUDENT" }, "RESOLVED");
    await flush();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ alert: false }));
  });
});
