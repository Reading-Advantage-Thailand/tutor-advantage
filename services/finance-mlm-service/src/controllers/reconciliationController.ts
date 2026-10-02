import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { buildReceiptNumber } from "../services/taxService";
import {
  fulfillPaymentIntent,
  markPaymentIntentFailed,
  retrieveAndVerifyOmiseCharge,
} from "./paymentController";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ISSUE_TYPES = [
  "ENROLLMENT_TARGET_NOT_FOUND",
  "SUCCESS_NOT_ACTIVE",
  "FAILED_ACTIVE",
  "STALE_PENDING",
  "MISSING_PAYMENT_REF",
] as const;

const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
  "CHARGEBACKED",
];

/** Audit action written when an orphan webhook event is dismissed. */
export const ORPHAN_DISMISS_ACTION = "RECONCILIATION_ORPHAN_DISMISS";

function toNumber(value: bigint | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

export class ReconciliationError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function sendError(
  req: AuthenticatedRequest,
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return res.status(status).json({
    error: { code, message, requestId: req.id, ...(details ? { details } : {}) },
  });
}

/** Paging params shared by the admin list endpoints (1-based page, 1–100 size). */
export function parsePaging(query: Record<string, unknown>, defaultSize = 20) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const rawSize = Math.floor(Number(query.pageSize ?? query.limit) || defaultSize);
  const pageSize = Math.min(Math.max(rawSize, 1), 100);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/**
 * Normalise an admin note. Mutations that change money/enrollment/identity
 * state require one (>= 5 chars) so the audit trail says why.
 */
export function readReason(body: unknown, { required = true } = {}) {
  const raw =
    body && typeof body === "object" && "reason" in body
      ? (body as { reason?: unknown }).reason
      : body && typeof body === "object" && "note" in body
        ? (body as { note?: unknown }).note
        : undefined;
  const reason = typeof raw === "string" ? raw.trim().slice(0, 1000) : "";
  if (required && reason.length < 5) {
    throw new ReconciliationError(
      400,
      "REASON_REQUIRED",
      "A reason of at least 5 characters is required",
    );
  }
  return reason;
}

export function issueForPayment(
  payment: {
    status: string;
    createdAt: Date;
    enrollmentPackageId: string | null;
  },
  enrollment?: { status: string; paymentTransactionId: string | null },
  enrollmentPackage?: { status: string; paymentTransactionId: string | null },
) {
  const target = payment.enrollmentPackageId ? enrollmentPackage : enrollment;

  if (
    (payment.status === "SUCCESS" || payment.status === "FAILED") &&
    !target
  ) {
    return {
      type: "ENROLLMENT_TARGET_NOT_FOUND",
      severity: "HIGH",
      description: "Payment references an enrollment target that could not be found.",
    };
  }

  if (payment.status === "SUCCESS" && target?.status !== "ACTIVE") {
    return {
      type: "SUCCESS_NOT_ACTIVE",
      severity: "HIGH",
      description: "Payment succeeded but the enrollment target is not active.",
    };
  }

  if (payment.status === "FAILED" && target?.status === "ACTIVE") {
    return {
      type: "FAILED_ACTIVE",
      severity: "CRITICAL",
      description: "Payment failed but the enrollment target is active.",
    };
  }

  const ageMinutes = (Date.now() - payment.createdAt.getTime()) / 60000;
  if (payment.status === "PENDING" && ageMinutes >= 30) {
    return {
      type: "STALE_PENDING",
      severity: ageMinutes >= 180 ? "HIGH" : "MEDIUM",
      description: "Payment intent has been pending longer than expected.",
    };
  }

  if (payment.status === "SUCCESS" && !target?.paymentTransactionId) {
    return {
      type: "MISSING_PAYMENT_REF",
      severity: "MEDIUM",
      description: "Payment succeeded but no provider reference is stored on the enrollment target.",
    };
  }

  return {
    type: "OK",
    severity: "LOW",
    description: "Payment and enrollment state are aligned.",
  };
}

/**
 * SQL twin of issueForPayment() so the issue filter, counts and paging run in
 * the database. Keep the branch order identical to the function above.
 */
const ISSUE_CASE_SQL = Prisma.sql`
  CASE
    WHEN pi.status IN ('SUCCESS', 'FAILED')
      AND (CASE WHEN pi.enrollment_package_id IS NOT NULL THEN ep.enrollment_package_id IS NULL ELSE e.enrollment_id IS NULL END)
      THEN 'ENROLLMENT_TARGET_NOT_FOUND'
    WHEN pi.status = 'SUCCESS'
      AND (CASE WHEN pi.enrollment_package_id IS NOT NULL THEN ep.status ELSE e.status END) IS DISTINCT FROM 'ACTIVE'
      THEN 'SUCCESS_NOT_ACTIVE'
    WHEN pi.status = 'FAILED'
      AND (CASE WHEN pi.enrollment_package_id IS NOT NULL THEN ep.status ELSE e.status END) = 'ACTIVE'
      THEN 'FAILED_ACTIVE'
    WHEN pi.status = 'PENDING' AND pi.created_at <= now() - interval '30 minutes'
      THEN 'STALE_PENDING'
    WHEN pi.status = 'SUCCESS'
      AND COALESCE(CASE WHEN pi.enrollment_package_id IS NOT NULL THEN ep.payment_transaction_id ELSE e.payment_transaction_id END, '') = ''
      THEN 'MISSING_PAYMENT_REF'
    ELSE 'OK'
  END`;

function paymentSearchSql(search: string | undefined) {
  if (!search) return Prisma.empty;
  if (UUID_RE.test(search)) {
    return Prisma.sql`AND (pi.payment_intent_id = ${search}::uuid OR pi.enrollment_id = ${search}::uuid
      OR pi.enrollment_package_id = ${search}::uuid OR pi.student_user_id = ${search}::uuid
      OR pi.earning_tutor_user_id = ${search}::uuid)`;
  }
  const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return Prisma.sql`AND (pi.provider_ref ILIKE ${like} OR pi.method ILIKE ${like}
    OR u.display_name ILIKE ${like} OR u.email ILIKE ${like})`;
}

/** Whitelisted ORDER BY for the payments queue. */
export function paymentOrderSql(sort: string | undefined, order: string | undefined) {
  const dir = order === "asc" ? "ASC" : "DESC";
  const column = sort === "amount" ? "amount_minor" : "created_at";
  return Prisma.raw(`${column} ${dir}, payment_intent_id ${dir}`);
}

export function issueFilterSql(issue: string | undefined) {
  if (!issue || issue === "ALL") return Prisma.empty;
  if (issue === "ISSUES") return Prisma.sql`AND issue_type <> 'OK'`;
  if (issue === "OK" || (ISSUE_TYPES as readonly string[]).includes(issue)) {
    return Prisma.sql`AND issue_type = ${issue}`;
  }
  throw new ReconciliationError(400, "INVALID_ISSUE_FILTER", "Unknown issue filter");
}

export async function getPaymentReconciliation(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const query = req.query as Record<string, string | undefined>;
    const daysBack = Math.min(Math.max(Number(query.days) || 30, 1), 180);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const search = query.q?.trim() || undefined;
    const { page, pageSize, skip } = parsePaging(query);
    const status = query.status && query.status !== "ALL" ? query.status : undefined;
    if (status && !PAYMENT_STATUSES.includes(status)) {
      return sendError(req, res, 400, "INVALID_STATUS_FILTER", "Unknown payment status");
    }
    const issueSql = issueFilterSql(query.issue);
    const statusSql = status ? Prisma.sql`AND status = ${status}` : Prisma.empty;

    const classified = Prisma.sql`
      WITH classified AS (
        SELECT pi.payment_intent_id, pi.created_at, pi.amount_minor, pi.status, ${ISSUE_CASE_SQL} AS issue_type
        FROM finance_mlm.payment_intents pi
        LEFT JOIN learning.enrollments e ON e.enrollment_id = pi.enrollment_id
        LEFT JOIN learning.enrollment_packages ep ON ep.enrollment_package_id = pi.enrollment_package_id
        LEFT JOIN identity.users u ON u.user_id = pi.student_user_id
        WHERE pi.created_at >= ${since} ${paymentSearchSql(search)}
      )`;

    const [pageRows, countRows, issueRows, statusGroups, totalVolume, orphanEventCount, activeWithoutPaymentCount] =
      await Promise.all([
        prisma.$queryRaw<{ id: string }[]>`${classified}
          SELECT payment_intent_id::text AS id FROM classified
          WHERE TRUE ${statusSql} ${issueSql}
          ORDER BY ${paymentOrderSql(query.sort, query.order)}
          LIMIT ${pageSize} OFFSET ${skip}`,
        prisma.$queryRaw<{ total: bigint }[]>`${classified}
          SELECT COUNT(*)::bigint AS total FROM classified WHERE TRUE ${statusSql} ${issueSql}`,
        prisma.$queryRaw<{ issue_type: string; count: bigint }[]>`${classified}
          SELECT issue_type, COUNT(*)::bigint AS count FROM classified GROUP BY issue_type`,
        prisma.paymentIntent.groupBy({
          by: ["status"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        }),
        prisma.paymentIntent.aggregate({
          where: { status: "SUCCESS", createdAt: { gte: since } },
          _sum: { amountMinor: true },
        }),
        countOpenOrphanEvents(),
        countActiveWithoutPayment(since),
      ]);

    const ids = pageRows.map((row) => row.id);
    const payments = ids.length
      ? await prisma.paymentIntent.findMany({
          where: { paymentIntentId: { in: ids } },
          include: {
            events: { orderBy: { occurredAt: "desc" }, take: 1 },
            receipt: true,
          },
        })
      : [];
    const byId = new Map(payments.map((item) => [item.paymentIntentId, item]));
    const ordered = ids.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));

    const enrollmentIds = [...new Set(ordered.map((item) => item.enrollmentId))];
    const packageIds = [
      ...new Set(
        ordered
          .map((item) => item.enrollmentPackageId)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    const studentIds = [...new Set(ordered.map((item) => item.studentUserId))];

    const [enrollments, packages, users] = await Promise.all([
      enrollmentIds.length
        ? prisma.enrollment.findMany({
            where: { enrollmentId: { in: enrollmentIds } },
            include: { class: true },
          })
        : [],
      packageIds.length
        ? prisma.enrollmentPackage.findMany({
            where: { enrollmentPackageId: { in: packageIds } },
          })
        : [],
      studentIds.length
        ? prisma.user.findMany({
            where: { userId: { in: studentIds } },
            select: { userId: true, displayName: true, email: true, role: true, isActive: true },
          })
        : [],
    ]);

    const enrollmentMap = new Map(enrollments.map((item) => [item.enrollmentId, item]));
    const packageMap = new Map(packages.map((item) => [item.enrollmentPackageId, item]));
    const userMap = new Map(users.map((item) => [item.userId, item]));

    const paymentItems = ordered.map((payment) => {
      const enrollment = enrollmentMap.get(payment.enrollmentId);
      const enrollmentPackage = payment.enrollmentPackageId
        ? packageMap.get(payment.enrollmentPackageId)
        : undefined;
      const student = userMap.get(payment.studentUserId);
      const issue = issueForPayment(payment, enrollment, enrollmentPackage);

      return {
        paymentIntentId: payment.paymentIntentId,
        enrollmentId: payment.enrollmentId,
        enrollmentPackageId: payment.enrollmentPackageId,
        studentUserId: payment.studentUserId,
        studentName: student?.displayName || student?.email || null,
        studentIsActive: student?.isActive ?? null,
        amountMinor: toNumber(payment.amountMinor),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        providerRef: payment.providerRef,
        receiptStatus: payment.receipt?.status ?? null,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        paidAt: payment.paidAt,
        enrollmentStatus: enrollment?.status ?? null,
        enrollmentPaymentTransactionId: enrollment?.paymentTransactionId ?? null,
        packageStatus: enrollmentPackage?.status ?? null,
        packagePaymentTransactionId: enrollmentPackage?.paymentTransactionId ?? null,
        classId: enrollment?.classId ?? null,
        classTitle: enrollment?.class.title ?? null,
        tutorUserId: payment.earningTutorUserId ?? enrollment?.class.tutorUserId ?? null,
        lastEventType: payment.events[0]?.eventType ?? null,
        lastEventAt: payment.events[0]?.occurredAt ?? null,
        issue,
        actions: availablePaymentActions(payment, issue.type),
      };
    });

    const statusCounts = statusGroups.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    const issueCounts = issueRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.issue_type] = Number(row.count);
      return acc;
    }, {});
    const paymentIssueCount = ISSUE_TYPES.reduce((sum, type) => sum + (issueCounts[type] ?? 0), 0);

    return res.status(200).json({
      summary: {
        daysBack,
        totalPayments: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        successfulPayments: statusCounts.SUCCESS ?? 0,
        pendingPayments: statusCounts.PENDING ?? 0,
        failedPayments: statusCounts.FAILED ?? 0,
        successVolumeMinor: toNumber(totalVolume._sum.amountMinor) ?? 0,
        issueCount: paymentIssueCount + orphanEventCount + activeWithoutPaymentCount,
        paymentIssueCount,
        orphanEventCount,
        activeWithoutPaymentCount,
        issueCounts,
        statusCounts,
      },
      payments: paymentItems,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Get Payment Reconciliation Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch payment reconciliation");
  }
}

