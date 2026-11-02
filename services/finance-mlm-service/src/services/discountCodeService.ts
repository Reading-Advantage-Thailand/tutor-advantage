import { randomInt } from "crypto";
import type { Prisma } from "@tutor-advantage/database";

/**
 * Class discount codes (2026-11-02): an admin issues a code for one class; a
 * student types it at checkout and the class becomes free (0 THB). Only
 * ACTIVE and VOID are stored; USED_UP and EXPIRED are derived.
 */

// Human-friendly code: DC-XXXX-XXXX (no ambiguous chars O/0/I/1). The DC-
// prefix keeps them apart from tutor teaching-hour coupons (TA-). Codes waive
// tuition, so they are bearer credentials: use a CSPRNG.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_SHAPE = /^[A-Z0-9-]{4,32}$/;

function randomBlock(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function generateDiscountCode(): string {
  return `DC-${randomBlock(4)}-${randomBlock(4)}`;
}

/**
 * What a student typed, upper-cased with all whitespace removed. Null when it
 * cannot be a code at all; callers treat that as "not found", never as a 400.
 */
export function normalizeDiscountCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  return CODE_SHAPE.test(code) ? code : null;
}

export const DISCOUNT_CODE_STATUSES = ["ACTIVE", "USED_UP", "EXPIRED", "VOID"] as const;
export type DiscountCodeStatus = (typeof DISCOUNT_CODE_STATUSES)[number];

type DiscountCodeState = {
  status: string;
  redeemedCount: number;
  maxRedemptions: number;
  expiresAt: Date | null;
};

/** Status the admin sees and redeem checks use. */
export function effectiveDiscountCodeStatus(
  code: DiscountCodeState,
  now: Date = new Date(),
): DiscountCodeStatus {
  if (code.status === "VOID") return "VOID";
  if (code.redeemedCount >= code.maxRedemptions) return "USED_UP";
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "ACTIVE";
}

/**
 * Prisma where clause for an effective-status filter. `maxRedemptions` is the
 * field reference prisma.discountCode.fields.maxRedemptions (column compare).
 */
export function discountCodeStatusWhere(
  status: DiscountCodeStatus | null,
  maxRedemptions: Prisma.FieldRef<"DiscountCode", "Int">,
  now: Date = new Date(),
): Prisma.DiscountCodeWhereInput {
  switch (status) {
    case "VOID":
      return { status: "VOID" };
    case "USED_UP":
      return { status: "ACTIVE", redeemedCount: { gte: maxRedemptions } };
    case "EXPIRED":
      return { status: "ACTIVE", redeemedCount: { lt: maxRedemptions }, expiresAt: { lte: now } };
    case "ACTIVE":
      return {
        status: "ACTIVE",
        redeemedCount: { lt: maxRedemptions },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      };
    default:
      return {};
  }
}

/** A rejected preview / redeem. `status` and `code` go straight into the error envelope. */
export class DiscountCodeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function discountCodeNotFound() {
  return new DiscountCodeError(404, "DISCOUNT_CODE_NOT_FOUND", "Discount code not found");
}

export function discountCodeUsedUp() {
  return new DiscountCodeError(409, "DISCOUNT_CODE_USED_UP", "This discount code has been fully used");
}

/** Why a code with this effective status cannot be used (null when it can). */
export function discountCodeStatusError(status: DiscountCodeStatus): DiscountCodeError | null {
  switch (status) {
    case "VOID":
      return new DiscountCodeError(409, "DISCOUNT_CODE_VOID", "This discount code has been cancelled");
    case "USED_UP":
      return discountCodeUsedUp();
    case "EXPIRED":
      return new DiscountCodeError(409, "DISCOUNT_CODE_EXPIRED", "This discount code has expired");
    default:
      return null;
  }
}

type DiscountCodeReader = Pick<Prisma.TransactionClient, "discountCode" | "discountCodeRedemption">;

/**
 * Loads the code a student typed and checks they may use it for `classId`.
 * Read-only; throws DiscountCodeError with the precise reason.
 */
export async function findUsableDiscountCode(
  client: DiscountCodeReader,
  input: { code: unknown; classId: string; studentUserId: string; now?: Date },
) {
  const code = normalizeDiscountCode(input.code);
  if (!code) throw discountCodeNotFound();

  const discountCode = await client.discountCode.findUnique({ where: { code } });
  if (!discountCode) throw discountCodeNotFound();
  if (discountCode.status === "VOID") throw discountCodeStatusError("VOID");
  if (discountCode.classId !== input.classId) {
    throw new DiscountCodeError(409, "DISCOUNT_CODE_WRONG_CLASS", "This discount code is for another class");
  }

  const used = await client.discountCodeRedemption.findUnique({
    where: {
      discountCodeId_studentUserId: {
        discountCodeId: discountCode.discountCodeId,
        studentUserId: input.studentUserId,
      },
    },
    select: { redemptionId: true },
  });
  if (used) {
    throw new DiscountCodeError(409, "DISCOUNT_CODE_ALREADY_USED", "You have already used this discount code");
  }

  const statusError = discountCodeStatusError(effectiveDiscountCodeStatus(discountCode, input.now));
  if (statusError) throw statusError;
  return discountCode;
}

export type DiscountQuote = {
  code: string;
  discountCodeId: string;
  classId: string;
  cycleId: string | null;
  originalAmountSatang: number;
  discountSatang: number;
  finalAmountSatang: number;
};

/** Codes waive the whole price: the student pays 0 THB. */
export function buildDiscountQuote(
  discountCode: { code: string; discountCodeId: string },
  target: { classId: string; cycleId: string | null; originalAmountMinor: bigint },
): DiscountQuote {
  const original = Number(target.originalAmountMinor);
  return {
    code: discountCode.code,
    discountCodeId: discountCode.discountCodeId,
    classId: target.classId,
    cycleId: target.cycleId,
    originalAmountSatang: original,
    discountSatang: original,
    finalAmountSatang: 0,
  };
}
