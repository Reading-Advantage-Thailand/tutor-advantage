import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import winston from "winston";
import {
  ERROR_REPORTING_EVENT_TYPE,
  enableDiscordAlerts,
  getSafeRequestPath,
  hashIdentifier,
  redactExternalText,
  redactLogValue,
  redactSensitiveText,
  requestLoggerMiddleware,
  logger,
} from "./logger";

describe("secure logging helpers", () => {
  it("redacts credentials from messages and URLs", () => {
    const message =
      "postgresql://db-user:db-password@example.test:5432/app?sslmode=require " +
      "Bearer jwt-secret student-session=session-secret?token=ref-secret";

    const redacted = redactSensitiveText(message);

    expect(redacted).not.toContain("db-password");
    expect(redacted).not.toContain("jwt-secret");
    expect(redacted).not.toContain("session-secret");
    expect(redacted).toContain("[REDACTED_DATABASE_URL]");
    expect(redacted).toContain("Bearer [REDACTED]");
    expect(redacted).toContain("student-session=[REDACTED]");
  });

  it("redacts personal data embedded in free text", () => {
    const redacted = redactSensitiveText(
      "update failed: email a.b+c@example.co.th phone 0812345678 / +66 81 234 5678 / 02-123-4567 " +
        "nationalId 1103700012346 or 1-1037-00012-34-6 line U0123456789abcdef0123456789abcdef",
    );

    for (const leaked of ["a.b+c@example.co.th", "0812345678", "81 234 5678", "02-123-4567", "1103700012346", "1-1037-00012-34-6", "U0123456789abcdef"]) {
      expect(redacted).not.toContain(leaked);
    }
    expect(redacted).toContain("email [REDACTED_EMAIL]");
    expect(redacted).toContain("phone [REDACTED_PHONE] / [REDACTED_PHONE] / [REDACTED_PHONE]");
    expect(redacted).toContain("nationalId [REDACTED_NATIONAL_ID] or [REDACTED_NATIONAL_ID]");
    expect(redacted).toContain("line [REDACTED_LINE_USER_ID]");
  });

  it("keeps timestamps, amounts and UUIDs in Cloud Logging text but hashes UUIDs for external text", () => {
    // 1762300800000 is a ms timestamp: 13 digits but not a valid Thai ID checksum.
    const text = "at 1762300800000 charged 150000 for 3f2c1a9e-1111-4222-8333-444455556666";
    expect(redactSensitiveText(text)).toBe(text);
    expect(redactExternalText(text)).toBe(
      `at 1762300800000 charged 150000 for <id:${hashIdentifier("3f2c1a9e-1111-4222-8333-444455556666")}>`,
    );
  });

  it("hashes identifiers and redacts sensitive metadata keys", () => {
    expect(
      redactLogValue({ userId: "user-1", lineUserId: "line-1", token: "secret" }),
    ).toEqual({
      userId: hashIdentifier("user-1"),
      lineUserId: hashIdentifier("line-1"),
      token: "[REDACTED]",
    });
  });

  it("logs matched Express route templates without query strings", () => {
    const req = {
      baseUrl: "",
      route: { path: "/v1/enroll/:referralToken" },
      originalUrl: "/v1/enroll/secret-token/details?referralToken=secret-token",
      url: "/v1/enroll/secret-token/details?referralToken=secret-token",
    };

    expect(getSafeRequestPath(req as never)).toBe("/v1/enroll/:referralToken");
  });

  it("redacts dynamic values when no Express route matched", () => {
    const req = {
      route: undefined,
      originalUrl: "/v1/enroll/secret-token/details?referralToken=secret-token",
      url: "/v1/enroll/secret-token/details?referralToken=secret-token",
    };

    expect(getSafeRequestPath(req as never)).toBe("/v1/enroll/:redacted/details");
  });

  it("uses the first string when Express provides multiple route paths", () => {
    const req = {
      baseUrl: "/v1",
      route: { path: [/ignored/, "/users/:userId"] },
    };

    expect(getSafeRequestPath(req as never)).toBe("/v1/users/:userId");
  });

  it("logs a safe access record after the response finishes", () => {
    let finish: (() => void) | undefined;
    const res = {
      statusCode: 204,
      on: vi.fn((event: string, handler: () => void) => {
        if (event === "finish") finish = handler;
        return res;
      }),
    };
    const req = {
      method: "GET",
      baseUrl: "",
      route: { path: "/v1/health" },
      id: "req-1",
      ip: "127.0.0.1",
    };
    const info = vi.spyOn(logger, "info");
    const next = vi.fn();

    requestLoggerMiddleware(req as never, res as never, next);
    finish?.();

    expect(next).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      "HTTP Access",
      expect.objectContaining({
        method: "GET",
        url: "/v1/health",
        status: 204,
        requestId: "req-1",
        ip: "127.0.0.1",
      }),
    );
  });
});

