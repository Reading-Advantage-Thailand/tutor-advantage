import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ supportTicket: { count: vi.fn() } }));
const discord = vi.hoisted(() => ({ postDiscordEmbeds: vi.fn() }));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/shared-config")>()),
  postDiscordEmbeds: discord.postDiscordEmbeds,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../services/LineNotificationService", () => ({
  LineNotificationService: { buildLiffDeepLink: vi.fn(), sendTextToUserWithResult: vi.fn() },
}));

import { runTicketOverdueDigest } from "./ticketDigestController";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
const request = (key?: string) => ({ headers: key === undefined ? {} : { "x-internal-key": key }, body: {} }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INTERNAL_API_KEY", "internal-test-key");
  vi.stubEnv("DISCORD_TICKETS_WEBHOOK_URL", "https://discord.test/tickets");
  vi.stubEnv("ADMIN_CONSOLE_URL", "https://admin.test/");
  discord.postDiscordEmbeds.mockResolvedValue({ ok: true, status: 204 });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /v1/internal/tickets/overdue-digest", () => {
  it("rejects a missing or wrong key, and every caller when no key is configured", async () => {
    for (const key of [undefined, "wrong"]) {
      const res = response();
      await runTicketOverdueDigest(request(key), res as never);
      expect(res.status).toHaveBeenCalledWith(401);
    }
    vi.stubEnv("INTERNAL_API_KEY", "");
    const res = response();
    await runTicketOverdueDigest(request(""), res as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.supportTicket.count).not.toHaveBeenCalled();
  });

  it("posts one count-only embed to the tickets channel when something is overdue", async () => {
    prisma.supportTicket.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    const res = response();
    await runTicketOverdueDigest(request("internal-test-key"), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ overdue: 2, awaitingSupport: 5, posted: true });
    const [embeds, opts] = discord.postDiscordEmbeds.mock.calls[0];
    expect(opts).toEqual({ webhookUrl: "https://discord.test/tickets" });
    expect(embeds).toHaveLength(1);
    expect(embeds[0].url).toBe("https://admin.test/support/tickets?overdue=true");
    expect(embeds[0].fields.map((f: { value: string }) => f.value)).toEqual(["2", "5"]);
  });

  it("posts nothing when nothing is overdue or the channel is not configured", async () => {
    prisma.supportTicket.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    const none = response();
    await runTicketOverdueDigest(request("internal-test-key"), none as never);
    expect(none.json).toHaveBeenCalledWith({ overdue: 0, awaitingSupport: 3, posted: false });

    vi.stubEnv("DISCORD_TICKETS_WEBHOOK_URL", "");
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.test/ops");
    prisma.supportTicket.count.mockResolvedValueOnce(4).mockResolvedValueOnce(4);
    const unset = response();
    await runTicketOverdueDigest(request("internal-test-key"), unset as never);
    expect(unset.json).toHaveBeenCalledWith({ overdue: 4, awaitingSupport: 4, posted: false });
    expect(discord.postDiscordEmbeds).not.toHaveBeenCalled();
  });

  it("reports posted=false when Discord fails", async () => {
    prisma.supportTicket.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    discord.postDiscordEmbeds.mockResolvedValue({ ok: false, reason: "HTTP_ERROR", status: 500 });
    const res = response();
    await runTicketOverdueDigest(request("internal-test-key"), res as never);
    expect(res.json).toHaveBeenCalledWith({ overdue: 1, awaitingSupport: 1, posted: false });
  });
});
