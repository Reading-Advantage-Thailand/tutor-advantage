import { randomUUID } from "crypto";
import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import type { DiscountCode, Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AUDIT_ACTIONS, AUDIT_ENTITY, recordAuditEvent } from "../services/auditService";
import { DISCOUNT_CODE_METHOD } from "../services/paymentMethods";
import {
  DISCOUNT_CODE_STATUSES,
  DiscountCodeError,
  type DiscountCodeStatus,
  buildDiscountQuote,
  discountCodeNotFound,
  discountCodeStatusError,
  discountCodeStatusWhere,
  discountCodeUsedUp,
  effectiveDiscountCodeStatus,
  findUsableDiscountCode,
  generateDiscountCode,
  normalizeDiscountCode,
  satangOrNull,
} from "../services/discountCodeService";
import {
  fulfillPaymentIntentTx,
  getPaymentGuardianGate,
  serializePaymentIntent,
} from "./paymentController";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_REDEMPTIONS_LIMIT = 500;
/** POST /v1/discount-codes/batch: single-use codes per request. */
const BATCH_QUANTITY_LIMIT = 100;
/** Whole-batch retries when a generated code loses a unique race. */
const BATCH_CREATE_ATTEMPTS = 3;
/** Rounds of "generate, then check which codes are already stored". */
const CODE_GENERATION_ROUNDS = 5;
// Up to 100 inserts + 100 audit rows on one connection: more than the 5 s
// interactive-transaction default when the database is slow.
const BATCH_TRANSACTION_TIMEOUT_MS = 30_000;
/** Most recent students shown per code in the admin list. */
const REDEEMERS_SHOWN = 3;
const NOTE_MAX = 500;
/** Most a student can have paid outside the system per code: 10,000 THB (DB CHECK too). */
const OFFLINE_PAID_MAX_SATANG = 1_000_000;
const REASON_MIN = 5;
const REASON_MAX = 500;
const IDEMPOTENCY_KEY_MAX = 200;
/** A payment that already took the money (same list as paymentController). */
const PAID_INTENT_STATUSES = ["SUCCESS", "DISPUTED"];
// A PENDING intent with no providerRef is only abandoned once the Omise create
// call that follows it can no longer be in flight (no request timeout is set).
const UNCHARGED_INTENT_RETIRE_AFTER_MS = 10 * 60 * 1000;
const SORT_FIELDS = {
  createdAt: "createdAt",
  expiresAt: "expiresAt",
  redeemedCount: "redeemedCount",
  code: "code",
} as const;

function errorBody(req: AuthenticatedRequest, code: string, message: string) {
  return { error: { code, message, requestId: req.id } };
}

function forbidden(req: AuthenticatedRequest, res: Response, message: string) {
  return res.status(403).json(errorBody(req, "FORBIDDEN", message));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

type ParsedOptionalId = { ok: true; value: string | null } | { ok: false };

/** Absent (undefined / null / "") or a UUID. */
function parseOptionalId(raw: unknown): ParsedOptionalId {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  return isUuid(raw) ? { ok: true, value: raw } : { ok: false };
}

/** Checks the caller is a student. Returns an error response or null. */
function requireStudent(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.userId) {
    return res.status(401).json(errorBody(req, "UNAUTHORIZED", "User ID missing from token"));
  }
  if (req.user.role !== "STUDENT") {
    return res
      .status(403)
      .json(errorBody(req, "STUDENT_ROLE_REQUIRED", "Only students can use discount codes"));
  }
  return null;
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

/** P2002 raised by discount_code_redemptions (one use per student per code). */
function isRedemptionUniqueViolation(error: unknown) {
  const meta = (error as { meta?: { modelName?: unknown; target?: unknown } } | null)?.meta;
  return (
    meta?.modelName === "DiscountCodeRedemption" ||
    /discount_code_id|discountCodeId/.test(JSON.stringify(meta?.target ?? ""))
  );
}

/**
 * The redeemed_count CHECK constraint (last line of defence against
 * over-redemption). Matched by name: other CHECK violations (SQLSTATE 23514)
 * in the transaction are not "used up" and must stay 500s.
 */
function isRedemptionLimitViolation(error: unknown) {
  const known = error as { message?: unknown; meta?: { message?: unknown } } | null;
  const text = `${known?.meta?.message ?? ""} ${known?.message ?? ""}`;
  return text.includes("discount_codes_redemptions_within_limit");
}

function redeemErrorFor(error: unknown): DiscountCodeError | null {
  if (error instanceof DiscountCodeError) return error;
  if (isUniqueViolation(error)) {
    return isRedemptionUniqueViolation(error)
      ? new DiscountCodeError(409, "DISCOUNT_CODE_ALREADY_USED", "You have already used this discount code")
      : new DiscountCodeError(409, "PAYMENT_IN_PROGRESS", "Another payment intent already exists for this enrollment");
  }
  if (isRedemptionLimitViolation(error)) return discountCodeUsedUp();
  return null;
}

/**
 * A BIGINT column read with $queryRaw (Prisma returns bigint). Anything that
 * is not a whole, non-negative number fails the redemption rather than record
 * a wrong amount.
 */
function rawMinorOrNull(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  let amount: bigint | null = null;
  if (typeof value === "bigint") amount = value;
  else if (typeof value === "number" && Number.isSafeInteger(value)) amount = BigInt(value);
  else if (typeof value === "string" && /^\d+$/.test(value)) amount = BigInt(value);
  if (amount === null || amount < 0n) {
    throw new Error(`Unexpected offline_paid_amount_minor value: ${String(value)}`);
  }
  return amount;
}

// ── Student ────────────────────────────────────────────────────────────────

// POST /v1/discount-codes/preview { code, classId, cycleId? } — student checks a code (no writes)
export async function previewDiscountCode(req: AuthenticatedRequest, res: Response) {
  try {
    const roleError = requireStudent(req, res);
    if (roleError) return roleError;
    const userId = req.user!.userId;

    const { code, classId, cycleId: rawCycleId } = req.body ?? {};
    const cycleId = parseOptionalId(rawCycleId);
    if (!isUuid(classId) || !cycleId.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_REQUEST", "classId (and cycleId when given) must be valid UUIDs"));
    }

    const cls = await prisma.class.findUnique({
      where: { classId },
      select: { classId: true, packagePriceMinor: true },
    });
    if (!cls) {
      return res.status(404).json(errorBody(req, "CLASS_NOT_FOUND", "Class not found"));
    }

    // Same price source createPaymentIntent checks the amount against.
    let originalAmountMinor = cls.packagePriceMinor;
    if (cycleId.value) {
      const cycle = await prisma.classBookCycle.findUnique({
        where: { classBookCycleId: cycleId.value },
        select: { classId: true, packagePriceMinor: true },
      });
      if (!cycle || cycle.classId !== classId) {
        return res
          .status(400)
          .json(errorBody(req, "INVALID_REQUEST", "cycleId does not belong to this class"));
      }
      originalAmountMinor = cycle.packagePriceMinor;
    }

    const discountCode = await findUsableDiscountCode(prisma, { code, classId, studentUserId: userId });
    return res.status(200).json({
      discount: buildDiscountQuote(discountCode, {
        classId,
        cycleId: cycleId.value,
        originalAmountMinor,
      }),
    });
  } catch (error) {
    if (error instanceof DiscountCodeError) {
      return res.status(error.status).json(errorBody(req, error.code, error.message));
    }
    logger.error("Preview Discount Code Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not check discount code"));
  }
}