/** Which typed repair actions apply to a payment row (UI shows only these). */
export function availablePaymentActions(
  payment: { status: string; providerRef: string | null },
  issueType: string,
) {
  const actions: string[] = [];
  if (
    payment.status === "SUCCESS" &&
    (issueType === "SUCCESS_NOT_ACTIVE" || issueType === "MISSING_PAYMENT_REF")
  ) {
    actions.push("ACTIVATE_ENROLLMENT");
  }
  if (payment.providerRef && ["PENDING", "FAILED"].includes(payment.status)) {
    actions.push("VERIFY_WITH_PROVIDER");
  }
  return actions;
}

// ── Orphan webhook events ──────────────────────────────────────────────────

async function dismissedOrphanIds() {
  const rows = await prisma.auditEvent.findMany({
    where: { action: ORPHAN_DISMISS_ACTION, entityType: "PaymentEvent" },
    select: { entityId: true },
  });
  return [...new Set(rows.map((row) => row.entityId))];
}

async function countOpenOrphanEvents() {
  const dismissed = await dismissedOrphanIds();
  return prisma.paymentEvent.count({
    where: {
      paymentIntentId: null,
      ...(dismissed.length ? { paymentEventId: { notIn: dismissed } } : {}),
    },
  });
}

function readChargeFromPayload(payload: unknown) {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
  const amount = Number(data.amount);
  return {
    chargeId: typeof data.id === "string" ? data.id : null,
    chargeStatus: typeof data.status === "string" ? data.status : null,
    amountMinor: Number.isFinite(amount) && data.amount != null ? amount : null,
    currency: typeof data.currency === "string" ? data.currency.toUpperCase() : null,
    metadataPaymentIntentId:
      typeof metadata.paymentIntentId === "string" ? metadata.paymentIntentId : null,
  };
}

