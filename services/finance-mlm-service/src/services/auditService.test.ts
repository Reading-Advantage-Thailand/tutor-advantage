import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ auditEvent: { create: vi.fn() } }));
vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import { buildAuditEventData, recordAuditEvent, redactAuditPayload } from "./auditService";

describe("auditService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redacts secrets and bank / national id keys at any depth", () => {
    expect(
      redactAuditPayload({
        reason: "ok",
        settings: { bankAccountNumber: "123", nationalId: "1-2345", bankBrand: "kbank" },
        token: "t",
        amountMinor: 30000n,
      }),
    ).toEqual({
      reason: "ok",
      settings: { bankAccountNumber: "[REDACTED]", nationalId: "[REDACTED]", bankBrand: "kbank" },
      token: "[REDACTED]",
      amountMinor: "30000",
    });
  });

  it("defaults the actor to SYSTEM and stores the request id", () => {
    expect(
      buildAuditEventData({ action: "USER_VERIFY", entityType: "User", entityId: "u-1", payload: { a: 1 }, requestId: "r-1" }),
    ).toEqual({ actorId: "SYSTEM", action: "USER_VERIFY", entityType: "User", entityId: "u-1", payload: { a: 1, requestId: "r-1" } });
  });

  it("never throws in non-strict mode", async () => {
    prismaMock.auditEvent.create.mockRejectedValue(new Error("db down"));
    await expect(recordAuditEvent({ actorId: "a", action: "X", entityType: "User", entityId: "u" })).resolves.toBe(false);
  });

  it("throws in strict mode and uses the given transaction client", async () => {
    const tx = { auditEvent: { create: vi.fn().mockRejectedValue(new Error("rollback")) } };
    await expect(
      recordAuditEvent({ actorId: "a", action: "X", entityType: "User", entityId: "u" }, { client: tx as never, strict: true }),
    ).rejects.toThrow("rollback");
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });
});