type RedeemInput = {
  code: unknown;
  enrollmentId: string;
  enrollmentPackageId: string | null;
  studentUserId: string;
  requestId: string;
};

/**
 * The whole redemption in one transaction: claim one use of the code, create
 * a payment intent for the amount the student already paid outside the system
 * (0 THB for a free code) and activate it through the same path as a paid
 * Omise charge. Any failure rolls everything back.
 */
async function redeemInTransaction(tx: Prisma.TransactionClient, input: RedeemInput) {
  const { enrollmentId, enrollmentPackageId, studentUserId } = input;

  const enrollment = await tx.enrollment.findUnique({
    where: { enrollmentId },
    include: { class: true },
  });
  if (!enrollment) {
    throw new DiscountCodeError(404, "ENROLLMENT_NOT_FOUND", "Enrollment not found");
  }
  if (enrollment.studentUserId !== studentUserId) {
    throw new DiscountCodeError(403, "FORBIDDEN", "Cannot pay for someone else's enrollment");
  }

  const enrollmentPackage = enrollmentPackageId
    ? await tx.enrollmentPackage.findUnique({
        where: { enrollmentPackageId },
        include: { classBookCycle: true },
      })
    : null;
  if (enrollmentPackageId && !enrollmentPackage) {
    throw new DiscountCodeError(404, "ENROLLMENT_NOT_FOUND", "Enrollment package not found");
  }
  if (
    enrollmentPackage &&
    (enrollmentPackage.enrollmentId !== enrollmentId ||
      enrollmentPackage.studentUserId !== studentUserId)
  ) {
    throw new DiscountCodeError(403, "FORBIDDEN", "Cannot pay for someone else's package");
  }

  // A free class still needs the same age / guardian checks as a paid one.
  const guardianGate = await getPaymentGuardianGate(studentUserId, tx);
  if (guardianGate) {
    throw new DiscountCodeError(guardianGate.status, guardianGate.code, guardianGate.message);
  }

  const cycleId = enrollmentPackage?.classBookCycleId ?? null;

  // A retry after success (lost response, double tap) returns the same result.
  const normalizedCode = normalizeDiscountCode(input.code);
  if (normalizedCode) {
    const previous = await tx.discountCodeRedemption.findFirst({
      where: { studentUserId, discountCode: { code: normalizedCode } },
      include: { discountCode: true, paymentIntent: true },
    });
    if (
      previous &&
      previous.enrollmentId === enrollmentId &&
      (previous.enrollmentPackageId ?? null) === enrollmentPackageId &&
      previous.paymentIntent.status === "SUCCESS"
    ) {
      return {
        intent: previous.paymentIntent,
        discount: buildDiscountQuote(previous.discountCode, {
          classId: previous.classId,
          cycleId,
          originalAmountMinor: previous.originalAmountMinor,
        }),
      };
    }
  }

  const target = enrollmentPackage ?? enrollment;
  if (target.status !== "PENDING_PAYMENT") {
    throw target.status === "ACTIVE"
      ? new DiscountCodeError(409, "PAYMENT_ALREADY_COMPLETED", "This enrollment is already paid")
      : new DiscountCodeError(409, "ENROLLMENT_NOT_PENDING_PAYMENT", "This enrollment is not waiting for payment");
  }

  // Check the code against the class the student is actually enrolled in:
  // enrollment can fall back to another class of the same tutor.
  const discountCode = await findUsableDiscountCode(tx, {
    code: input.code,
    classId: enrollment.classId,
    studentUserId,
  });
  const originalAmountMinor = enrollmentPackage
    ? enrollmentPackage.classBookCycle.packagePriceMinor
    : enrollment.class.packagePriceMinor;

  // Only one non-FAILED intent may exist per target (partial unique index).
  const openIntents = await tx.paymentIntent.findMany({
    where: {
      enrollmentId,
      enrollmentPackageId,
      studentUserId,
      status: { not: "FAILED" },
    },
  });
  for (const openIntent of openIntents) {
    if (PAID_INTENT_STATUSES.includes(openIntent.status)) {
      throw new DiscountCodeError(409, "PAYMENT_ALREADY_COMPLETED", "This enrollment already has a successful payment");
    }
    const abandonedBefore = new Date(Date.now() - UNCHARGED_INTENT_RETIRE_AFTER_MS);
    if (openIntent.status === "PENDING" && !openIntent.providerRef && openIntent.createdAt < abandonedBefore) {
      // No Omise charge was ever created (e.g. the gateway was down). Retire
      // the intent only; markPaymentIntentFailed would cancel the enrollment.
      // A younger intent may still be waiting on createOmiseCharge, so it is
      // treated as in progress instead.
      const retired = await tx.paymentIntent.updateMany({
        where: {
          paymentIntentId: openIntent.paymentIntentId,
          status: "PENDING",
          providerRef: null,
          createdAt: { lt: abandonedBefore },
        },
        data: { status: "FAILED", updatedAt: new Date() },
      });
      if (retired.count === 1) continue;
    }
    // A live Omise charge (or a state we do not touch) is still in progress.
    throw new DiscountCodeError(409, "PAYMENT_IN_PROGRESS", "Another payment is already in progress for this enrollment");
  }

  // Claim one use. The guard re-checks status, limit and expiry inside the
  // UPDATE, so concurrent redemptions cannot exceed maxRedemptions. The
  // offline-paid amount comes back from the row this UPDATE locks: an admin
  // edit (only allowed while redeemed_count = 0) either committed before the
  // claim and is used here, or waits for it and is then refused.
  const claimed = await tx.$queryRaw<Array<{ offline_paid_amount_minor: unknown }>>`
    UPDATE finance_mlm.discount_codes
    SET redeemed_count = redeemed_count + 1, updated_at = now()
    WHERE discount_code_id = ${discountCode.discountCodeId}::uuid
      AND status = 'ACTIVE'
      AND redeemed_count < max_redemptions
      AND (expires_at IS NULL OR expires_at > now())
    RETURNING offline_paid_amount_minor`;
  if (claimed.length !== 1) {
    const current = await tx.discountCode.findUnique({
      where: { discountCodeId: discountCode.discountCodeId },
    });
    if (!current) throw discountCodeNotFound();
    // Another redemption or a void won the race: report why it is unusable now.
    throw discountCodeStatusError(effectiveDiscountCodeStatus(current)) ?? discountCodeUsedUp();
  }
  const offlinePaidAmountMinor = rawMinorOrNull(claimed[0].offline_paid_amount_minor);
  // The student pays 0 THB at checkout; the payment records what they already
  // paid by bank transfer so the tutor and upline earn on it. Free code: 0 THB.
  const amountMinor = offlinePaidAmountMinor ?? 0n;

  const redemptionId = randomUUID();
  const providerRef = `discount:${redemptionId}`;
  const intent = await tx.paymentIntent.create({
    data: {
      enrollmentId,
      enrollmentPackageId: enrollmentPackageId ?? undefined,
      studentUserId,
      amountMinor,
      currency: "THB",
      method: DISCOUNT_CODE_METHOD,
      status: "PENDING",
      idempotencyKey: providerRef,
      providerRef,
    },
  });

  await tx.discountCodeRedemption.create({
    data: {
      redemptionId,
      discountCodeId: discountCode.discountCodeId,
      studentUserId,
      classId: enrollment.classId,
      enrollmentId,
      enrollmentPackageId,
      paymentIntentId: intent.paymentIntentId,
      originalAmountMinor,
      discountAmountMinor: originalAmountMinor,
    },
  });

  await tx.paymentEvent.create({
    data: {
      paymentIntentId: intent.paymentIntentId,
      providerEventId: `${providerRef}:redeemed`,
      eventType: "discount_code.redeemed",
      rawPayload: {
        discountCodeId: discountCode.discountCodeId,
        redemptionId,
        code: discountCode.code,
        originalAmountMinor: originalAmountMinor.toString(),
        offlinePaidAmountMinor: amountMinor.toString(),
      },
      occurredAt: new Date(),
    },
  });

  // Same activation as a paid charge: intent SUCCESS, enrollment and its
  // pending packages ACTIVE, receipt.
  const fulfilled = await fulfillPaymentIntentTx(tx, intent.paymentIntentId, providerRef);
  if (fulfilled.status !== "SUCCESS") {
    // Another paid intent exists for this target; roll the redemption back.
    throw new DiscountCodeError(409, "PAYMENT_ALREADY_COMPLETED", "This enrollment already has a successful payment");
  }

  await recordAuditEvent(
    {
      actorId: studentUserId,
      action: AUDIT_ACTIONS.DISCOUNT_CODE_REDEEM,
      entityType: AUDIT_ENTITY.DISCOUNT_CODE,
      entityId: discountCode.discountCodeId,
      payload: {
        redemptionId,
        paymentIntentId: intent.paymentIntentId,
        enrollmentId,
        enrollmentPackageId,
        classId: enrollment.classId,
        originalAmountMinor: originalAmountMinor.toString(),
        offlinePaidAmountMinor: amountMinor.toString(),
      },
      requestId: input.requestId,
    },
    { client: tx, strict: true },
  );

  return {
    intent: fulfilled,
    // The amount this redemption recorded, not the earlier read.
    discount: buildDiscountQuote({ ...discountCode, offlinePaidAmountMinor }, {
      classId: enrollment.classId,
      cycleId,
      originalAmountMinor,
    }),
  };
}