export async function getOrphanEvents(req: AuthenticatedRequest, res: Response) {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { page, pageSize, skip } = parsePaging(query);
    const state = (query.state || "OPEN").toUpperCase();
    const search = query.q?.trim();
    const dismissed = await dismissedOrphanIds();

    const where: Prisma.PaymentEventWhereInput = { paymentIntentId: null };
    if (state === "OPEN" && dismissed.length) where.paymentEventId = { notIn: dismissed };
    if (state === "DISMISSED") where.paymentEventId = { in: dismissed };
    if (search) {
      where.OR = [
        ...(UUID_RE.test(search) ? [{ paymentEventId: search }] : []),
        { providerEventId: { contains: search, mode: "insensitive" } },
        { eventType: { contains: search, mode: "insensitive" } },
        { rawPayload: { path: ["data", "id"], string_contains: search } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.paymentEvent.findMany({
        where,
        orderBy: { createdAt: query.order === "asc" ? "asc" : "desc" },
        skip,
        take: pageSize,
      }),
      prisma.paymentEvent.count({ where }),
    ]);

    const parsed = events.map((event) => ({ event, charge: readChargeFromPayload(event.rawPayload) }));
    const chargeIds = parsed.map((p) => p.charge.chargeId).filter((id): id is string => Boolean(id));
    const metaIds = parsed
      .map((p) => p.charge.metadataPaymentIntentId)
      .filter((id): id is string => Boolean(id) && UUID_RE.test(id as string));
    const candidates =
      chargeIds.length || metaIds.length
        ? await prisma.paymentIntent.findMany({
            where: {
              OR: [
                ...(chargeIds.length ? [{ providerRef: { in: chargeIds } }] : []),
                ...(metaIds.length ? [{ paymentIntentId: { in: metaIds } }] : []),
              ],
            },
            select: { paymentIntentId: true, providerRef: true, status: true, amountMinor: true, studentUserId: true },
          })
        : [];

    const dismissedSet = new Set(dismissed);
    const dismissAudit = dismissed.length
      ? await prisma.auditEvent.findMany({
          where: {
            action: ORPHAN_DISMISS_ACTION,
            entityType: "PaymentEvent",
            entityId: { in: events.map((e) => e.paymentEventId) },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return res.status(200).json({
      items: parsed.map(({ event, charge }) => {
        const candidate =
          candidates.find((c) => charge.chargeId && c.providerRef === charge.chargeId) ??
          candidates.find((c) => c.paymentIntentId === charge.metadataPaymentIntentId);
        const dismissal = dismissAudit.find((a) => a.entityId === event.paymentEventId);
        const dismissalPayload = (dismissal?.payload ?? {}) as Record<string, unknown>;
        return {
          paymentEventId: event.paymentEventId,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          createdAt: event.createdAt,
          ...charge,
          dismissed: dismissedSet.has(event.paymentEventId),
          dismissedAt: dismissal?.createdAt ?? null,
          dismissedBy: dismissal?.actorId ?? null,
          dismissReason: typeof dismissalPayload.reason === "string" ? dismissalPayload.reason : null,
          candidate: candidate
            ? {
                paymentIntentId: candidate.paymentIntentId,
                providerRef: candidate.providerRef,
                status: candidate.status,
                amountMinor: toNumber(candidate.amountMinor),
                studentUserId: candidate.studentUserId,
              }
            : null,
        };
      }),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error("Get Orphan Events Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch orphan webhook events");
  }
}

/**
 * Attach an orphan webhook event to the payment intent it belongs to. Only
 * allowed when the event's charge id equals the intent's stored provider ref,
 * so an admin cannot attach arbitrary money to an arbitrary intent. Payment
 * state is NOT changed here; use "verify with provider" afterwards.
 */
export async function linkOrphanEvent(req: AuthenticatedRequest, res: Response) {
  const actorId = req.user?.userId;
  try {
    const reason = readReason(req.body);
    const { id } = req.params;
    const paymentIntentId = String((req.body as { paymentIntentId?: unknown })?.paymentIntentId ?? "").trim();
    if (!UUID_RE.test(id) || !UUID_RE.test(paymentIntentId)) {
      return sendError(req, res, 400, "BAD_REQUEST", "Valid event id and paymentIntentId are required");
    }
    const [event, intent] = await Promise.all([
      prisma.paymentEvent.findUnique({ where: { paymentEventId: id } }),
      prisma.paymentIntent.findUnique({ where: { paymentIntentId } }),
    ]);
    if (!event) return sendError(req, res, 404, "NOT_FOUND", "Payment event not found");
    if (!intent) return sendError(req, res, 404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent not found");
    if (event.paymentIntentId) {
      if (event.paymentIntentId === paymentIntentId) {
        return res.status(200).json({ success: true, changed: false, paymentIntentId });
      }
      return sendError(req, res, 409, "EVENT_ALREADY_LINKED", "Event is already linked to another payment");
    }
    const charge = readChargeFromPayload(event.rawPayload);
    if (!charge.chargeId || !intent.providerRef || charge.chargeId !== intent.providerRef) {
      return sendError(
        req,
        res,
        409,
        "CHARGE_REF_MISMATCH",
        "The event's charge id does not match the payment's provider reference",
        { chargeId: charge.chargeId, providerRef: intent.providerRef },
      );
    }

    const changed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentEvent.updateMany({
        where: { paymentEventId: id, paymentIntentId: null },
        data: { paymentIntentId },
      });
      if (claimed.count !== 1) return false;
      await tx.auditEvent.create({
        data: {
          actorId: actorId || "SYSTEM",
          action: "RECONCILIATION_ORPHAN_LINK",
          entityType: "PaymentEvent",
          entityId: id,
          payload: { paymentIntentId, chargeId: charge.chargeId, reason },
        },
      });
      return true;
    });

    return res.status(200).json({ success: true, changed, paymentIntentId });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Link Orphan Event Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not link payment event");
  }
}

/** Mark an orphan event as reviewed (audit-only; the raw event is kept). */
export async function dismissOrphanEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const reason = readReason(req.body);
    const { id } = req.params;
    if (!UUID_RE.test(id)) return sendError(req, res, 400, "BAD_REQUEST", "Invalid event id");
    const event = await prisma.paymentEvent.findUnique({ where: { paymentEventId: id } });
    if (!event) return sendError(req, res, 404, "NOT_FOUND", "Payment event not found");
    if (event.paymentIntentId) {
      return sendError(req, res, 409, "EVENT_ALREADY_LINKED", "Event is linked to a payment");
    }
    const existing = await prisma.auditEvent.findFirst({
      where: { action: ORPHAN_DISMISS_ACTION, entityType: "PaymentEvent", entityId: id },
    });
    if (existing) return res.status(200).json({ success: true, changed: false });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user?.userId || "SYSTEM",
        action: ORPHAN_DISMISS_ACTION,
        entityType: "PaymentEvent",
        entityId: id,
        payload: {
          reason,
          providerEventId: event.providerEventId,
          chargeId: readChargeFromPayload(event.rawPayload).chargeId,
        },
      },
    });
    return res.status(200).json({ success: true, changed: true });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Dismiss Orphan Event Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not dismiss payment event");
  }
}

