import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDiscountQuote,
  discountCodeStatusWhere,
  effectiveDiscountCodeStatus,
  findUsableDiscountCode,
  generateDiscountCode,
  normalizeDiscountCode,
} from "./discountCodeService";

const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_CLASS_ID = "33333333-3333-4333-8333-333333333333";
const CODE_ID = "44444444-4444-4444-8444-444444444444";
const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-11-02T03:00:00.000Z");

describe("discount code format", () => {
  it("generates DC- codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateDiscountCode()).toMatch(/^DC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("normalizes what a student typed and treats odd input as no code", () => {
    expect(normalizeDiscountCode("  dc-abcd efgh ")).toBe("DC-ABCDEFGH");
    expect(normalizeDiscountCode("DC-ABCD-EFGH")).toBe("DC-ABCD-EFGH");
    expect(normalizeDiscountCode("dc\t-ab cd-ef\ngh")).toBe("DC-ABCD-EFGH");
    expect(normalizeDiscountCode("abc")).toBeNull();
    expect(normalizeDiscountCode("DC_ABCD")).toBeNull();
    expect(normalizeDiscountCode("'; DROP TABLE--")).toBeNull();
    expect(normalizeDiscountCode("A".repeat(33))).toBeNull();
    expect(normalizeDiscountCode(42)).toBeNull();
    expect(normalizeDiscountCode(undefined)).toBeNull();
  });
});

describe("effective discount code status", () => {
  const base = { status: "ACTIVE", redeemedCount: 0, maxRedemptions: 1, expiresAt: null };

  it("derives USED_UP and EXPIRED; VOID wins over both", () => {
    expect(effectiveDiscountCodeStatus(base, now)).toBe("ACTIVE");
    expect(effectiveDiscountCodeStatus({ ...base, redeemedCount: 1 }, now)).toBe("USED_UP");
    expect(effectiveDiscountCodeStatus({ ...base, expiresAt: now }, now)).toBe("EXPIRED");
    expect(
      effectiveDiscountCodeStatus({ ...base, expiresAt: new Date("2026-11-03T00:00:00Z") }, now),
    ).toBe("ACTIVE");
    // Fully used beats expired: nobody else could have used it anyway.
    expect(
      effectiveDiscountCodeStatus({ ...base, redeemedCount: 1, expiresAt: new Date("2020-01-01") }, now),
    ).toBe("USED_UP");
    expect(effectiveDiscountCodeStatus({ ...base, status: "VOID", redeemedCount: 1 }, now)).toBe("VOID");
  });

  it("builds filters that match the effective status", () => {
    const max = "max_redemptions_ref" as never;
    expect(discountCodeStatusWhere("VOID", max, now)).toEqual({ status: "VOID" });
    expect(discountCodeStatusWhere("USED_UP", max, now)).toEqual({
      status: "ACTIVE",
      redeemedCount: { gte: max },
    });
    expect(discountCodeStatusWhere("EXPIRED", max, now)).toEqual({
      status: "ACTIVE",
      redeemedCount: { lt: max },
      expiresAt: { lte: now },
    });
    expect(discountCodeStatusWhere("ACTIVE", max, now)).toEqual({
      status: "ACTIVE",
      redeemedCount: { lt: max },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    });
    expect(discountCodeStatusWhere(null, max, now)).toEqual({});
  });
});

describe("findUsableDiscountCode", () => {
  const client = {
    discountCode: { findUnique: vi.fn() },
    discountCodeRedemption: { findUnique: vi.fn() },
  };
  const code = (overrides: Record<string, unknown> = {}) => ({
    discountCodeId: CODE_ID,
    code: "DC-ABCD-EFGH",
    classId: CLASS_ID,
    status: "ACTIVE",
    redeemedCount: 0,
    maxRedemptions: 1,
    expiresAt: null,
    ...overrides,
  });
  const check = (input: Record<string, unknown> = {}) =>
    findUsableDiscountCode(client as never, {
      code: "dc-abcd-efgh",
      classId: CLASS_ID,
      studentUserId: STUDENT_ID,
      now,
      ...input,
    });

  beforeEach(() => {
    client.discountCode.findUnique.mockReset().mockResolvedValue(code());
    client.discountCodeRedemption.findUnique.mockReset().mockResolvedValue(null);
  });

  it("returns a usable code looked up by its normalized form", async () => {
    await expect(check()).resolves.toMatchObject({ discountCodeId: CODE_ID });
    expect(client.discountCode.findUnique).toHaveBeenCalledWith({ where: { code: "DC-ABCD-EFGH" } });
    expect(client.discountCodeRedemption.findUnique).toHaveBeenCalledWith({
      where: { discountCodeId_studentUserId: { discountCodeId: CODE_ID, studentUserId: STUDENT_ID } },
      select: { redemptionId: true },
    });
  });

  it("does not query the database for input that cannot be a code", async () => {
    await expect(check({ code: "not a code!" })).rejects.toMatchObject({
      status: 404,
      code: "DISCOUNT_CODE_NOT_FOUND",
    });
    expect(client.discountCode.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown code", null, null, 404, "DISCOUNT_CODE_NOT_FOUND"],
    ["void code", code({ status: "VOID" }), null, 409, "DISCOUNT_CODE_VOID"],
    ["code for another class", code({ classId: OTHER_CLASS_ID }), null, 409, "DISCOUNT_CODE_WRONG_CLASS"],
    // The student's own earlier use is reported before "used up".
    ["already used by this student", code({ redeemedCount: 1 }), { redemptionId: "r1" }, 409, "DISCOUNT_CODE_ALREADY_USED"],
    ["fully used code", code({ redeemedCount: 1 }), null, 409, "DISCOUNT_CODE_USED_UP"],
    ["expired code", code({ expiresAt: new Date("2026-11-01T00:00:00Z") }), null, 409, "DISCOUNT_CODE_EXPIRED"],
  ])("rejects a %s", async (_label, row, redemption, status, errorCode) => {
    client.discountCode.findUnique.mockResolvedValue(row);
    client.discountCodeRedemption.findUnique.mockResolvedValue(redemption);
    await expect(check()).rejects.toMatchObject({ status, code: errorCode });
  });
});

describe("buildDiscountQuote", () => {
  it("waives the whole price", () => {
    expect(
      buildDiscountQuote(
        { code: "DC-ABCD-EFGH", discountCodeId: CODE_ID, offlinePaidAmountMinor: null },
        { classId: CLASS_ID, cycleId: null, originalAmountMinor: 300000n },
      ),
    ).toEqual({
      code: "DC-ABCD-EFGH",
      discountCodeId: CODE_ID,
      classId: CLASS_ID,
      cycleId: null,
      originalAmountSatang: 300000,
      discountSatang: 300000,
      finalAmountSatang: 0,
      offlinePaidSatang: null,
    });
  });

  it("reports what was paid outside the system while the checkout stays 0 THB", () => {
    for (const [stored, shown] of [
      [300000n, 300000],
      [0n, 0],
    ] as const) {
      expect(
        buildDiscountQuote(
          { code: "DC-ABCD-EFGH", discountCodeId: CODE_ID, offlinePaidAmountMinor: stored },
          { classId: CLASS_ID, cycleId: null, originalAmountMinor: 350000n },
        ),
      ).toMatchObject({ originalAmountSatang: 350000, discountSatang: 350000, finalAmountSatang: 0, offlinePaidSatang: shown });
    }
  });
});