// POST /v1/discount-codes/redeem { code, enrollmentId, enrollmentPackageId? } — 0 THB checkout
// (the payment records the amount the student already paid outside the system)
export async function redeemDiscountCode(req: AuthenticatedRequest, res: Response) {
  try {
    const roleError = requireStudent(req, res);
    if (roleError) return roleError;

    const { code, enrollmentId, enrollmentPackageId: rawPackageId } = req.body ?? {};
    const enrollmentPackageId = parseOptionalId(rawPackageId);
    if (!isUuid(enrollmentId) || !enrollmentPackageId.ok) {
      return res
        .status(400)
        .json(
          errorBody(req, "INVALID_REQUEST", "enrollmentId (and enrollmentPackageId when given) must be valid UUIDs"),
        );
    }

    const result = await prisma.$transaction((tx) =>
      redeemInTransaction(tx, {
        code,
        enrollmentId,
        enrollmentPackageId: enrollmentPackageId.value,
        studentUserId: req.user!.userId,
        requestId: req.id,
      }),
    );

    return res.status(200).json({
      intent: serializePaymentIntent(result.intent),
      checkout: null,
      discount: result.discount,
    });
  } catch (error) {
    const redeemError = redeemErrorFor(error);
    if (redeemError) {
      return res.status(redeemError.status).json(errorBody(req, redeemError.code, redeemError.message));
    }
    logger.error("Redeem Discount Code Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not redeem discount code"));
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

/**
 * Admin view of codes: joins class, book, tutor, creator and the students who
 * used each code (neither Class nor DiscountCodeRedemption has a User
 * relation). One query each for classes, redemptions and users per page.
 */
async function presentDiscountCodes(codes: DiscountCode[], now: Date = new Date()) {
  const classIds = Array.from(new Set(codes.map((code) => code.classId)));
  // A code nobody used has no redemption rows (redeemedCount moves with them).
  const redeemedCodeIds = codes.filter((code) => code.redeemedCount > 0).map((code) => code.discountCodeId);
  const [classes, redemptions] = await Promise.all([
    classIds.length
      ? prisma.class.findMany({
          where: { classId: { in: classIds } },
          select: {
            classId: true,
            title: true,
            tutorUserId: true,
            packagePriceMinor: true,
            book: { select: { bookCode: true } },
          },
        })
      : [],
    // At most maxRedemptions (<= 500) rows per code; trimmed per code below.
    redeemedCodeIds.length
      ? prisma.discountCodeRedemption.findMany({
          where: { discountCodeId: { in: redeemedCodeIds } },
          orderBy: [{ createdAt: "desc" }, { redemptionId: "desc" }],
          select: { discountCodeId: true, studentUserId: true, createdAt: true },
        })
      : [],
  ]);
  const classMap = new Map(classes.map((cls) => [cls.classId, cls]));

  // Newest first (query order), REDEEMERS_SHOWN per code.
  const redemptionsByCode = new Map<string, typeof redemptions>();
  for (const redemption of redemptions) {
    const list = redemptionsByCode.get(redemption.discountCodeId) ?? [];
    if (list.length < REDEEMERS_SHOWN) list.push(redemption);
    redemptionsByCode.set(redemption.discountCodeId, list);
  }
  const shownRedemptions = Array.from(redemptionsByCode.values()).flat();

  const userIds = Array.from(
    new Set([
      ...classes.map((cls) => cls.tutorUserId),
      ...codes.map((code) => code.createdByUserId),
      ...shownRedemptions.map((redemption) => redemption.studentUserId),
    ]),
  );
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, displayName: true, email: true, phoneNumber: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.userId, user]));

  return codes.map((code) => {
    const cls = classMap.get(code.classId);
    const tutor = cls ? userMap.get(cls.tutorUserId) : undefined;
    const creator = userMap.get(code.createdByUserId);
    const redeemers = (redemptionsByCode.get(code.discountCodeId) ?? []).map((redemption) => {
      const student = userMap.get(redemption.studentUserId);
      return {
        studentUserId: redemption.studentUserId,
        studentName: student?.displayName ?? null,
        studentEmail: student?.email ?? null,
        studentPhone: student?.phoneNumber ?? null,
        redeemedAt: redemption.createdAt.toISOString(),
      };
    });
    return {
      discountCodeId: code.discountCodeId,
      code: code.code,
      classId: code.classId,
      classTitle: cls?.title ?? null,
      bookCode: cls?.book.bookCode ?? null,
      packagePriceSatang: cls ? Number(cls.packagePriceMinor) : null,
      offlinePaidSatang: satangOrNull(code.offlinePaidAmountMinor),
      tutorUserId: cls?.tutorUserId ?? null,
      tutorName: tutor?.displayName ?? null,
      tutorEmail: tutor?.email ?? null,
      maxRedemptions: code.maxRedemptions,
      redeemedCount: code.redeemedCount,
      remaining: Math.max(0, code.maxRedemptions - code.redeemedCount),
      status: effectiveDiscountCodeStatus(code, now),
      note: code.note,
      expiresAt: iso(code.expiresAt),
      createdAt: code.createdAt.toISOString(),
      createdByUserId: code.createdByUserId,
      createdByName: creator?.displayName || creator?.email || null,
      voidedAt: iso(code.voidedAt),
      voidReason: code.voidReason,
      redeemers,
      lastRedeemedAt: redeemers[0]?.redeemedAt ?? null,
    };
  });
}

