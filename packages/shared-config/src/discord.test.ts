import { afterEach, describe, expect, it, vi } from "vitest";
import { DISCORD_LIMITS, postDiscordEmbeds, truncateDiscordEmbeds, type DiscordEmbed } from "./discord";

const WEBHOOK = "https://discord.test/api/webhooks/1/secret-token";

function okFetch(status = 204) {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function embedLength(embeds: DiscordEmbed[]) {
  return embeds.reduce(
    (sum, e) =>
      sum +
      e.title.length +
      (e.description?.length ?? 0) +
      (e.fields ?? []).reduce((s, f) => s + f.name.length + f.value.length, 0) +
      (e.footer?.text.length ?? 0),
    0,
  );
}

describe("truncateDiscordEmbeds", () => {
  it("clamps each field to Discord's limits", () => {
    const [embed] = truncateDiscordEmbeds([
      {
        title: "t".repeat(400),
        description: "d".repeat(5000),
        fields: [{ name: "n", value: "v".repeat(2000) }],
      },
    ]);
    expect(embed.title).toHaveLength(DISCORD_LIMITS.title);
    expect(embed.title.endsWith("…")).toBe(true);
    expect(embed.description!.length).toBeLessThanOrEqual(DISCORD_LIMITS.description);
    expect(embed.fields![0].value).toHaveLength(DISCORD_LIMITS.fieldValue);
  });

  it("keeps at most 10 embeds and 6000 characters in total", () => {
    const embeds = Array.from({ length: 15 }, (_, i) => ({
      title: `embed ${i}`,
      description: "x".repeat(3000),
    }));
    const result = truncateDiscordEmbeds(embeds);
    expect(result.length).toBeLessThanOrEqual(DISCORD_LIMITS.embeds);
    expect(embedLength(result)).toBeLessThanOrEqual(DISCORD_LIMITS.total);
  });

  it("replaces empty field values, which Discord rejects", () => {
    const [embed] = truncateDiscordEmbeds([{ title: "x", fields: [{ name: "a", value: "" }] }]);
    expect(embed.fields).toEqual([{ name: "a", value: "-" }]);
  });
});

describe("postDiscordEmbeds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("is a no-op when no webhook is configured", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    const fetchImpl = okFetch();
    await expect(postDiscordEmbeds([{ title: "x" }], { fetchImpl })).resolves.toEqual({
      ok: false,
      reason: "NOT_CONFIGURED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts truncated embeds with the default username to the env webhook", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", WEBHOOK);
    const fetchImpl = okFetch();
    const result = await postDiscordEmbeds([{ title: "t".repeat(300), color: 0xff0000 }], { fetchImpl });

    expect(result).toEqual({ ok: true, status: 204 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    const body = JSON.parse(String(init.body));
    expect(body.username).toBe("Tutor Advantage");
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0].title).toHaveLength(DISCORD_LIMITS.title);
  });

  it("reports non-2xx responses without leaking the webhook URL", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await postDiscordEmbeds([{ title: "x" }], { webhookUrl: WEBHOOK, fetchImpl: okFetch(429) });

    expect(result).toEqual({ ok: false, status: 429, reason: "HTTP_ERROR" });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).not.toContain("secret-token");
  });

  it("reports network errors without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new TypeError(`fetch failed for ${WEBHOOK}`);
    }) as unknown as typeof fetch;

    await expect(postDiscordEmbeds([{ title: "x" }], { webhookUrl: WEBHOOK, fetchImpl })).resolves.toEqual({
      ok: false,
      reason: "NETWORK_ERROR",
    });
    expect(warn.mock.calls.flat().join(" ")).not.toContain("secret-token");
  });

  it("aborts a request that exceeds the timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    const pending = postDiscordEmbeds([{ title: "x" }], { webhookUrl: WEBHOOK, fetchImpl, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(pending).resolves.toEqual({ ok: false, reason: "NETWORK_ERROR" });
  });

  it("never throws even when serialisation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const embed = { title: "x" } as DiscordEmbed & { self?: unknown };
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    embed.timestamp = circular as never;

    await expect(
      postDiscordEmbeds([embed], { webhookUrl: WEBHOOK, fetchImpl: okFetch() }),
    ).resolves.toMatchObject({ ok: false });
  });
});
