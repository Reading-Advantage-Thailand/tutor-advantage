import { randomInt } from "crypto";
import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// Human-friendly code: TA-XXXX-XXXX (no ambiguous chars O/0/I/1).
// Codes are bearer credentials for teaching hours, so use a CSPRNG.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

function generateCode(): string {
  return `TA-${randomBlock(4)}-${randomBlock(4)}`;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const existing = await prisma.teachingHourCoupon.findUnique({
      where: { code },
      select: { couponId: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique coupon code");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NOTE_MAX = 500;
const REASON_MIN = 5;
const REASON_MAX = 500;
const COUPON_STATUSES = ["ACTIVE", "REDEEMED", "VOID", "EXPIRED"] as const;
type CouponStatus = (typeof COUPON_STATUSES)[number];
const SORT_FIELDS = {
  createdAt: "createdAt",
  hours: "hours",
  expiresAt: "expiresAt",
  code: "code",
  redeemedAt: "redeemedAt",
} as const;

function errorBody(req: AuthenticatedRequest, code: string, message: string) {
  return { error: { code, message, requestId: req.id } };
}

function forbidden(req: AuthenticatedRequest, res: Response, message: string) {
  return res.status(403).json(errorBody(req, "FORBIDDEN", message));
}

/**
 * Status the admin sees: an ACTIVE coupon whose expiry has passed can no
 * longer be redeemed (learning-service checks expiresAt), so report EXPIRED.
 */
export function effectiveCouponStatus(
  coupon: { status: string; expiresAt: Date | null },
  now: Date = new Date(),
): string {
  if (coupon.status === "ACTIVE" && coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    return "EXPIRED";
  }
  return coupon.status;
}

/** Prisma where clause for a status filter, treating ACTIVE-but-past-expiry as EXPIRED. */
export function couponStatusWhere(status: string | null, now: Date = new Date()): Record<string, unknown> {
  switch (status) {
    case "ACTIVE":
      return { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] };
    case "EXPIRED":
      return { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: now } }] };
    case "REDEEMED":
    case "VOID":
      return { status };
    default:
      return {};
  }
}

type ParsedExpiry = { ok: true; value: Date | null } | { ok: false };

/** null/"" clears; otherwise must be a valid date that is not in the past. */
function parseExpiry(raw: unknown, now: Date = new Date()): ParsedExpiry {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date.getTime() < now.getTime()) return { ok: false };
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

/** Checks the id is a UUID of an ACTIVE tutor. Returns an error response or null. */
async function checkTutor(req: AuthenticatedRequest, res: Response, tutorId: string) {
  if (!UUID_RE.test(tutorId)) {
    return res
      .status(400)
      .json(errorBody(req, "INVALID_TUTOR_ID", "assignedTutorId must be a valid UUID"));
  }
  const tutor = await prisma.user.findUnique({
    where: { userId: tutorId },
    select: { userId: true, role: true },
  });
  if (!tutor || tutor.role !== "TUTOR") {
    return res
      .status(404)
      .json(errorBody(req, "TUTOR_NOT_FOUND", "assignedTutorId does not match an existing tutor"));
  }
  return null;
}

async function writeAudit(
  actorId: string,
  action: string,
  couponId: string,
  payload: Record<string, unknown>,
) {
  try {
    await prisma.auditEvent.create({
      data: { actorId, action, entityType: "Coupon", entityId: couponId, payload: payload as never },
    });
  } catch (error) {
    // The coupon change already committed; never fail the request on audit, but log loudly.
    logger.error("Coupon audit write failed:", error);
  }
}

async function tutorNames(ids: Array<string | null | undefined>) {
  const tutorIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (tutorIds.length === 0) return new Map<string, string | null>();
  const tutors = await prisma.user.findMany({
    where: { userId: { in: tutorIds } },
    select: { userId: true, displayName: true },
  });
  return new Map(tutors.map((t) => [t.userId, t.displayName]));
}

function presentCoupon<
  T extends { status: string; expiresAt: Date | null; assignedTutorId: string | null; redeemedByTutorId: string | null },
>(coupon: T, names: Map<string, string | null>, now: Date) {
  return {
    ...coupon,
    effectiveStatus: effectiveCouponStatus(coupon, now),
    assignedTutorName: coupon.assignedTutorId ? names.get(coupon.assignedTutorId) ?? null : null,
    redeemedByTutorName: coupon.redeemedByTutorId ? names.get(coupon.redeemedByTutorId) ?? null : null,
  };
}