async function presentDiscountCode(code: DiscountCode) {
  const [view] = await presentDiscountCodes([code]);
  return view;
}

type ParsedExpiry = { ok: true; value: Date | null } | { ok: false };

/** null / "" means no expiry; otherwise a valid date in the future. */
function parseExpiry(raw: unknown, now: Date = new Date()): ParsedExpiry {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) return { ok: false };
  return { ok: true, value: date };
}

type ParsedNote = { ok: true; value: string | null } | { ok: false };

function parseNote(raw: unknown): ParsedNote {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length > NOTE_MAX) return { ok: false };
  return { ok: true, value: trimmed || null };
}

type ParsedIdempotencyKey = { ok: true; value: string | null } | { ok: false };

function parseIdempotencyKey(raw: unknown): ParsedIdempotencyKey {
  if (raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string" || raw.trim().length > IDEMPOTENCY_KEY_MAX) return { ok: false };
  return { ok: true, value: raw.trim() || null };
}

type ParsedOfflinePaid = { ok: true; value: bigint | null } | { ok: false };

/**
 * `offlinePaidSatang`: what the student already paid outside the system, an
 * integer number of satang from 0 to OFFLINE_PAID_MAX_SATANG. null / absent
 * stores NULL (a free code). Strings and fractions are rejected.
 */
function parseOfflinePaid(raw: unknown): ParsedOfflinePaid {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > OFFLINE_PAID_MAX_SATANG) {
    return { ok: false };
  }
  return { ok: true, value: BigInt(raw) };
}

function invalidOfflineAmount(req: AuthenticatedRequest) {
  return errorBody(
    req,
    "INVALID_OFFLINE_AMOUNT",
    `offlinePaidSatang must be an integer from 0 to ${OFFLINE_PAID_MAX_SATANG} (satang), or null`,
  );
}

/** Minor units as an audit-payload string (JSON has no bigint). */
function minorString(amountMinor: bigint | null) {
  return amountMinor === null ? null : amountMinor.toString();
}

