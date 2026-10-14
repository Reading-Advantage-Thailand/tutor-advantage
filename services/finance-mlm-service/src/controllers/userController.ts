import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma, type Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { createOmiseRecipient, isOmiseConfigured } from "../services/omiseService";
import { AUDIT_ACTIONS, AUDIT_ENTITY, buildAuditEventData } from "../services/auditService";

/*
 * Admin user directory, verification review, suspension and PDPA erasure.
 *
 * Security notes (admin audit G4):
 * - The list endpoint never returns `settings` (bank account, national ID, address).
 * - The detail endpoint masks PII for FINANCE_CHECKER on the server.
 * - Verification can only approve/reject fields the tutor actually submitted
 *   (status PENDING); every decision writes an audit event in the same transaction.
 * - Anonymize scrubs every PII field (settings, documents, picture, DOB, OAuth
 *   identities, guardian names, payout recipient snapshots) and is idempotent.
 */

const ACTIVE_CLASS_STATUSES = ["ACTIVE", "OPEN", "IN_PROGRESS", "PUBLISHED"];
const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "PAID"];
export const VERIFICATION_FIELDS = ["idCard", "bankBook", "address", "taxInfo"] as const;
export type VerificationField = (typeof VERIFICATION_FIELDS)[number];
const LISTED_ROLES = ["TUTOR", "STUDENT"];
const STAFF_ROLES = ["ADMIN", "FINANCE_CHECKER"];
/** Settlement runs that are still being prepared / reviewed (money not final). */
const OPEN_RUN_STATUSES = ["DRAFT", "SUBMITTED", "REFRESHING", "APPROVING"];
export const ANONYMIZED_DISPLAY_NAME = "Anonymized User";
const REDACTED = "[ลบข้อมูลแล้ว]";

const fieldLabels: Record<VerificationField, string> = {
  idCard: "ID card",
  bankBook: "Bank book",
  address: "Address",
  taxInfo: "Tax info",
};

type Settings = Record<string, any>;
const asSettings = (value: unknown): Settings =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Settings) } : {};

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parsePositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function cleanReason(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isAnonymized(settingsValue: unknown): boolean {
  return Boolean(asSettings(settingsValue).anonymizedAt);
}

export function accountStatusOf(user: { isActive: boolean; settings?: unknown; displayName?: string | null }) {
  if (isAnonymized(user.settings) || user.displayName === ANONYMIZED_DISPLAY_NAME) return "ANONYMIZED";
  return user.isActive ? "ACTIVE" : "SUSPENDED";
}

function getSubmittedVerificationFields(settingsValue: unknown) {
  const verification = asSettings(settingsValue).verification || {};
  return VERIFICATION_FIELDS.filter(
    (field) => verification[field]?.status === "PENDING",
  ).map((field) => ({
    field,
    label: fieldLabels[field],
    updatedAt: verification[field]?.updatedAt,
  }));
}

/* ─── PII masking ─────────────────────────────────────────────────────── */

export function maskTail(value: unknown, visible = 4): string | null {
  if (typeof value !== "string" || !value) return null;
  const digits = value.replace(/\s|-/g, "");
  if (digits.length <= visible) return "•".repeat(digits.length);
  return `${"•".repeat(Math.max(0, digits.length - visible))}${digits.slice(-visible)}`;
}

/**
 * Settings as a given staff role may see them.
 * ADMIN: everything (they review documents). FINANCE_CHECKER: no national ID,
 * no address, bank account last 4 only; booleans say whether the data exists.
 */
export function settingsForRole(settingsValue: unknown, role: string | undefined) {
  const settings = asSettings(settingsValue);
  const verification = settings.verification || {};
  const base = {
    bankBrand: settings.bankBrand ?? null,
    omiseRecipientId: settings.omiseRecipientId ?? null,
    verification,
    anonymizedAt: settings.anonymizedAt ?? null,
  };
  if (role === "ADMIN") {
    return {
      ...base,
      address: settings.address ?? null,
      bankAccountNumber: settings.bankAccountNumber ?? null,
      taxName: settings.taxName ?? null,
      nationalId: settings.nationalId ?? null,
      masked: false,
    };
  }
  return {
    ...base,
    address: null,
    hasAddress: Boolean(settings.address),
    bankAccountNumber: maskTail(settings.bankAccountNumber),
    taxName: settings.taxName ?? null,
    nationalId: null,
    hasNationalId: Boolean(settings.nationalId),
    masked: true,
  };
}

/* ─── List ────────────────────────────────────────────────────────────── */

async function getUserClassCounts(userIds: string[]) {
  if (userIds.length === 0) {
    return { tutor: new Map<string, number>(), student: new Map<string, number>() };
  }

  const [tutorCounts, studentCounts] = await Promise.all([
    prisma.class.groupBy({
      by: ["tutorUserId"],
      where: {
        tutorUserId: { in: userIds },
        status: { in: ACTIVE_CLASS_STATUSES },
      },
      _count: { classId: true },
    }),
    prisma.enrollment.groupBy({
      by: ["studentUserId"],
      where: {
        studentUserId: { in: userIds },
        status: { in: ACTIVE_ENROLLMENT_STATUSES },
      },
      _count: { enrollmentId: true },
    }),
  ]);

  return {
    tutor: new Map(tutorCounts.map((item) => [item.tutorUserId, item._count.classId])),
    student: new Map(
      studentCounts.map((item) => [item.studentUserId, item._count.enrollmentId]),
    ),
  };
}

/** Users with at least one verification field waiting for review. */
const pendingFieldsWhere = (): Prisma.UserWhereInput => ({
  OR: VERIFICATION_FIELDS.map((field) => ({
    settings: { path: ["verification", field, "status"], equals: "PENDING" },
  })),
});

/**
 * Anonymize always sets this display name (also the legacy implementation), so
 * it is the SQL-friendly marker; settings.anonymizedAt is the detailed one.
 */
const anonymizedWhere = (): Prisma.UserWhereInput => ({ displayName: ANONYMIZED_DISPLAY_NAME });
const notAnonymizedWhere = (): Prisma.UserWhereInput => ({
  OR: [{ displayName: null }, { displayName: { not: ANONYMIZED_DISPLAY_NAME } }],
});

export function buildUserListWhere(query: Record<string, unknown>): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  const role = typeof query.role === "string" ? query.role.toUpperCase() : "";
  and.push({ role: LISTED_ROLES.includes(role) ? role : { in: LISTED_ROLES } });

  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  if (q) {
    const or: Prisma.UserWhereInput[] = [
      { displayName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q } },
    ];
    if (isUuid(q)) or.push({ userId: q });
    and.push({ OR: or });
  }

  const status = typeof query.status === "string" ? query.status.toUpperCase() : "";
  if (status === "ACTIVE") and.push({ isActive: true });
  if (status === "SUSPENDED") and.push({ isActive: false }, notAnonymizedWhere());
  if (status === "ANONYMIZED") and.push(anonymizedWhere());

  const verification =
    typeof query.verification === "string" ? query.verification.toUpperCase() : "";
  if (verification === "REVIEW") {
    // "Needs review" = any submitted field still PENDING (also catches tutors whose
    // overall status is REJECTED because another field was rejected).
    and.push(pendingFieldsWhere());
  } else if (["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"].includes(verification)) {
    and.push({ verificationStatus: verification });
  }

  return { AND: and };
}