describe("Cloud Logging / Error Reporting format", () => {
  const MESSAGE = Symbol.for("message");
  let lines: Record<string, unknown>[];
  let capture: winston.transport;
  let consoleTransport: winston.transport;

  beforeEach(() => {
    lines = [];
    capture = new (class extends winston.Transport {
      log(info: Record<PropertyKey, unknown>, callback: () => void) {
        lines.push(JSON.parse(String(info[MESSAGE])));
        callback();
      }
    })();
    consoleTransport = logger.transports[0];
    logger.remove(consoleTransport);
    logger.add(capture);
  });

  afterEach(() => {
    logger.remove(capture);
    logger.add(consoleTransport);
    vi.unstubAllEnvs();
  });

  it("maps winston levels to Cloud Logging severity", () => {
    logger.warn("careful");
    logger.info("hello");
    logger.log("http", "access");

    expect(lines.map((line) => line.severity)).toEqual(["WARNING", "INFO"]);
    expect(lines[0]).not.toHaveProperty("@type");
  });

  it("marks errors as Error Reporting events with a redacted stack trace", () => {
    vi.stubEnv("K_SERVICE", "learning-service");
    vi.stubEnv("K_REVISION", "learning-service-00042-abc");
    const error = new Error("connect postgresql://user:pw@db.test/app failed");

    logger.error("Unhandled Server Error", { requestId: "req-9", error });

    const [line] = lines;
    expect(line).toMatchObject({
      level: "error",
      severity: "ERROR",
      "@type": ERROR_REPORTING_EVENT_TYPE,
      serviceContext: { service: "learning-service", version: "learning-service-00042-abc" },
      requestId: "req-9",
    });
    expect(line.stack_trace).toEqual(expect.stringContaining("Error: connect [REDACTED_DATABASE_URL]"));
    expect(line.stack_trace).toEqual(expect.stringContaining("logger.test.ts"));
    expect(JSON.stringify(line)).not.toContain("user:pw");
  });

  it("uses winston's own stack when an Error is passed as metadata", () => {
    logger.error("boom", new Error("kaboom"));
    expect(lines[0].stack_trace).toEqual(expect.stringContaining("Error: kaboom"));
  });

  it("keeps the message and omits stack_trace when no Error is attached", () => {
    vi.stubEnv("K_SERVICE", "");
    vi.stubEnv("K_REVISION", "");
    logger.error("Payout batch failed", { batch: 3 });

    expect(lines[0]).toMatchObject({
      message: "Payout batch failed",
      severity: "ERROR",
      serviceContext: { version: "local" },
    });
    expect(lines[0]).not.toHaveProperty("stack_trace");
    expect((lines[0].serviceContext as { service: string }).service).toBeTruthy();
  });

  it("never attaches the Discord alert transport under tests", () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.test/api/webhooks/1/x");
    expect(enableDiscordAlerts()).toBe(false);
  });
});