/**
 * Students who used at least one code and whose name, email or phone number
 * contains `q`. Only redeeming students can match, so their ids bound the
 * user search: a broad term like "gmail" never pulls in every account.
 */
async function findRedeemingStudentIds(q: string): Promise<string[]> {
  const redeemers = await prisma.discountCodeRedemption.groupBy({ by: ["studentUserId"] });
  if (redeemers.length === 0) return [];
  const students = await prisma.user.findMany({
    where: {
      userId: { in: redeemers.map((redeemer) => redeemer.studentUserId) },
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { userId: true },
  });
  return students.map((student) => student.userId);
}

// GET /v1/discount-codes?page=&pageSize=&status=&q=&classId=&sort=&order= — admin lists codes
export async function getDiscountCodes(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can view discount codes");
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20),
    );
    const rawStatus = req.query.status ? String(req.query.status).toUpperCase() : null;
    const status = rawStatus && (DISCOUNT_CODE_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as DiscountCodeStatus)
      : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const classId = typeof req.query.classId === "string" ? req.query.classId.trim() : "";
    if (classId && !UUID_RE.test(classId)) {
      return res.status(400).json(errorBody(req, "INVALID_CLASS_ID", "classId must be a valid UUID"));
    }
    // Own keys only: `in` would also accept inherited names like "toString".
    const sortKey =
      typeof req.query.sort === "string" && Object.prototype.hasOwnProperty.call(SORT_FIELDS, req.query.sort)
        ? SORT_FIELDS[req.query.sort as keyof typeof SORT_FIELDS]
        : "createdAt";
    const order: "asc" | "desc" = req.query.order === "asc" ? "asc" : "desc";
    const now = new Date();

    const filters: Prisma.DiscountCodeWhereInput[] = [
      discountCodeStatusWhere(status, prisma.discountCode.fields.maxRedemptions, now),
    ];
    if (q) {
      const studentIds = await findRedeemingStudentIds(q);
      filters.push({
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { note: { contains: q, mode: "insensitive" } },
          ...(UUID_RE.test(q) ? [{ discountCodeId: q }, { classId: q }] : []),
          // ...or a student who used the code (name / email / phone).
          ...(studentIds.length ? [{ redemptions: { some: { studentUserId: { in: studentIds } } } }] : []),
        ],
      });
    }
    if (classId) filters.push({ classId });
    const where: Prisma.DiscountCodeWhereInput = { AND: filters };

    // "No expiry" sorts after dated codes.
    const orderBy: Prisma.DiscountCodeOrderByWithRelationInput[] =
      sortKey === "createdAt"
        ? [{ createdAt: order }]
        : sortKey === "expiresAt"
          ? [{ expiresAt: { sort: order, nulls: "last" } }, { createdAt: "desc" }]
          : [sortKey === "code" ? { code: order } : { redeemedCount: order }, { createdAt: "desc" }];

    const [total, codes, summaryRows] = await Promise.all([
      prisma.discountCode.count({ where }),
      prisma.discountCode.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Counts by effective status over ALL codes (not the current filter).
      prisma.$queryRaw<
        Array<{ total: bigint; void_count: bigint; used_up_count: bigint; expired_count: bigint; redemptions: bigint }>
      >`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE status = 'VOID')::bigint AS void_count,
          COUNT(*) FILTER (WHERE status <> 'VOID' AND redeemed_count >= max_redemptions)::bigint AS used_up_count,
          COUNT(*) FILTER (
            WHERE status <> 'VOID' AND redeemed_count < max_redemptions AND expires_at <= ${now}
          )::bigint AS expired_count,
          COALESCE(SUM(redeemed_count), 0)::bigint AS redemptions
        FROM finance_mlm.discount_codes`,
    ]);

    const counts = summaryRows[0];
    const summaryTotal = Number(counts?.total ?? 0);
    const summaryVoid = Number(counts?.void_count ?? 0);
    const usedUp = Number(counts?.used_up_count ?? 0);
    const expired = Number(counts?.expired_count ?? 0);

    return res.status(200).json({
      items: await presentDiscountCodes(codes, now),
      total,
      page,
      pageSize,
      summary: {
        total: summaryTotal,
        ACTIVE: summaryTotal - summaryVoid - usedUp - expired,
        USED_UP: usedUp,
        EXPIRED: expired,
        VOID: summaryVoid,
        redemptions: Number(counts?.redemptions ?? 0),
      },
    });
  } catch (error) {
    logger.error("Get Discount Codes Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not fetch discount codes"));
  }
}