/**
 * The admin verification queue: tutors with any verification field PENDING.
 * Same rule as GET /v1/users?role=TUTOR&verification=REVIEW (the list the
 * overview queue and the sidebar badge link to), so the count always matches.
 */
export function tutorVerificationReviewWhere(): Prisma.UserWhereInput {
  return buildUserListWhere({ role: "TUTOR", verification: "REVIEW" });
}

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "FINANCE_CHECKER") {
    return sendError(res, 403, "FORBIDDEN", "Requires Admin privileges");
  }

  const page = parsePositiveInt(req.query.page, 1, 10_000);
  // `limit` is the legacy name used by the old admin page.
  const pageSize = parsePositiveInt(req.query.pageSize ?? req.query.limit, 20, 100);
  const sortKey = req.query.sort === "name" ? "name" : "createdAt";
  const order: Prisma.SortOrder = req.query.order === "asc" ? "asc" : "desc";
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sortKey === "name"
      ? [{ displayName: { sort: order, nulls: "last" } }, { createdAt: "desc" }]
      : [{ createdAt: order }, { userId: "asc" }];

  try {
    const where = buildUserListWhere(req.query as Record<string, unknown>);
    const [total, users, counts] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          userId: true,
          displayName: true,
          role: true,
          email: true,
          profilePictureUrl: true,
          verificationStatus: true,
          // Read only to compute pending fields / anonymized flag; never returned.
          settings: true,
          isActive: true,
          createdAt: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      Promise.all([
        prisma.user.count({ where: { role: { in: LISTED_ROLES } } }),
        prisma.user.count({ where: { role: "TUTOR" } }),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { AND: [{ role: "TUTOR" }, pendingFieldsWhere()] } }),
        prisma.user.count({ where: { role: { in: LISTED_ROLES }, isActive: false } }),
      ]),
    ]);

    const userIds = users.map((user) => user.userId);
    const [classCounts, guardianCounts] = await Promise.all([
      getUserClassCounts(userIds),
      prisma.guardianConsent.groupBy({
        by: ["studentUserId"],
        where: { studentUserId: { in: userIds } },
        _count: { consentId: true },
      }),
    ]);
    const guardianMap = new Map(
      guardianCounts.map((item) => [item.studentUserId, item._count.consentId]),
    );

    const formattedUsers = users.map((user) => {
      const submittedVerificationFields = getSubmittedVerificationFields(user.settings);
      const activeClasses =
        user.role === "TUTOR"
          ? (classCounts.tutor.get(user.userId) ?? 0)
          : (classCounts.student.get(user.userId) ?? 0);

      return {
        id: user.userId,
        // displayName may be null (LINE sign-ups) and email may be null too.
        name: user.displayName || user.email || null,
        displayName: user.displayName ?? null,
        role: user.role,
        email: user.email ?? null,
        profilePictureUrl: user.profilePictureUrl ?? null,
        activeClasses,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        accountStatus: accountStatusOf(user),
        verificationStatus: user.verificationStatus,
        submittedVerificationFields,
        pendingVerificationCount: submittedVerificationFields.length,
        guardianSetup:
          user.role === "STUDENT" ? (guardianMap.get(user.userId) ?? 0) > 0 : true,
        joined: user.createdAt.toISOString().split("T")[0],
        createdAt: user.createdAt.toISOString(),
      };
    });

    const [all, tutors, students, pendingReview, inactive] = counts;
    res.status(200).json({
      users: formattedUsers,
      items: formattedUsers,
      total,
      page,
      pageSize,
      counts: { all, tutors, students, pendingReview, inactive },
    });
  } catch (error) {
    logger.error("Get Users Error:", error);
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch users");
  }
};

