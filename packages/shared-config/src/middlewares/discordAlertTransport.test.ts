import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscordAlertTransport, alertFingerprint, flushDiscordAlerts } from "./discordAlertTransport";
import type { DiscordEmbed } from "../discord";

const post = vi.fn(async (_embeds: DiscordEmbed[]) => ({ ok: true, status: 204 }));

function errorEntry(message: string, extra: Record<string, unknown> = {}) {
  return {
    level: "error",
    message,
    serviceContext: { service: "learning-service", version: "rev-7" },
    ...extra,
  };
}

function makeTransport(opts: Partial<ConstructorParameters<typeof DiscordAlertTransport>[0]> = {}) {
  return new DiscordAlertTransport({ post, now: () => Date.now(), ...opts });
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("DiscordAlertTransport", () => {
  let transports: DiscordAlertTransport[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
    post.mockClear();
    transports = [];
  });

  afterEach(() => {
    transports.forEach((t) => t.close());
    vi.useRealTimers();
  });

  function create(opts?: Parameters<typeof makeTransport>[0]) {
    const transport = makeTransport(opts);
    transports.push(transport);
    return transport;
  }

  it("calls back immediately without waiting for the network", () => {
    post.mockImplementationOnce(() => new Promise(() => {}));
    const transport = create();
    const callback = vi.fn();

    transport.log(errorEntry("boom"), callback);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("posts one red embed with service, revision, requestId, path and stack", async () => {
    const transport = create();
    const stack = ["Error: boom", ...Array.from({ length: 20 }, (_, i) => `    at frame${i} (file.ts:${i})`)].join("\n");

    transport.log(
      errorEntry("Unhandled Server Error boom", { requestId: "req-1", path: "/v1/classes/:id", stack_trace: stack }),
      () => {},
    );
    await settle();

    expect(post).toHaveBeenCalledOnce();
    const [[embed]] = post.mock.calls[0];
    expect(embed.title).toBe("🚨 learning-service error");
    expect(embed.color).toBe(0xe74c3c);
    expect(embed.description).toContain("Unhandled Server Error boom");
    expect(embed.description).toContain("```\nError\n    at frame0 (file.ts:0)");
    expect(embed.description).not.toContain("Error: boom");
    expect(embed.description).toContain("frame8");
    expect(embed.description).not.toContain("frame9");
    expect(embed.fields).toEqual([
      { name: "service", value: "learning-service", inline: true },
      { name: "revision", value: "rev-7", inline: true },
      { name: "requestId", value: "req-1", inline: true },
      { name: "path", value: "/v1/classes/:id", inline: false },
    ]);
  });

  it("sends only a redacted first line and stack frames, never a multi-line error body", async () => {
    const transport = create();
    // Shape of a Prisma validation error that reached errorHandler: winston
    // appended err.message to the log message, and the stack repeats it.
    const body = [
      "",
      "Invalid `prisma.user.update()` invocation:",
      "  data: { phone: '0812345678', email: 'a@b.com', nationalId: '1103700012346' }",
    ].join("\n");
    const stack = [
      `PrismaClientValidationError: ${body}`,
      "    at Object.update (/app/services/identity-service/dist/users.js:10:5)",
      "    at async handler (/app/dist/app.js:20:3)",
    ].join("\n");

    transport.log(
      errorEntry(`Unhandled Server Error ${body}`, { stack_trace: stack, requestId: "3f2c1a9e-1111-4222-8333-444455556666" }),
      () => {},
    );
    transport.log(
      errorEntry(
        "User 3f2c1a9e-1111-4222-8333-444455556666 a@b.com U0123456789abcdef0123456789abcdef 081-234-5678 1-1037-00012-34-6 " +
          "x".repeat(300),
      ),
      () => {},
    );
    await settle();

    const [prismaEmbed] = post.mock.calls[0][0];
    expect(prismaEmbed.description).toBe(
      "Unhandled Server Error\n```\nPrismaClientValidationError\n" +
        "    at Object.update (/app/services/identity-service/dist/users.js:10:5)\n" +
        "    at async handler (/app/dist/app.js:20:3)\n```",
    );
    // requestId stays raw so it can be searched in Cloud Logging.
    expect(prismaEmbed.fields).toContainEqual({
      name: "requestId",
      value: "3f2c1a9e-1111-4222-8333-444455556666",
      inline: true,
    });

    const [freeTextEmbed] = post.mock.calls[1][0];
    const description = freeTextEmbed.description ?? "";
    for (const leaked of ["3f2c1a9e", "a@b.com", "U0123456789abcdef", "081-234-5678", "1-1037-00012-34-6"]) {
      expect(description).not.toContain(leaked);
    }
    expect(description).toContain("[REDACTED_EMAIL]");
    expect(description).toContain("[REDACTED_LINE_USER_ID]");
    expect(description).toContain("[REDACTED_PHONE]");
    expect(description).toContain("[REDACTED_NATIONAL_ID]");
    expect(description).toMatch(/^User <id:[0-9a-f]{16}> /);
    expect(description).toHaveLength(200);
    expect(description.endsWith("…")).toBe(true);
  });

  it("ignores non-error levels and entries that opt out", async () => {
    const transport = create();
    transport.log({ level: "warn", message: "client error" }, () => {});
    transport.log(errorEntry("quiet", { alert: false }), () => {});
    await settle();

    expect(post).not.toHaveBeenCalled();
  });

  it("posts the same fingerprint once per 10 minutes and reports suppressed repeats", async () => {
    const transport = create();

    transport.log(errorEntry("Payment 123 failed for 3f2c1a9e-1111-4222-8333-444455556666"), () => {});
    transport.log(errorEntry("Payment 456 failed for 9a8b7c6d-1111-4222-8333-444455556666"), () => {});
    transport.log(errorEntry("Payment 789 failed for 00000000-1111-4222-8333-444455556666"), () => {});
    await settle();
    expect(post).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(9 * 60 * 1000);
    transport.log(errorEntry("Payment 1 failed for 3f2c1a9e-1111-4222-8333-444455556666"), () => {});
    await settle();
    expect(post).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 1000);
    transport.log(errorEntry("Payment 2 failed for 3f2c1a9e-1111-4222-8333-444455556666"), () => {});
    await settle();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0][0].description).toContain("(+3 similar suppressed)");
  });

  it("caps posts at 10 per 5 minutes and warns once when dropping", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport = create();

    for (let i = 0; i < 15; i += 1) {
      transport.log(errorEntry(`distinct failure ${"abcdefghijklmnop"[i]}`), () => {});
    }
    await settle();
    expect(post).toHaveBeenCalledTimes(10);
    expect(warn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5 * 60 * 1000);
    transport.log(errorEntry("after the window"), () => {});
    await settle();
    expect(post).toHaveBeenCalledTimes(11);
  });

  it("never throws when posting fails", async () => {
    post.mockRejectedValueOnce(new Error("network"));
    const transport = create();
    const callback = vi.fn();

    expect(() => transport.log(errorEntry("boom"), callback)).not.toThrow();
    await settle();
    await expect(transport.flush(100)).resolves.toBeUndefined();
    expect(callback).toHaveBeenCalledOnce();
  });

  it("flush waits for in-flight posts but gives up after the timeout", async () => {
    let resolvePost: (() => void) | undefined;
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = () => resolve({ ok: true, status: 204 });
        }),
    );
    post.mockImplementationOnce(() => new Promise(() => {}));
    const first = create();
    first.log(errorEntry("slow but finishes"), () => {});
    await settle();

    const flushed = vi.fn();
    void flushDiscordAlerts(2000).then(flushed);
    await settle();
    expect(flushed).not.toHaveBeenCalled();
    resolvePost?.();
    await settle();
    expect(flushed).toHaveBeenCalledOnce();

    const second = create();
    second.log(errorEntry("hangs forever"), () => {});
    await settle();
    const gaveUp = vi.fn();
    void second.flush(2000).then(gaveUp);
    await vi.advanceTimersByTimeAsync(1999);
    expect(gaveUp).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(gaveUp).toHaveBeenCalledOnce();
  });
});

describe("alertFingerprint", () => {
  it("normalises numbers, UUIDs and hex ids", () => {
    expect(alertFingerprint("svc", "Order 42 for 3f2c1a9e-1111-4222-8333-444455556666 hash deadbeef01")).toBe(
      alertFingerprint("svc", "Order 7 for 9a8b7c6d-2222-4333-8444-555566667777 hash cafebabe99"),
    );
    expect(alertFingerprint("svc-a", "same")).not.toBe(alertFingerprint("svc-b", "same"));
    expect(alertFingerprint("svc", "timeout")).not.toBe(alertFingerprint("svc", "refused"));
  });
});