// POST /v1/discount-codes { classId, maxRedemptions?, expiresAt?, note?, offlinePaidSatang? } — admin issues a code
export async function createDiscountCode(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId || req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can issue discount codes");
    }

    const { classId, maxRedemptions: rawMax, expiresAt, note, offlinePaidSatang } = req.body ?? {};
    if (!isUuid(classId)) {
      return res.status(400).json(errorBody(req, "INVALID_CLASS_ID", "classId must be a valid UUID"));
    }

    const maxRedemptions = rawMax === undefined || rawMax === null ? 1 : rawMax;
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > MAX_REDEMPTIONS_LIMIT) {
      return res
        .status(400)
        .json(
          errorBody(
            req,
            "INVALID_MAX_REDEMPTIONS",
            `maxRedemptions must be an integer from 1 to ${MAX_REDEMPTIONS_LIMIT}`,
          ),
        );
    }

    const parsedExpiry = parseExpiry(expiresAt);
    if (!parsedExpiry.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_EXPIRY", "expiresAt must be a valid date in the future"));
    }

    const parsedNote = parseNote(note);
    if (!parsedNote.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_NOTE", `note must be text of at most ${NOTE_MAX} characters`));
    }

    const parsedOfflinePaid = parseOfflinePaid(offlinePaidSatang);
    if (!parsedOfflinePaid.ok) {
      return res.status(400).json(invalidOfflineAmount(req));
    }

    const idempotencyKey = parseIdempotencyKey(req.headers["idempotency-key"]);
    if (!idempotencyKey.ok) {
      return res
        .status(400)
        .json(
          errorBody(
            req,
            "INVALID_IDEMPOTENCY_KEY",
            `Idempotency-Key must be text of at most ${IDEMPOTENCY_KEY_MAX} characters`,
          ),
        );
    }

    // A retried request (same Idempotency-Key) gets the code it already
    // created, but never one recording a different offline-paid amount.
    const replay = async (existing: DiscountCode) => {
      if (
        existing.classId !== classId ||
        existing.createdByUserId !== userId ||
        existing.offlinePaidAmountMinor !== parsedOfflinePaid.value
      ) {
        return res
          .status(409)
          .json(
            errorBody(req, "IDEMPOTENCY_KEY_REUSED", "Idempotency key is already bound to another discount code"),
          );
      }
      return res.status(200).json({ discountCode: await presentDiscountCode(existing) });
    };
    const findByKey = (key: string) =>
      prisma.discountCode.findUnique({ where: { creationIdempotencyKey: key } });

    if (idempotencyKey.value) {
      const existing = await findByKey(idempotencyKey.value);
      if (existing) return replay(existing);
    }

    const cls = await prisma.class.findUnique({
      where: { classId },
      select: { classId: true, title: true, isDemo: true },
    });
    if (!cls) {
      return res.status(404).json(errorBody(req, "CLASS_NOT_FOUND", "Class not found"));
    }
    if (cls.isDemo) {
      return res
        .status(409)
        .json(errorBody(req, "CLASS_NOT_ELIGIBLE", "Discount codes cannot be issued for a demo class"));
    }

    let created: DiscountCode | null = null;
    for (let attempt = 0; attempt < 10 && !created; attempt++) {
      const code = generateDiscountCode();
      const taken = await prisma.discountCode.findUnique({
        where: { code },
        select: { discountCodeId: true },
      });
      if (taken) continue;
      try {
        created = await prisma.discountCode.create({
          data: {
            code,
            classId,
            maxRedemptions,
            note: parsedNote.value,
            createdByUserId: userId,
            offlinePaidAmountMinor: parsedOfflinePaid.value,
            creationIdempotencyKey: idempotencyKey.value,
            expiresAt: parsedExpiry.value,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // The same Idempotency-Key raced in: return the code that request made.
        if (idempotencyKey.value) {
          const raced = await findByKey(idempotencyKey.value);
          if (raced) return replay(raced);
        }
        // Otherwise the generated code collided; try another one.
      }
    }
    if (!created) throw new Error("Could not generate a unique discount code");

    await recordAuditEvent({
      actorId: userId,
      action: AUDIT_ACTIONS.DISCOUNT_CODE_CREATE,
      entityType: AUDIT_ENTITY.DISCOUNT_CODE,
      entityId: created.discountCodeId,
      payload: {
        code: created.code,
        classId,
        classTitle: cls.title,
        maxRedemptions,
        expiresAt: iso(parsedExpiry.value),
        note: parsedNote.value,
        offlinePaidAmountMinor: minorString(parsedOfflinePaid.value),
      },
      requestId: req.id,
    });

    return res.status(201).json({ discountCode: await presentDiscountCode(created) });
  } catch (error) {
    logger.error("Create Discount Code Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not create discount code"));
  }
}

/** Code `index` (1-based) of a batch stores `<Idempotency-Key>#<index>`. */
function batchIdempotencyKey(key: string, index: number) {
  return `${key}#${index}`;
}

/**
 * Codes an earlier batch request with this Idempotency-Key created, in index
 * order. A batch is all-or-nothing, so an earlier batch of m codes stored
 * exactly `<key>#1..<key>#m`: looking up `#1..#(quantity + 1)` by exact key
 * (unique index, no LIKE, so `%`, `_` or `\` in the key cannot change the
 * match) finds fewer than `quantity` rows when it was smaller and
 * `quantity + 1` when it was larger.
 */
async function findBatchByKey(key: string, quantity: number) {
  const keys = Array.from({ length: quantity + 1 }, (_, position) => batchIdempotencyKey(key, position + 1));
  const rows = await prisma.discountCode.findMany({
    where: { creationIdempotencyKey: { in: keys } },
  });
  return rows
    .map((row) => ({ row, index: keys.indexOf(row.creationIdempotencyKey ?? "") + 1 }))
    .filter(({ index }) => index > 0)
    .sort((a, b) => a.index - b.index);
}

/** `quantity` distinct codes that no stored code uses yet. */
async function generateFreeDiscountCodes(quantity: number): Promise<string[]> {
  const codes = new Set<string>();
  for (let round = 0; round < CODE_GENERATION_ROUNDS && codes.size < quantity; round++) {
    const candidates = new Set<string>();
    while (candidates.size < quantity - codes.size) {
      const code = generateDiscountCode();
      if (!codes.has(code)) candidates.add(code);
    }
    const taken = await prisma.discountCode.findMany({
      where: { code: { in: Array.from(candidates) } },
      select: { code: true },
    });
    const takenCodes = new Set(taken.map((row) => row.code));
    for (const code of candidates) {
      if (!takenCodes.has(code)) codes.add(code);
    }
  }
  if (codes.size < quantity) throw new Error("Could not generate unique discount codes");
  return Array.from(codes);
}

