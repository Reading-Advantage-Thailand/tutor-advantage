import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";
import { describeThrown, installProcessErrorHandlers } from "./processErrorHandlers";
import { alertFingerprint } from "./middlewares/discordAlertTransport";

function fakeProcess() {
  const proc = new EventEmitter() as EventEmitter & { exit: ReturnType<typeof vi.fn> };
  proc.exit = vi.fn();
  return proc;
}

describe("installProcessErrorHandlers", () => {
  it("logs unhandled rejections without exiting", () => {
    const proc = fakeProcess();
    const log = { error: vi.fn() };
    installProcessErrorHandlers("learning-service", { proc, log: log as never, flush: vi.fn() });

    const reason = new Error("db timeout");
    proc.emit("unhandledRejection", reason, Promise.resolve());
    proc.emit("unhandledRejection", "plain string reason", Promise.resolve());

    expect(log.error).toHaveBeenNthCalledWith(
      1,
      "Unhandled promise rejection: Error: db timeout",
      expect.objectContaining({ service: "learning-service", error: reason }),
    );
    expect(log.error).toHaveBeenNthCalledWith(
      2,
      "Unhandled promise rejection: plain string reason",
      expect.objectContaining({ reason: "plain string reason" }),
    );
    expect(proc.exit).not.toHaveBeenCalled();
  });

  it("names each rejection in the message so different failures get different alert fingerprints", () => {
    const proc = fakeProcess();
    const log = { error: vi.fn() };
    installProcessErrorHandlers("finance-mlm-service", { proc, log: log as never, flush: vi.fn() });

    proc.emit("unhandledRejection", new Error("LINE push timed out"), Promise.resolve());
    proc.emit("unhandledRejection", new Error("Timed out fetching a new connection from the connection pool"), Promise.resolve());
    proc.emit("unhandledRejection", "timeout", Promise.resolve());

    const messages = log.error.mock.calls.map(([message]) => message as string);
    expect(messages[2]).toBe("Unhandled promise rejection: timeout");
    const fingerprints = new Set(messages.map((message) => alertFingerprint("finance-mlm-service", message)));
    expect(fingerprints.size).toBe(3);
  });

  it("logs an uncaught exception, flushes alerts, then exits with code 1", async () => {
    const proc = fakeProcess();
    const log = { error: vi.fn() };
    let finishFlush: (() => void) | undefined;
    const flush = vi.fn(() => new Promise<void>((resolve) => (finishFlush = resolve)));
    installProcessErrorHandlers("finance-mlm-service", { proc, log: log as never, flush, flushTimeoutMs: 1500 });

    const error = new Error("boom");
    proc.emit("uncaughtException", error, "uncaughtException");
    await Promise.resolve();

    expect(log.error).toHaveBeenCalledWith(
      "Uncaught exception: Error: boom",
      expect.objectContaining({ service: "finance-mlm-service", origin: "uncaughtException", error }),
    );
    expect(flush).toHaveBeenCalledWith(1500);
    expect(proc.exit).not.toHaveBeenCalled();

    finishFlush?.();
    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(1));
  });

  it("still exits when logging or flushing fails", async () => {
    const proc = fakeProcess();
    const log = {
      error: vi.fn(() => {
        throw new Error("logger broken");
      }),
    };
    const flush = vi.fn(async () => {
      throw new Error("flush broken");
    });
    installProcessErrorHandlers("identity-service", { proc, log: log as never, flush });

    proc.emit("uncaughtException", new Error("boom"));
    proc.emit("uncaughtException", new Error("second while exiting"));

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(1));
    expect(log.error).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledOnce();
  });

  it("is idempotent per process", () => {
    const proc = fakeProcess();
    const opts = { proc, log: { error: vi.fn() } as never, flush: vi.fn() };

    expect(installProcessErrorHandlers("svc", opts)).toBe(true);
    expect(installProcessErrorHandlers("svc", opts)).toBe(false);
    expect(proc.listenerCount("unhandledRejection")).toBe(1);
    expect(proc.listenerCount("uncaughtException")).toBe(1);
  });
});

describe("describeThrown", () => {
  it("keeps only the first line and caps the length", () => {
    expect(describeThrown(new TypeError("bad\n  data: { phone: '0812345678' }"))).toBe("TypeError: bad");
    expect(describeThrown(new Error(""))).toBe("Error");
    expect(describeThrown(undefined)).toBe("undefined");
    expect(describeThrown(42)).toBe("42");
    expect(describeThrown(Object.create(null))).toBe("object");
    const long = describeThrown("x".repeat(500));
    expect(long).toHaveLength(200);
    expect(long.endsWith("…")).toBe(true);
  });
});