// ── Active enrollments without a successful payment ───────────────────────

async function countActiveWithoutPayment(since: Date) {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM learning.enrollments e
    WHERE e.status = 'ACTIVE' AND e.created_at >= ${since}
      AND NOT EXISTS (
        SELECT 1 FROM finance_mlm.payment_intents pi
        WHERE pi.enrollment_id = e.enrollment_id AND pi.status = 'SUCCESS')`;
  return Number(rows[0]?.total ?? 0);
}

export async function getActiveWithoutPayment(req: AuthenticatedRequest, res: Response) {
  try {
    const query = req.query as Record<string, string | undefined>;
    const daysBack = Math.min(Math.max(Number(query.days) || 30, 1), 180);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const { page, pageSize, skip } = parsePaging(query);
    const search = query.q?.trim();
    let searchSql = Prisma.empty;
    if (search) {
      if (UUID_RE.test(search)) {
        searchSql = Prisma.sql`AND (e.enrollment_id = ${search}::uuid OR e.student_user_id = ${search}::uuid OR e.class_id = ${search}::uuid)`;
      } else {
        const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
        searchSql = Prisma.sql`AND (c.title ILIKE ${like} OR u.display_name ILIKE ${like} OR u.email ILIKE ${like} OR e.payment_transaction_id ILIKE ${like})`;
      }
    }
    const base = Prisma.sql`
      FROM learning.enrollments e
      JOIN learning.classes c ON c.class_id = e.class_id
      LEFT JOIN identity.users u ON u.user_id = e.student_user_id
      WHERE e.status = 'ACTIVE' AND e.created_at >= ${since}
        AND NOT EXISTS (
          SELECT 1 FROM finance_mlm.payment_intents pi
          WHERE pi.enrollment_id = e.enrollment_id AND pi.status = 'SUCCESS')
        ${searchSql}`;
    const [rows, count] = await Promise.all([
      prisma.$queryRaw<
        {
          enrollment_id: string;
          student_user_id: string;
          class_id: string;
          class_title: string | null;
          tutor_user_id: string | null;
          student_name: string | null;
          status: string;
          payment_transaction_id: string | null;
          created_at: Date;
          updated_at: Date;
          latest_payment_status: string | null;
        }[]
      >`SELECT e.enrollment_id::text, e.student_user_id::text, e.class_id::text, c.title AS class_title,
          c.tutor_user_id::text, COALESCE(u.display_name, u.email) AS student_name, e.status,
          e.payment_transaction_id, e.created_at, e.updated_at,
          (SELECT pi.status FROM finance_mlm.payment_intents pi WHERE pi.enrollment_id = e.enrollment_id
             ORDER BY pi.created_at DESC LIMIT 1) AS latest_payment_status
        ${base}
        ORDER BY e.updated_at ${Prisma.raw(query.order === "asc" ? "ASC" : "DESC")}
        LIMIT ${pageSize} OFFSET ${skip}`,
      prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*)::bigint AS total ${base}`,
    ]);
    return res.status(200).json({
      items: rows.map((row) => ({
        enrollmentId: row.enrollment_id,
        studentUserId: row.student_user_id,
        studentName: row.student_name,
        classId: row.class_id,
        classTitle: row.class_title,
        tutorUserId: row.tutor_user_id,
        status: row.status,
        paymentTransactionId: row.payment_transaction_id,
        latestPaymentStatus: row.latest_payment_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: Number(count[0]?.total ?? 0),
      page,
      pageSize,
      daysBack,
    });
  } catch (error) {
    logger.error("Get Active Without Payment Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch enrollments without payment");
  }
}

// ── Repair actions ─────────────────────────────────────────────────────────

const ACTIVATABLE_ENROLLMENT_STATUSES = ["PENDING_PAYMENT", "CANCELLED", "ACTIVE"];

export interface ActivationResult {
  changed: boolean;
  paymentIntentId: string;
  target: "ENROLLMENT" | "PACKAGE";
  targetId: string;
  previousStatus: string;
  status: string;
}

/**
 * Give a student the access a SUCCESSFUL payment already paid for: the same
 * state changes fulfillPaymentIntent() (the webhook path) makes, for intents
 * whose fulfilment did not complete. Idempotent: a target that is already
 * ACTIVE with the provider ref is left alone (changed=false). Never confirms a
 * payment that is not SUCCESS — use verifyPaymentWithProvider() for that.
 */
export async function activatePaidEnrollment(
  paymentIntentId: string,
  actorId: string,
  reason: string,
  source: string,
): Promise<ActivationResult> {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.paymentIntent.findUnique({ where: { paymentIntentId } });
    if (!intent) {
      throw new ReconciliationError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent not found");
    }
    if (intent.status !== "SUCCESS") {
      throw new ReconciliationError(
        409,
        "PAYMENT_NOT_SUCCESSFUL",
        "Only a successful payment can activate an enrollment",
        { status: intent.status },
      );
    }
    const providerRef = intent.providerRef;

    let result: ActivationResult;
    if (intent.enrollmentPackageId) {
      const pkg = await tx.enrollmentPackage.findUnique({
        where: { enrollmentPackageId: intent.enrollmentPackageId },
      });
      if (!pkg) {
        throw new ReconciliationError(409, "ENROLLMENT_TARGET_NOT_FOUND", "Enrollment package not found");
      }
      if (!ACTIVATABLE_ENROLLMENT_STATUSES.includes(pkg.status)) {
        throw new ReconciliationError(
          409,
          "ENROLLMENT_STATE_NOT_ACTIVATABLE",
          "Package is in a state that cannot be activated",
          { status: pkg.status },
        );
      }
      const needsChange = pkg.status !== "ACTIVE" || (!pkg.paymentTransactionId && Boolean(providerRef));
      if (needsChange) {
        await tx.enrollmentPackage.update({
          where: { enrollmentPackageId: pkg.enrollmentPackageId },
          data: { status: "ACTIVE", paymentTransactionId: pkg.paymentTransactionId || providerRef, updatedAt: new Date() },
        });
      }
      result = {
        changed: needsChange,
        paymentIntentId,
        target: "PACKAGE",
        targetId: pkg.enrollmentPackageId,
        previousStatus: pkg.status,
        status: "ACTIVE",
      };
    } else {
      const enrollment = await tx.enrollment.findUnique({ where: { enrollmentId: intent.enrollmentId } });
      if (!enrollment) {
        throw new ReconciliationError(409, "ENROLLMENT_TARGET_NOT_FOUND", "Enrollment not found");
      }
      if (!ACTIVATABLE_ENROLLMENT_STATUSES.includes(enrollment.status)) {
        throw new ReconciliationError(
          409,
          "ENROLLMENT_STATE_NOT_ACTIVATABLE",
          "Enrollment is in a state that cannot be activated",
          { status: enrollment.status },
        );
      }
      const needsChange =
        enrollment.status !== "ACTIVE" || (!enrollment.paymentTransactionId && Boolean(providerRef));
      if (needsChange) {
        // Guard on the status we read so a concurrent change is not overwritten.
        const claimed = await tx.enrollment.updateMany({
          where: { enrollmentId: enrollment.enrollmentId, status: enrollment.status },
          data: {
            status: "ACTIVE",
            paymentTransactionId: enrollment.paymentTransactionId || providerRef,
            paymentExpiresAt: null,
            updatedAt: new Date(),
          },
        });
        if (claimed.count !== 1) {
          throw new ReconciliationError(409, "CONCURRENT_UPDATE", "Enrollment changed while activating; reload and retry");
        }
        if (enrollment.status === "CANCELLED") {
          // Mirrors fulfillPaymentIntent(): a cancelled seat is taken again.
          await tx.class.update({
            where: { classId: enrollment.classId },
            data: { enrolledCount: { increment: 1 } },
          });
        }
        await tx.enrollmentPackage.updateMany({
          where: { enrollmentId: enrollment.enrollmentId, status: "PENDING_PAYMENT" },
          data: { status: "ACTIVE", paymentTransactionId: providerRef },
        });
      }
      result = {
        changed: needsChange,
        paymentIntentId,
        target: "ENROLLMENT",
        targetId: enrollment.enrollmentId,
        previousStatus: enrollment.status,
        status: "ACTIVE",
      };
    }

    await tx.paymentReceipt.upsert({
      where: { paymentIntentId },
      update: {},
      create: {
        paymentIntentId,
        studentUserId: intent.studentUserId,
        receiptNumber: buildReceiptNumber(paymentIntentId),
        grossAmountMinor: intent.amountMinor,
        vatAmountMinor: 0n,
        netAmountMinor: intent.amountMinor,
        currency: intent.currency,
      },
    });

    if (result.changed) {
      await tx.auditEvent.create({
        data: {
          actorId,
          action: "RECONCILIATION_ACTIVATE_ENROLLMENT",
          entityType: "PaymentIntent",
          entityId: paymentIntentId,
          payload: {
            reason,
            source,
            target: result.target,
            targetId: result.targetId,
            previousStatus: result.previousStatus,
            newStatus: result.status,
            providerRef,
            amountMinor: intent.amountMinor.toString(),
          },
        },
      });
    }
    return result;
  });
}