// POST /v1/discount-codes/batch { classId, quantity, expiresAt?, note?, offlinePaidSatang? } — admin issues
// `quantity` single-use codes (one per student, so a forwarded code cannot be reused)
export async function createDiscountCodeBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId || req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can issue discount codes");
    }

    const { classId, quantity, expiresAt, note, offlinePaidSatang } = req.body ?? {};
    if (!isUuid(classId)) {
      return res.status(400).json(errorBody(req, "INVALID_CLASS_ID", "classId must be a valid UUID"));
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > BATCH_QUANTITY_LIMIT) {
      return res
        .status(400)
        .json(
          errorBody(req, "INVALID_QUANTITY", `quantity must be an integer from 1 to ${BATCH_QUANTITY_LIMIT}`),
        );
    }

    const parsedExpiry = parseExpiry(expiresAt);
    if (!parsedExpiry.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_EXPIRY", "expiresAt must be a valid date in the future"));
    }

    const parsedNote = parseNote(note);
    if (!parsedNote.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_NOTE", `note must be text of at most ${NOTE_MAX} characters`));
    }

    const parsedOfflinePaid = parseOfflinePaid(offlinePaidSatang);
    if (!parsedOfflinePaid.ok) {
      return res.status(400).json(invalidOfflineAmount(req));
    }
    const offlinePaidAmountMinor = parsedOfflinePaid.value;

    const idempotencyKey = parseIdempotencyKey(req.headers["idempotency-key"]);
    if (!idempotencyKey.ok) {
      return res
        .status(400)
        .json(
          errorBody(
            req,
            "INVALID_IDEMPOTENCY_KEY",
            `Idempotency-Key must be text of at most ${IDEMPOTENCY_KEY_MAX} characters`,
          ),
        );
    }
    const key = idempotencyKey.value;

    // A retried request (same Idempotency-Key) gets the codes it already
    // created, but only when they are that whole batch for the same class and
    // the same offline-paid amount.
    const replay = async (existing: Awaited<ReturnType<typeof findBatchByKey>>) => {
      const sameBatch =
        existing.length === quantity &&
        existing.every(
          ({ row, index }, position) =>
            index === position + 1 &&
            row.classId === classId &&
            row.createdByUserId === userId &&
            row.offlinePaidAmountMinor === offlinePaidAmountMinor,
        );
      if (!sameBatch) {
        return res
          .status(409)
          .json(
            errorBody(req, "IDEMPOTENCY_KEY_REUSED", "Idempotency key is already bound to other discount codes"),
          );
      }
      return res
        .status(200)
        .json({ discountCodes: await presentDiscountCodes(existing.map(({ row }) => row)) });
    };

    if (key) {
      const existing = await findBatchByKey(key, quantity);
      if (existing.length) return replay(existing);
    }

    const cls = await prisma.class.findUnique({
      where: { classId },
      select: { classId: true, title: true, isDemo: true },
    });
    if (!cls) {
      return res.status(404).json(errorBody(req, "CLASS_NOT_FOUND", "Class not found"));
    }
    if (cls.isDemo) {
      return res
        .status(409)
        .json(errorBody(req, "CLASS_NOT_ELIGIBLE", "Discount codes cannot be issued for a demo class"));
    }

    let created: DiscountCode[] | null = null;
    for (let attempt = 1; !created; attempt++) {
      const codes = await generateFreeDiscountCodes(quantity);
      try {
        // Every code and its audit row, or none of them.
        created = await prisma.$transaction(
          async (tx) => {
            const rows: DiscountCode[] = [];
            for (let position = 0; position < codes.length; position++) {
              const batchIndex = position + 1;
              const row = await tx.discountCode.create({
                data: {
                  code: codes[position],
                  classId,
                  maxRedemptions: 1,
                  note: parsedNote.value,
                  createdByUserId: userId,
                  offlinePaidAmountMinor,
                  creationIdempotencyKey: key ? batchIdempotencyKey(key, batchIndex) : null,
                  expiresAt: parsedExpiry.value,
                },
              });
              await recordAuditEvent(
                {
                  actorId: userId,
                  action: AUDIT_ACTIONS.DISCOUNT_CODE_CREATE,
                  entityType: AUDIT_ENTITY.DISCOUNT_CODE,
                  entityId: row.discountCodeId,
                  payload: {
                    code: row.code,
                    classId,
                    classTitle: cls.title,
                    maxRedemptions: 1,
                    expiresAt: iso(parsedExpiry.value),
                    note: parsedNote.value,
                    offlinePaidAmountMinor: minorString(offlinePaidAmountMinor),
                    batchSize: quantity,
                    batchIndex,
                  },
                  requestId: req.id,
                },
                { client: tx, strict: true },
              );
              rows.push(row);
            }
            return rows;
          },
          { timeout: BATCH_TRANSACTION_TIMEOUT_MS },
        );
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // The same Idempotency-Key raced in: answer with what that request made.
        if (key) {
          const raced = await findBatchByKey(key, quantity);
          if (raced.length) return replay(raced);
        }
        // Otherwise a generated code was taken meanwhile; retry the whole batch.
        if (attempt >= BATCH_CREATE_ATTEMPTS) throw error;
      }
    }

    return res.status(201).json({ discountCodes: await presentDiscountCodes(created) });
  } catch (error) {
    logger.error("Create Discount Code Batch Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not create discount codes"));
  }
}

// PATCH /v1/discount-codes/:discountCodeId/offline-amount { offlinePaidSatang } — admin
// corrects what the student paid outside the system (null = free code). Only
// while the code is ACTIVE and unused: a redemption has already recorded it.
export async function updateDiscountCodeOfflineAmount(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId || req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can edit discount codes");
    }

    const { discountCodeId } = req.params;
    if (!UUID_RE.test(discountCodeId)) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_DISCOUNT_CODE_ID", "discountCodeId must be a valid UUID"));
    }

    // The field is required: an empty body must not turn a paid code free.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed: ParsedOfflinePaid =
      "offlinePaidSatang" in body ? parseOfflinePaid(body.offlinePaidSatang) : { ok: false };
    if (!parsed.ok) {
      return res.status(400).json(invalidOfflineAmount(req));
    }
    const offlinePaidAmountMinor = parsed.value;

    // The change and its audit row commit together (it decides tutor earnings).
    const discountCode = await prisma.$transaction(async (tx) => {
      // Lock the row before reading it, so `before` is exactly the value this
      // update replaces even when two admins edit the same code at once.
      await tx.$queryRaw`
        SELECT 1 FROM finance_mlm.discount_codes
        WHERE discount_code_id = ${discountCodeId}::uuid
        FOR UPDATE`;
      const before = await tx.discountCode.findUnique({ where: { discountCodeId } });
      if (!before) throw discountCodeNotFound();

      // Atomic guard against a concurrent redeem or void: the redeem claim
      // locks the row and raises redeemed_count before reading the amount.
      const result = await tx.discountCode.updateMany({
        where: { discountCodeId, status: "ACTIVE", redeemedCount: 0 },
        data: { offlinePaidAmountMinor, updatedAt: new Date() },
      });
      if (result.count === 0) {
        throw new DiscountCodeError(
          409,
          "OFFLINE_AMOUNT_LOCKED",
          "The amount can only change while the code is active and nobody has used it",
        );
      }

      const after = await tx.discountCode.findUnique({ where: { discountCodeId } });
      if (!after) throw discountCodeNotFound();

      await recordAuditEvent(
        {
          actorId: userId,
          action: AUDIT_ACTIONS.DISCOUNT_CODE_UPDATE,
          entityType: AUDIT_ENTITY.DISCOUNT_CODE,
          entityId: discountCodeId,
          payload: {
            code: after.code,
            classId: after.classId,
            before: { offlinePaidAmountMinor: minorString(before.offlinePaidAmountMinor) },
            after: { offlinePaidAmountMinor: minorString(after.offlinePaidAmountMinor) },
          },
          requestId: req.id,
        },
        { client: tx, strict: true },
      );
      return after;
    });

    return res.status(200).json({ discountCode: await presentDiscountCode(discountCode) });
  } catch (error) {
    if (error instanceof DiscountCodeError) {
      return res.status(error.status).json(errorBody(req, error.code, error.message));
    }
    logger.error("Update Discount Code Offline Amount Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not update discount code"));
  }
}