// POST /v1/coupons — admin issues a single coupon
export async function createCoupon(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role;
    const userId = req.user?.userId;
    if (!userId || role !== "ADMIN") {
      return forbidden(req, res, "Only admins can issue coupons");
    }

    const { hours, note, assignedTutorId, expiresAt } = req.body ?? {};

    if (!Number.isInteger(hours) || hours <= 0 || hours > 1000) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_HOURS", "hours must be a positive integer (max 1000)"));
    }

    const parsedNote = parseNote(note);
    if (!parsedNote.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_NOTE", `note must be text of at most ${NOTE_MAX} characters`));
    }

    const parsedExpiry = parseExpiry(expiresAt);
    if (!parsedExpiry.ok) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_EXPIRY", "expiresAt must be a valid date in the future"));
    }

    if (assignedTutorId) {
      const tutorError = await checkTutor(req, res, String(assignedTutorId));
      if (tutorError) return tutorError;
    }

    const code = await generateUniqueCode();
    const coupon = await prisma.teachingHourCoupon.create({
      data: {
        code,
        hours,
        note: parsedNote.value,
        createdByUserId: userId,
        assignedTutorId: assignedTutorId || null,
        expiresAt: parsedExpiry.value,
      },
    });

    await writeAudit(userId, "COUPON_CREATE", coupon.couponId, {
      code,
      hours,
      assignedTutorId: assignedTutorId || null,
      expiresAt: parsedExpiry.value?.toISOString() ?? null,
      note: parsedNote.value,
    });

    return res.status(201).json({ coupon });
  } catch (error) {
    logger.error("Create Coupon Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not create coupon"));
  }
}

// GET /v1/coupons?status=&q=&sort=&order=&page=&pageSize= — admin lists coupons
export async function getCoupons(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can view coupons");
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50),
    );
    const rawStatus = req.query.status ? String(req.query.status).toUpperCase() : null;
    const status = rawStatus && (COUPON_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as CouponStatus)
      : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const sortKey = typeof req.query.sort === "string" && req.query.sort in SORT_FIELDS
      ? SORT_FIELDS[req.query.sort as keyof typeof SORT_FIELDS]
      : "createdAt";
    const order: "asc" | "desc" = req.query.order === "asc" ? "asc" : "desc";
    const now = new Date();

    const search = q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { note: { contains: q, mode: "insensitive" as const } },
            ...(UUID_RE.test(q)
              ? [{ couponId: q }, { assignedTutorId: q }, { redeemedByTutorId: q }]
              : []),
          ],
        }
      : null;
    const statusWhere = couponStatusWhere(status, now);
    const where = search ? { AND: [statusWhere, search] } : statusWhere;

    // Nullable columns sort NULLs last ("no expiry" / "not redeemed" after dated rows).
    const NULLABLE = new Set<string>(["expiresAt", "redeemedAt"]);
    const orderBy =
      sortKey === "createdAt"
        ? [{ createdAt: order }]
        : [
            { [sortKey]: NULLABLE.has(sortKey) ? { sort: order, nulls: "last" as const } : order },
            { createdAt: "desc" as const },
          ];

    const [total, coupons, statusGroups, expiredActive] = await Promise.all([
      prisma.teachingHourCoupon.count({ where }),
      prisma.teachingHourCoupon.findMany({
        where,
        orderBy: orderBy as never,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.teachingHourCoupon.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { hours: true },
      }),
      prisma.teachingHourCoupon.aggregate({
        where: { status: "ACTIVE", expiresAt: { lt: now } },
        _count: { _all: true },
        _sum: { hours: true },
      }),
    ]);

    const names = await tutorNames(coupons.flatMap((c) => [c.assignedTutorId, c.redeemedByTutorId]));

    // Usage stats over ALL coupons (not the current filter), using effective status.
    const byStatus: Record<CouponStatus, { count: number; hours: number }> = {
      ACTIVE: { count: 0, hours: 0 },
      REDEEMED: { count: 0, hours: 0 },
      VOID: { count: 0, hours: 0 },
      EXPIRED: { count: 0, hours: 0 },
    };
    for (const group of statusGroups as Array<{ status: string; _count: { _all: number }; _sum: { hours: number | null } }>) {
      const key = (COUPON_STATUSES as readonly string[]).includes(group.status)
        ? (group.status as CouponStatus)
        : null;
      if (!key) continue;
      byStatus[key].count += group._count._all;
      byStatus[key].hours += group._sum.hours ?? 0;
    }
    const staleCount = expiredActive?._count?._all ?? 0;
    const staleHours = expiredActive?._sum?.hours ?? 0;
    byStatus.ACTIVE.count -= staleCount;
    byStatus.ACTIVE.hours -= staleHours;
    byStatus.EXPIRED.count += staleCount;
    byStatus.EXPIRED.hours += staleHours;
    const totalCount = COUPON_STATUSES.reduce((sum, s) => sum + byStatus[s].count, 0);
    const totalHours = COUPON_STATUSES.reduce((sum, s) => sum + byStatus[s].hours, 0);
    const usable = totalCount - byStatus.VOID.count;

    return res.status(200).json({
      coupons: coupons.map((c) => presentCoupon(c, names, now)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        total: totalCount,
        totalHours,
        byStatus,
        /** Share of non-void coupons that were redeemed (0–1). */
        redemptionRate: usable > 0 ? byStatus.REDEEMED.count / usable : 0,
      },
    });
  } catch (error) {
    logger.error("Get Coupons Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not fetch coupons"));
  }
}