export async function activatePaymentEnrollment(req: AuthenticatedRequest, res: Response) {
  try {
    const reason = readReason(req.body);
    const { id } = req.params;
    if (!UUID_RE.test(id)) return sendError(req, res, 400, "BAD_REQUEST", "Invalid payment id");
    const result = await activatePaidEnrollment(id, req.user?.userId || "SYSTEM", reason, "RECONCILIATION");
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Activate Payment Enrollment Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not activate enrollment");
  }
}

/**
 * Re-check a PENDING/FAILED payment against Omise and apply the result through
 * the exact webhook path (retrieveAndVerifyOmiseCharge → fulfillPaymentIntent /
 * markPaymentIntentFailed). Read-only towards Omise; idempotent.
 */
export async function verifyPaymentWithProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const reason = readReason(req.body, { required: false });
    const { id } = req.params;
    if (!UUID_RE.test(id)) return sendError(req, res, 400, "BAD_REQUEST", "Invalid payment id");
    const intent = await prisma.paymentIntent.findUnique({ where: { paymentIntentId: id } });
    if (!intent) return sendError(req, res, 404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent not found");
    if (!intent.providerRef) {
      return sendError(req, res, 409, "NO_PROVIDER_REF", "This payment has no provider charge to verify");
    }
    if (!["PENDING", "FAILED"].includes(intent.status)) {
      return res.status(200).json({ success: true, outcome: "UNCHANGED", status: intent.status });
    }

    let charge: Awaited<ReturnType<typeof retrieveAndVerifyOmiseCharge>>;
    try {
      charge = await retrieveAndVerifyOmiseCharge(intent.paymentIntentId, intent.providerRef);
    } catch (providerError) {
      logger.warn("Verify payment with provider failed", { error: providerError });
      const providerMessage = providerError instanceof Error ? providerError.message : String(providerError);
      if (providerMessage === "OMISE_PRIVATE_KEY_NOT_CONFIGURED") {
        return sendError(req, res, 503, "OMISE_PRIVATE_KEY_NOT_CONFIGURED", "Omise is not configured");
      }
      return sendError(req, res, 502, "PROVIDER_UNAVAILABLE", "Could not reach the payment provider", {
        providerMessage: providerMessage.slice(0, 200),
      });
    }
    if (!charge) {
      return sendError(
        req,
        res,
        409,
        "CHARGE_VERIFICATION_FAILED",
        "The provider charge does not match this payment (id, amount, currency or metadata)",
      );
    }

    let outcome = "UNCHANGED";
    let status = intent.status;
    if (charge.paid || charge.status === "successful") {
      const updated = await fulfillPaymentIntent(intent.paymentIntentId, charge.id);
      status = updated.status;
      outcome = updated.status === "SUCCESS" ? "CONFIRMED" : "DUPLICATE_PAYMENT";
    } else if (intent.status === "PENDING" && ["failed", "expired", "reversed"].includes(charge.status)) {
      const updated = await markPaymentIntentFailed(intent.paymentIntentId, charge.id);
      status = updated.status;
      outcome = "MARKED_FAILED";
    }

    await prisma.auditEvent.create({
      data: {
        actorId: req.user?.userId || "SYSTEM",
        action: "RECONCILIATION_VERIFY_PAYMENT",
        entityType: "PaymentIntent",
        entityId: intent.paymentIntentId,
        payload: {
          reason: reason || null,
          previousStatus: intent.status,
          newStatus: status,
          outcome,
          chargeStatus: charge.status,
          providerRef: charge.id,
        },
      },
    });

    return res.status(200).json({ success: true, outcome, status, chargeStatus: charge.status });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Verify Payment Error:", error);
    return sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not verify payment");
  }
}