// POST /v1/discount-codes/:discountCodeId/void { reason? } — admin cancels a code
export async function voidDiscountCode(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId || req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can void discount codes");
    }

    const { discountCodeId } = req.params;
    if (!UUID_RE.test(discountCodeId)) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_DISCOUNT_CODE_ID", "discountCodeId must be a valid UUID"));
    }

    const rawReason = (req.body ?? {}).reason;
    let reason: string | null = null;
    if (rawReason !== undefined && rawReason !== null && rawReason !== "") {
      if (typeof rawReason !== "string") {
        return res.status(400).json(errorBody(req, "INVALID_REASON", "reason must be text"));
      }
      reason = rawReason.trim();
      if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
        return res
          .status(400)
          .json(errorBody(req, "INVALID_REASON", `reason must be ${REASON_MIN}-${REASON_MAX} characters`));
      }
    }

    // Only ACTIVE codes can be voided (atomic guard against a concurrent void).
    const now = new Date();
    const result = await prisma.discountCode.updateMany({
      where: { discountCodeId, status: "ACTIVE" },
      data: {
        status: "VOID",
        voidedAt: now,
        voidedByUserId: userId,
        voidReason: reason,
        updatedAt: now,
      },
    });

    const discountCode = await prisma.discountCode.findUnique({ where: { discountCodeId } });
    if (!discountCode) {
      return res.status(404).json(errorBody(req, "DISCOUNT_CODE_NOT_FOUND", "Discount code not found"));
    }
    if (result.count === 0) {
      return res.status(409).json(errorBody(req, "CANNOT_VOID", "Discount code is already void"));
    }

    await recordAuditEvent({
      actorId: userId,
      action: AUDIT_ACTIONS.DISCOUNT_CODE_VOID,
      entityType: AUDIT_ENTITY.DISCOUNT_CODE,
      entityId: discountCodeId,
      payload: {
        code: discountCode.code,
        classId: discountCode.classId,
        redeemedCount: discountCode.redeemedCount,
        maxRedemptions: discountCode.maxRedemptions,
        reason,
      },
      requestId: req.id,
    });

    return res.status(200).json({ discountCode: await presentDiscountCode(discountCode) });
  } catch (error) {
    logger.error("Void Discount Code Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not void discount code"));
  }
}

// GET /v1/discount-codes/:discountCodeId/redemptions — who used a code (newest first)
export async function getDiscountCodeRedemptions(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can view discount code redemptions");
    }

    const { discountCodeId } = req.params;
    if (!UUID_RE.test(discountCodeId)) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_DISCOUNT_CODE_ID", "discountCodeId must be a valid UUID"));
    }

    const discountCode = await prisma.discountCode.findUnique({
      where: { discountCodeId },
      select: { discountCodeId: true },
    });
    if (!discountCode) {
      return res.status(404).json(errorBody(req, "DISCOUNT_CODE_NOT_FOUND", "Discount code not found"));
    }

    // At most maxRedemptions (<= 500) rows, so no paging.
    const redemptions = await prisma.discountCodeRedemption.findMany({
      where: { discountCodeId },
      orderBy: { createdAt: "desc" },
      include: { paymentIntent: { select: { amountMinor: true } } },
    });

    const studentIds = Array.from(new Set(redemptions.map((r) => r.studentUserId)));
    const enrollmentIds = Array.from(new Set(redemptions.map((r) => r.enrollmentId)));
    const [students, enrollments] = await Promise.all([
      studentIds.length
        ? prisma.user.findMany({
            where: { userId: { in: studentIds } },
            select: { userId: true, displayName: true, email: true, phoneNumber: true },
          })
        : [],
      enrollmentIds.length
        ? prisma.enrollment.findMany({
            where: { enrollmentId: { in: enrollmentIds } },
            select: { enrollmentId: true, status: true },
          })
        : [],
    ]);
    const studentMap = new Map(students.map((s) => [s.userId, s]));
    const enrollmentMap = new Map(enrollments.map((e) => [e.enrollmentId, e]));

    return res.status(200).json({
      items: redemptions.map((r) => {
        const student = studentMap.get(r.studentUserId);
        return {
          redemptionId: r.redemptionId,
          studentUserId: r.studentUserId,
          studentName: student?.displayName ?? null,
          studentEmail: student?.email ?? null,
          studentPhone: student?.phoneNumber ?? null,
          enrollmentId: r.enrollmentId,
          enrollmentPackageId: r.enrollmentPackageId,
          enrollmentStatus: enrollmentMap.get(r.enrollmentId)?.status ?? null,
          paymentIntentId: r.paymentIntentId,
          originalAmountSatang: Number(r.originalAmountMinor),
          // What this redemption recorded (the offline-paid amount, 0 when free).
          paidAmountSatang: Number(r.paymentIntent.amountMinor),
          createdAt: r.createdAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    logger.error("Get Discount Code Redemptions Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not fetch discount code redemptions"));
  }
}