// GET /v1/coupons/tutors?q= — tutor picker for the coupon form (max 10)
export async function searchCouponTutors(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can search tutors");
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const where = {
      role: "TUTOR",
      isActive: true,
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              ...(UUID_RE.test(q) ? [{ userId: q }] : []),
            ],
          }
        : {}),
    };
    const tutors = await prisma.user.findMany({
      where: where as never,
      select: { userId: true, displayName: true, email: true },
      orderBy: { displayName: "asc" },
      take: 10,
    });
    return res.status(200).json({ tutors });
  } catch (error) {
    logger.error("Search Coupon Tutors Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not search tutors"));
  }
}

// PATCH /v1/coupons/:couponId — admin edits note / expiry / assigned tutor of an ACTIVE coupon
export async function updateCoupon(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId || req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can edit coupons");
    }
    const { couponId } = req.params;
    if (!UUID_RE.test(couponId)) {
      return res.status(404).json(errorBody(req, "NOT_FOUND", "Coupon not found"));
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: { note?: string | null; expiresAt?: Date | null; assignedTutorId?: string | null } = {};

    if ("note" in body) {
      const parsed = parseNote(body.note);
      if (!parsed.ok) {
        return res
          .status(400)
          .json(errorBody(req, "INVALID_NOTE", `note must be text of at most ${NOTE_MAX} characters`));
      }
      data.note = parsed.value;
    }
    if ("expiresAt" in body) {
      const parsed = parseExpiry(body.expiresAt);
      if (!parsed.ok) {
        return res
          .status(400)
          .json(errorBody(req, "INVALID_EXPIRY", "expiresAt must be a valid date in the future"));
      }
      data.expiresAt = parsed.value;
    }
    if ("assignedTutorId" in body) {
      const tutorId = body.assignedTutorId ? String(body.assignedTutorId) : null;
      if (tutorId) {
        const tutorError = await checkTutor(req, res, tutorId);
        if (tutorError) return tutorError;
      }
      data.assignedTutorId = tutorId;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json(errorBody(req, "BAD_REQUEST", "Nothing to update"));
    }

    const before = await prisma.teachingHourCoupon.findUnique({ where: { couponId } });
    if (!before) {
      return res.status(404).json(errorBody(req, "NOT_FOUND", "Coupon not found"));
    }

    // Only ACTIVE coupons can change (atomic guard against a concurrent redeem/void).
    const result = await prisma.teachingHourCoupon.updateMany({
      where: { couponId, status: "ACTIVE" },
      data: { ...data, updatedAt: new Date() },
    });
    if (result.count === 0) {
      return res
        .status(409)
        .json(errorBody(req, "COUPON_NOT_EDITABLE", "Only active coupons can be edited"));
    }

    const coupon = await prisma.teachingHourCoupon.findUnique({ where: { couponId } });
    await writeAudit(userId, "COUPON_UPDATE", couponId, {
      code: before.code,
      before: {
        note: before.note,
        expiresAt: before.expiresAt?.toISOString() ?? null,
        assignedTutorId: before.assignedTutorId,
      },
      after: {
        note: coupon?.note ?? null,
        expiresAt: coupon?.expiresAt?.toISOString() ?? null,
        assignedTutorId: coupon?.assignedTutorId ?? null,
      },
    });
    return res.status(200).json({ coupon });
  } catch (error) {
    logger.error("Update Coupon Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not update coupon"));
  }
}

// POST /v1/coupons/:couponId/void { reason? } — admin voids an unredeemed coupon
export async function voidCoupon(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res, "Only admins can void coupons");
    }

    const { couponId } = req.params;
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
          .json(
            errorBody(
              req,
              "INVALID_REASON",
              `reason must be ${REASON_MIN}-${REASON_MAX} characters`,
            ),
          );
      }
    }

    // Only ACTIVE coupons can be voided (atomic guard)
    const result = await prisma.teachingHourCoupon.updateMany({
      where: { couponId, status: "ACTIVE" },
      data: { status: "VOID", updatedAt: new Date() },
    });

    if (result.count === 0) {
      return res
        .status(409)
        .json(errorBody(req, "CANNOT_VOID", "Coupon not found or is not active"));
    }

    const coupon = await prisma.teachingHourCoupon.findUnique({
      where: { couponId },
    });
    if (req.user?.userId) {
      await writeAudit(req.user.userId, "COUPON_VOID", couponId, {
        code: coupon?.code ?? null,
        hours: coupon?.hours ?? null,
        reason,
      });
    }
    return res.status(200).json({ coupon });
  } catch (error) {
    logger.error("Void Coupon Error:", error);
    return res
      .status(500)
      .json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not void coupon"));
  }
}