/* ─── Detail ──────────────────────────────────────────────────────────── */

export const getUserDetails = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  const viewerRole = req.user?.role;
  const isAdmin = viewerRole === "ADMIN";

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      include: {
        userConsents: { orderBy: { createdAt: "desc" } },
        oauthIdentities: { select: { provider: true, createdAt: true } },
      },
    });

    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    }

    const [guardianConsents, tutorClasses, enrollments, sponsor] = await Promise.all([
      prisma.guardianConsent.findMany({
        where: { studentUserId: id },
        select: { consentId: true, guardianName: true, relation: true, consentedAt: true },
        orderBy: { consentedAt: "desc" },
      }),
      prisma.class.findMany({
        where: { tutorUserId: id },
        include: { book: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.enrollment.findMany({
        where: { studentUserId: id },
        include: { class: { include: { book: { select: { title: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      user.sponsorTutorId
        ? prisma.user.findUnique({
            where: { userId: user.sponsorTutorId },
            select: { userId: true, displayName: true },
          })
        : Promise.resolve(null),
    ]);

    const classes =
      user.role === "TUTOR"
        ? tutorClasses.map((cls) => ({
            id: cls.classId,
            name: cls.title,
            students: cls.enrolledCount,
            capacity: cls.capacity,
            status: cls.status,
            bookTitle: cls.book.title,
            startsAt: cls.startsAt?.toISOString() ?? null,
          }))
        : enrollments.map((enrollment) => ({
            id: enrollment.class.classId,
            enrollmentId: enrollment.enrollmentId,
            name: enrollment.class.title,
            students: enrollment.class.enrolledCount,
            capacity: enrollment.class.capacity,
            status: enrollment.status,
            bookTitle: enrollment.class.book.title,
            startsAt: enrollment.class.startsAt?.toISOString() ?? null,
            enrolledAt: enrollment.createdAt.toISOString(),
          }));

    const settings = settingsForRole(user.settings, viewerRole);

    res.status(200).json({
      user: {
        id: user.userId,
        name: user.displayName ?? null,
        email: user.email ?? null,
        phone: isAdmin ? user.phoneNumber : maskTail(user.phoneNumber, 3),
        dateOfBirth: isAdmin ? (user.dateOfBirth?.toISOString().slice(0, 10) ?? null) : null,
        role: user.role,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        accountStatus: accountStatusOf(user),
        anonymizedAt: settings.anonymizedAt,
        joinedAt: user.createdAt.toISOString(),
        profilePictureUrl: user.profilePictureUrl ?? null,
        // Document images are identity documents: ADMIN only.
        idCardImageUrl: isAdmin ? user.idCardImageUrl : null,
        bankBookImageUrl: isAdmin ? user.bankBookImageUrl : null,
        hasIdCardImage: Boolean(user.idCardImageUrl),
        hasBankBookImage: Boolean(user.bankBookImageUrl),
        verificationStatus: user.verificationStatus,
        verificationComment: user.verificationComment,
        settings,
        piiMasked: settings.masked,
        sponsor: sponsor ? { id: sponsor.userId, name: sponsor.displayName } : null,
        loginProviders: user.oauthIdentities.map((identity) => identity.provider),
        guardianSetup: user.role === "STUDENT" ? guardianConsents.length > 0 : true,
        guardians: guardianConsents.map((consent) => ({
          id: consent.consentId,
          name: isAdmin ? consent.guardianName : null,
          relation: consent.relation,
          consentedAt: consent.consentedAt.toISOString(),
        })),
        consentLogs: user.userConsents.map((consent) => ({
          id: consent.userConsentId,
          version: consent.effectiveAt.toISOString().split("T")[0],
          type: consent.consentType,
          status: consent.status,
          timestamp: consent.createdAt.toISOString(),
        })),
        classes,
      },
    });
  } catch (error) {
    logger.error("Get User Details Error:", error);
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch user details");
  }
};

/* ─── Payments / payouts for one user ─────────────────────────────────── */

export const getUserPayments = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  const take = parsePositiveInt(req.query.pageSize, 50, 100);

  try {
    const user = await prisma.user.findUnique({ where: { userId: id }, select: { role: true } });
    if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");

    const [payments, payoutLines] = await Promise.all([
      prisma.paymentIntent.findMany({
        where: { OR: [{ studentUserId: id }, { earningTutorUserId: id }] },
        select: {
          paymentIntentId: true,
          enrollmentId: true,
          studentUserId: true,
          earningTutorUserId: true,
          amountMinor: true,
          currency: true,
          method: true,
          status: true,
          paidAt: true,
          createdAt: true,
          receipt: { select: { receiptNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      user.role === "TUTOR"
        ? prisma.payoutLine.findMany({
            where: { tutorUserId: id },
            select: {
              payoutLineId: true,
              grossVolumeMinor: true,
              payoutAmountMinor: true,
              withholdingTaxMinor: true,
              netPayoutMinor: true,
              eligibilityStatus: true,
              createdAt: true,
              settlementRun: { select: { settlementRunId: true, periodMonth: true, status: true } },
              payoutDocument: {
                select: { documentNumber: true, transferStatus: true, transferredAt: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take,
          })
        : Promise.resolve([]),
    ]);

    res.status(200).json({
      payments: payments.map((payment) => ({
        id: payment.paymentIntentId,
        enrollmentId: payment.enrollmentId,
        direction: payment.studentUserId === id ? "PAID_BY_USER" : "EARNED_BY_TUTOR",
        amountMinor: payment.amountMinor.toString(),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
        receiptNumber: payment.receipt?.receiptNumber ?? null,
      })),
      payouts: payoutLines.map((line) => ({
        id: line.payoutLineId,
        settlementRunId: line.settlementRun.settlementRunId,
        periodMonth: line.settlementRun.periodMonth,
        runStatus: line.settlementRun.status,
        grossVolumeMinor: line.grossVolumeMinor.toString(),
        payoutAmountMinor: line.payoutAmountMinor.toString(),
        withholdingTaxMinor: line.withholdingTaxMinor.toString(),
        netPayoutMinor: line.netPayoutMinor.toString(),
        eligibilityStatus: line.eligibilityStatus,
        documentNumber: line.payoutDocument?.documentNumber ?? null,
        transferStatus: line.payoutDocument?.transferStatus ?? null,
        transferredAt: line.payoutDocument?.transferredAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    logger.error("Get User Payments Error:", error);
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch user payments");
  }
};

/* ─── Audit trail for one user ────────────────────────────────────────── */

export const getUserAuditEvents = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  const page = parsePositiveInt(req.query.page, 1, 1000);
  const pageSize = parsePositiveInt(req.query.pageSize, 20, 100);

  try {
    const where = { entityType: "User", entityId: id };
    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const actorIds = [...new Set(events.map((event) => event.actorId))].filter(isUuid);
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { userId: { in: actorIds } },
          select: { userId: true, displayName: true, email: true },
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.userId, actor]));

    res.status(200).json({
      items: events.map((event) => ({
        id: event.auditEventId,
        action: event.action,
        actorId: event.actorId,
        actorName: actorMap.get(event.actorId)?.displayName ?? actorMap.get(event.actorId)?.email ?? null,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error("Get User Audit Error:", error);
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch user audit events");
  }
};

/* ─── Verification ────────────────────────────────────────────────────── */

/** True when the data behind a verification field is actually on file. */
export function hasSubmittedData(
  field: VerificationField,
  user: { idCardImageUrl?: string | null; bankBookImageUrl?: string | null; settings?: unknown },
) {
  const settings = asSettings(user.settings);
  switch (field) {
    case "idCard":
      return Boolean(user.idCardImageUrl);
    case "bankBook":
      return Boolean(settings.bankAccountNumber);
    case "address":
      return Boolean(settings.address);
    case "taxInfo":
      return Boolean(settings.taxName && settings.nationalId);
  }
}

export function computeVerificationStatus(verification: Record<string, { status?: string } | undefined>) {
  const statuses = VERIFICATION_FIELDS.map((field) => verification[field]?.status);
  if (statuses.every((status) => status === "VERIFIED")) return "VERIFIED";
  if (statuses.some((status) => status === "REJECTED")) return "REJECTED";
  if (statuses.some((status) => status === "PENDING")) return "PENDING";
  return "UNVERIFIED";
}

export type VerificationPlan =
  | { ok: true; targets: VerificationField[] }
  | { ok: false; status: number; code: string; message: string; details?: unknown };

/**
 * Which fields a verify request acts on. Only fields the tutor submitted and
 * that are still PENDING can be approved or rejected; "ALL" means "every
 * PENDING field" (never fields that were not submitted). `fields` (what the
 * admin saw in the confirm dialog) must match the PENDING set exactly so a
 * stale screen cannot approve something new.
 */
export function planVerification(input: {
  field?: unknown;
  fields?: unknown;
  status: "VERIFIED" | "REJECTED";
  user: { idCardImageUrl?: string | null; bankBookImageUrl?: string | null; settings?: unknown };
}): VerificationPlan {
  const verification = asSettings(input.user.settings).verification || {};
  const pending = VERIFICATION_FIELDS.filter((field) => verification[field]?.status === "PENDING");

  let targets: VerificationField[];
  if (typeof input.field === "string" && (VERIFICATION_FIELDS as readonly string[]).includes(input.field)) {
    targets = [input.field as VerificationField];
  } else if (input.field === undefined || input.field === "ALL") {
    if (pending.length === 0) {
      return { ok: false, status: 409, code: "NO_PENDING_VERIFICATION", message: "No submitted fields are waiting for review" };
    }
    if (Array.isArray(input.fields)) {
      const expected = [...new Set(input.fields.filter((f): f is string => typeof f === "string"))].sort();
      if (expected.join(",") !== [...pending].sort().join(",")) {
        return {
          ok: false,
          status: 409,
          code: "VERIFICATION_CHANGED",
          message: "The submitted fields changed since the page was loaded",
          details: { pending },
        };
      }
    }
    targets = pending;
  } else {
    return { ok: false, status: 400, code: "INVALID_VERIFICATION_FIELD", message: "Unknown verification field" };
  }

  const notPending = targets.filter((field) => verification[field]?.status !== "PENDING");
  if (notPending.length > 0) {
    return {
      ok: false,
      status: 409,
      code: "VERIFICATION_NOT_SUBMITTED",
      message: "Only submitted fields waiting for review can be approved or rejected",
      details: { fields: notPending },
    };
  }
  if (input.status === "VERIFIED") {
    const missing = targets.filter((field) => !hasSubmittedData(field, input.user));
    if (missing.length > 0) {
      return {
        ok: false,
        status: 409,
        code: "VERIFICATION_DATA_MISSING",
        message: "The document or data for this field is missing",
        details: { fields: missing },
      };
    }
  }
  return { ok: true, targets };
}

export const verifyUser = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, comment, field, fields, fieldComments } = req.body ?? {};
  const actorId = req.user?.userId || "SYSTEM";

  if (req.user?.role !== "ADMIN") {
    // Checkers only get masked PII and no documents, so they cannot review.
    return sendError(res, 403, "FORBIDDEN", "Requires Admin privileges");
  }
  if (status !== "VERIFIED" && status !== "REJECTED") {
    return sendError(res, 400, "INVALID_STATUS", "Invalid status");
  }
  if (!isUuid(id)) return sendError(res, 404, "USER_NOT_FOUND", "User not found");

  const globalComment = cleanReason(comment);
  const commentsByField: Record<string, unknown> =
    fieldComments && typeof fieldComments === "object" ? fieldComments : {};
  const getCommentForField = (fieldName: string) => {
    const fieldComment = cleanReason(commentsByField[fieldName]);
    return fieldComment || globalComment;
  };

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: {
        role: true,
        settings: true,
        displayName: true,
        email: true,
        idCardImageUrl: true,
        bankBookImageUrl: true,
        payoutIdentityVersion: true,
        verificationStatus: true,
      },
    });

    if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    if (isAnonymized(user.settings)) {
      return sendError(res, 409, "USER_ANONYMIZED", "This account has been anonymized");
    }

    const plan = planVerification({ field, fields, status, user });
    if (!plan.ok) return sendError(res, plan.status, plan.code, plan.message, plan.details);
    const targets = plan.targets;

    if (status === "REJECTED") {
      const missingReason = targets.filter((fieldName) => getCommentForField(fieldName).length < 3);
      if (missingReason.length > 0) {
        return sendError(res, 400, "REJECT_REASON_REQUIRED", "Reject reason is required", { fields: missingReason });
      }
    }

    const currentSettings = asSettings(user.settings);
    const verification = { ...(currentSettings.verification || {}) };
    const now = new Date().toISOString();
    const previous: Record<string, string | null> = {};

    for (const target of targets) {
      previous[target] = verification[target]?.status ?? null;
      verification[target] = {
        ...verification[target],
        status,
        comment: status === "REJECTED" ? getCommentForField(target) : "",
        updatedAt: verification[target]?.updatedAt ?? now,
        reviewedAt: now,
        reviewedBy: actorId,
      };
    }

    const nextStatus = computeVerificationStatus(verification);
    const nextSettings = { ...currentSettings, verification };
    const rejectionSummary =
      status === "REJECTED" ? targets.map((target) => getCommentForField(target)).join(" / ") : null;

    // Optimistic concurrency: the tutor re-submitting documents bumps
    // payoutIdentityVersion, so a stale review cannot overwrite it. The audit
    // row is written in the same transaction (both or neither).
    const applied = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { userId: id, payoutIdentityVersion: user.payoutIdentityVersion },
        data: {
          settings: nextSettings,
          payoutIdentityVersion: { increment: 1 },
          verificationStatus: nextStatus,
          verificationComment:
            nextStatus === "VERIFIED" ? null : rejectionSummary ?? (globalComment || null),
        },
      });
      if (updated.count === 0) return false;
      await tx.auditEvent.create({
        data: buildAuditEventData({
          actorId,
          action: AUDIT_ACTIONS.USER_VERIFY,
          entityType: AUDIT_ENTITY.USER,
          entityId: id,
          payload: {
            status,
            fields: targets,
            previous,
            scope: field === undefined || field === "ALL" ? "ALL_PENDING" : "FIELD",
            reasons:
              status === "REJECTED"
                ? Object.fromEntries(targets.map((target) => [target, getCommentForField(target)]))
                : undefined,
            fromStatus: user.verificationStatus,
            toStatus: nextStatus,
          },
        }),
      });
      return true;
    });

    if (!applied) {
      return sendError(res, 409, "VERIFICATION_CHANGED", "The tutor changed their documents while you were reviewing. Reload and review again.");
    }

    // Auto-create the Omise recipient when the bank book was just verified.
    let omiseRecipientId: string | null = null;
    if (status === "VERIFIED" && targets.includes("bankBook") && isOmiseConfigured()) {
      const accountNumber = currentSettings.bankAccountNumber as string | undefined;
      const bankBrand = currentSettings.bankBrand as string | undefined;
      const existingRecipientId = currentSettings.omiseRecipientId as string | undefined;

      if (accountNumber && bankBrand && !existingRecipientId) {
        try {
          const recipient = await createOmiseRecipient({
            name: user.displayName || `Tutor ${id}`,
            email: user.email || undefined,
            bankAccountBrand: bankBrand,
            bankAccountNumber: accountNumber,
            bankAccountName: currentSettings.taxName || user.displayName || `Tutor ${id}`,
          });
          omiseRecipientId = recipient.id;

          await prisma.$transaction([
            prisma.user.update({
              where: { userId: id },
              data: {
                settings: { ...nextSettings, omiseRecipientId: recipient.id },
                payoutIdentityVersion: { increment: 1 },
              },
            }),
            prisma.auditEvent.create({
              data: buildAuditEventData({
                actorId,
                action: AUDIT_ACTIONS.USER_OMISE_RECIPIENT_UPDATE,
                entityType: AUDIT_ENTITY.USER,
                entityId: id,
                payload: { from: null, to: recipient.id, source: "AUTO_ON_BANKBOOK_VERIFY" },
              }),
            }),
          ]);
          logger.info(`[verifyUser] Created Omise recipient ${recipient.id} for tutor ${id}`);
        } catch (omiseErrorRaw) {
          const omiseError = omiseErrorRaw as Error;
          // Non-fatal: the admin can set the recipient ID manually.
          logger.error(`[verifyUser] Failed to auto-create Omise recipient for ${id}:`, omiseError.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `User ${id} ${targets.join(", ")} verification status updated to ${status}`,
      fields: targets,
      verificationStatus: nextStatus,
      verificationDetails: verification,
      omiseRecipientId,
    });
  } catch (error) {
    logger.error("Verify User Error:", error);
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not update verification status");
  }
};

/* ─── Suspend / reactivate ────────────────────────────────────────────── */

export const suspendUser = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    return sendError(res, 403, "FORBIDDEN", "Requires Admin privileges");
  }
  const { id } = req.params;
  if (!isUuid(id)) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  const body = req.body ?? {};
  // Explicit target state makes retries idempotent; no body = legacy toggle.
  const desired = typeof body.isActive === "boolean" ? body.isActive : undefined;
  const reason = cleanReason(body.reason);

  if (id === req.user.userId) {
    return sendError(res, 409, "CANNOT_CHANGE_SELF", "You cannot suspend your own account");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { isActive: true, role: true, settings: true, displayName: true },
    });
    if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    if (STAFF_ROLES.includes(user.role)) {
      return sendError(res, 409, "STAFF_ACCOUNT", "Manage staff accounts from the roles page");
    }
    const nextActive = desired ?? !user.isActive;
    if (nextActive && accountStatusOf(user) === "ANONYMIZED") {
      return sendError(res, 409, "USER_ANONYMIZED", "An anonymized account cannot be reactivated");
    }
    if (nextActive === user.isActive) {
      return res.status(200).json({ success: true, isActive: user.isActive, unchanged: true });
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { userId: id },
        data: { isActive: nextActive, payoutIdentityVersion: { increment: 1 } },
        select: { userId: true, isActive: true },
      }),
      // The auth middleware reads isActive on every request, so this takes
      // effect immediately even when the existing JWT is still valid.
      prisma.auditEvent.create({
        data: buildAuditEventData({
          actorId: req.user.userId,
          action: nextActive ? AUDIT_ACTIONS.USER_UNSUSPEND : AUDIT_ACTIONS.USER_SUSPEND,
          entityType: AUDIT_ENTITY.USER,
          entityId: id,
          payload: { isActive: nextActive, reason: reason || undefined },
        }),
      }),
    ]);

    return res.status(200).json({
      success: true,
      isActive: updated.isActive,
      message: `User has been ${updated.isActive ? "unsuspended" : "suspended"}`,
    });
  } catch (error) {
    logger.error("Suspend User Error:", error);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not update user status");
  }
};

/* ─── Omise recipient ─────────────────────────────────────────────────── */

export const updateOmiseRecipient = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    return sendError(res, 403, "FORBIDDEN", "Requires Admin privileges");
  }

  const { id } = req.params;
  const { omiseRecipientId } = req.body ?? {};
  const reason = cleanReason(req.body?.reason);

  if (typeof omiseRecipientId !== "string") {
    return sendError(res, 400, "BAD_REQUEST", "omiseRecipientId must be a string");
  }

  const trimmed = omiseRecipientId.trim();
  if (trimmed && !/^recp_[A-Za-z0-9_]+$/.test(trimmed)) {
    return sendError(res, 400, "INVALID_OMISE_RECIPIENT", "Invalid Omise recipient ID format (must start with recp_)");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { settings: true, role: true },
    });
    if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    if (user.role !== "TUTOR") return sendError(res, 400, "NOT_A_TUTOR", "User is not a TUTOR");
    if (isAnonymized(user.settings)) {
      return sendError(res, 409, "USER_ANONYMIZED", "This account has been anonymized");
    }

    const currentSettings = asSettings(user.settings);
    const previousId = (currentSettings.omiseRecipientId as string | undefined) ?? null;
    if ((previousId ?? "") === trimmed) {
      return res.status(200).json({ message: "Omise recipient ID unchanged", omiseRecipientId: previousId, unchanged: true });
    }
    const updatedSettings = { ...currentSettings };
    if (trimmed) {
      updatedSettings.omiseRecipientId = trimmed;
    } else {
      delete updatedSettings.omiseRecipientId;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { userId: id },
        data: {
          settings: updatedSettings,
          payoutIdentityVersion: { increment: 1 },
        },
      }),
      prisma.auditEvent.create({
        data: buildAuditEventData({
          actorId: req.user.userId,
          action: AUDIT_ACTIONS.USER_OMISE_RECIPIENT_UPDATE,
          entityType: AUDIT_ENTITY.USER,
          entityId: id,
          payload: { from: previousId, to: trimmed || null, reason: reason || undefined },
        }),
      }),
    ]);

    return res.status(200).json({
      message: "Omise recipient ID updated",
      omiseRecipientId: trimmed || null,
    });
  } catch (error) {
    logger.error("Update Omise Recipient Error:", error);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not update Omise recipient ID");
  }
};

/* ─── Anonymize (PDPA right to erasure) ───────────────────────────────── */

/**
 * The settings object after erasure: every PII key, the verification
 * comments (free text) and the Omise recipient pointer are dropped; only the
 * erasure marker remains. Returns the list of removed keys for the audit log
 * (names only, never values).
 */
export function scrubSettings(settingsValue: unknown, marker: { anonymizedAt: string; anonymizedBy: string }) {
  const settings = asSettings(settingsValue);
  const removed = Object.keys(settings).filter(
    (key) => key !== "anonymizedAt" && key !== "anonymizedBy" && settings[key] !== undefined && settings[key] !== null,
  );
  const next: Settings = {
    anonymizedAt: settings.anonymizedAt ?? marker.anonymizedAt,
    anonymizedBy: settings.anonymizedBy ?? marker.anonymizedBy,
  };
  return { settings: next, removed };
}

export const anonymizeUser = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    return sendError(res, 403, "FORBIDDEN", "Requires Admin privileges");
  }

  const { id } = req.params;
  if (!isUuid(id)) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  const reason = cleanReason(req.body?.reason);
  if (id === req.user.userId) {
    return sendError(res, 409, "CANNOT_CHANGE_SELF", "You cannot anonymize your own account");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: {
        role: true,
        settings: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        dateOfBirth: true,
        idCardImageUrl: true,
        bankBookImageUrl: true,
        verificationComment: true,
        isActive: true,
      },
    });
    if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    if (STAFF_ROLES.includes(user.role)) {
      return sendError(res, 409, "STAFF_ACCOUNT", "Revoke the staff role before anonymizing this account");
    }

    // Money still owed to / being reviewed for this tutor needs the payout
    // identity; erase only after every payout is final.
    if (user.role === "TUTOR") {
      const openPayouts = await prisma.payoutLine.count({
        where: {
          tutorUserId: id,
          netPayoutMinor: { gt: 0 },
          OR: [
            { settlementRun: { status: { in: OPEN_RUN_STATUSES } } },
            {
              settlementRun: { status: "APPROVED" },
              OR: [
                { payoutDocument: { is: null } },
                { payoutDocument: { transferStatus: { notIn: ["PAID"] } } },
              ],
            },
          ],
        },
      });
      if (openPayouts > 0) {
        return sendError(
          res,
          409,
          "USER_HAS_OPEN_PAYOUTS",
          "This tutor has payouts that are not settled yet",
          { openPayouts },
        );
      }
    }

    const alreadyAnonymized = isAnonymized(user.settings);
    const now = new Date().toISOString();
    const scrubbed = scrubSettings(user.settings, { anonymizedAt: now, anonymizedBy: req.user.userId });
    const scrubbedColumns = (
      [
        ["displayName", user.displayName && user.displayName !== ANONYMIZED_DISPLAY_NAME],
        ["email", user.email],
        ["phoneNumber", user.phoneNumber],
        ["profilePictureUrl", user.profilePictureUrl],
        ["dateOfBirth", user.dateOfBirth],
        ["idCardImageUrl", user.idCardImageUrl],
        ["bankBookImageUrl", user.bankBookImageUrl],
        ["verificationComment", user.verificationComment],
      ] as const
    )
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);

    const [oauthCount, guardianCount, snapshotCount] = await Promise.all([
      prisma.oAuthIdentity.count({ where: { userId: id } }),
      prisma.guardianConsent.count({ where: { studentUserId: id, NOT: { guardianName: REDACTED } } }),
      prisma.payoutLine.count({ where: { tutorUserId: id, recipientSnapshot: { not: null } } }),
    ]);

    const nothingLeft =
      alreadyAnonymized &&
      scrubbed.removed.length === 0 &&
      scrubbedColumns.length === 0 &&
      oauthCount === 0 &&
      guardianCount === 0 &&
      snapshotCount === 0 &&
      !user.isActive;
    if (nothingLeft) {
      return res.status(200).json({ success: true, alreadyAnonymized: true, message: `User ${id} is already anonymized` });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { userId: id },
        data: {
          displayName: ANONYMIZED_DISPLAY_NAME,
          email: null,
          phoneNumber: null,
          profilePictureUrl: null,
          dateOfBirth: null,
          idCardImageUrl: null,
          bankBookImageUrl: null,
          verificationComment: null,
          verificationStatus: "UNVERIFIED",
          settings: scrubbed.settings,
          isActive: false,
          // Invalidates any settlement review that still references this payout identity.
          payoutIdentityVersion: { increment: 1 },
        },
      }),
      // Social logins would otherwise let the person sign back into the erased account.
      prisma.oAuthIdentity.deleteMany({ where: { userId: id } }),
      prisma.guardianConsent.updateMany({
        where: { studentUserId: id },
        data: { guardianName: REDACTED },
      }),
      // Payout history keeps amounts, tax and transfer status; only the pointer
      // to the bank recipient (personal data held at Omise) is dropped.
      prisma.payoutLine.updateMany({
        where: { tutorUserId: id, recipientSnapshot: { not: null } },
        data: { recipientSnapshot: null },
      }),
      prisma.auditEvent.create({
        data: buildAuditEventData({
          actorId: req.user.userId,
          action: AUDIT_ACTIONS.USER_ANONYMIZE,
          entityType: AUDIT_ENTITY.USER,
          entityId: id,
          payload: {
            reason: reason || undefined,
            repeat: alreadyAnonymized || undefined,
            scrubbedColumns,
            scrubbedSettingsKeys: scrubbed.removed,
            oauthIdentitiesRemoved: oauthCount,
            guardianNamesRedacted: guardianCount,
            payoutSnapshotsCleared: snapshotCount,
          },
        }),
      }),
    ]);

    res.status(200).json({
      success: true,
      alreadyAnonymized,
      message: `User ${id} has been anonymized`,
      scrubbed: {
        columns: scrubbedColumns,
        settingsKeys: scrubbed.removed,
        oauthIdentities: oauthCount,
        guardianNames: guardianCount,
        payoutSnapshots: snapshotCount,
      },
    });
  } catch (error) {
    logger.error("Anonymize User Error:", error);
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Could not anonymize user");
  }
};
