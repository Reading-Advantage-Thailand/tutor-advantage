import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma, Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  findClassBook,
  MAX_PACKAGE_PRICE_SATANG,
  parseClassTitle,
  unavailableBookResponse,
} from "./classController";

/*
 * Admin console /classes: list classes and create a class on a tutor's behalf.
 *
 * A tutor who has not signed up yet is pre-provisioned as a real TUTOR user
 * (lower-cased email, no OAuth identity). Identity links their first Google
 * login to that row by email, so they own the class without a transfer and
 * finish it on the tutor app's setup page (setupRequiredAt is set until then).
 */

// Any hex UUID, as finance accepts: the admin console looks a class up by the
// classId stored on a discount code or an audit row (`q=<classId>`).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const DISPLAY_NAME_MAX = 100;
const DEFAULT_CAPACITY = 30;
const MAX_CAPACITY = 100;
const DEFAULT_PACKAGE_PRICE_SATANG = 300000;
// Same shape the admin console proxy forwards (sanitizeIdempotencyKey).
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

const tutorSelect = {
  userId: true,
  role: true,
  isActive: true,
  displayName: true,
  email: true,
  _count: { select: { oauthIdentities: true } },
} as const;

type TutorRow = Prisma.UserGetPayload<{ select: typeof tutorSelect }>;
type AdminClassRow = Prisma.ClassGetPayload<{ include: { book: true } }>;

function errorBody(req: AuthenticatedRequest, code: string, message: string) {
  return { error: { code, message, requestId: req.id } };
}

function forbidden(req: AuthenticatedRequest, res: Response) {
  return res.status(403).json(errorBody(req, "FORBIDDEN", "Only admins can manage classes"));
}

class AdminClassError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function presentTutor(tutor: TutorRow) {
  return {
    userId: tutor.userId,
    displayName: tutor.displayName ?? null,
    email: tutor.email ?? null,
    // Pre-provisioned by an admin and not signed in yet (no OAuth identity linked).
    pendingRegistration: tutor._count.oauthIdentities === 0,
  };
}

function presentAdminClass(cls: AdminClassRow, activeStudents: number, tutor: TutorRow | undefined) {
  return {
    classId: cls.classId,
    title: cls.title,
    status: cls.status,
    isDemo: cls.isDemo,
    bookId: cls.bookId,
    bookCode: cls.book.bookCode,
    bookTitle: cls.book.title,
    packagePriceSatang: Number(cls.packagePriceMinor),
    capacity: cls.capacity,
    enrolledCount: cls.enrolledCount,
    activeStudents,
    scheduleDescription: cls.scheduleDescription ?? null,
    setupRequired: Boolean(cls.setupRequiredAt),
    setupRequiredAt: cls.setupRequiredAt ? cls.setupRequiredAt.toISOString() : null,
    createdAt: cls.createdAt.toISOString(),
    tutor: tutor ? presentTutor(tutor) : null,
  };
}

function optionalInteger(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null) return fallback;
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= min && raw <= max ? raw : null;
}

/**
 * The user row for this email, matched case-insensitively. Emails are unique
 * only case-sensitively, so an exact (lower-case) match wins over a
 * differently cased duplicate. Prisma runs the insensitive `equals` as ILIKE,
 * where `_` and `%` are wildcards, so every hit is compared again here.
 */
async function findUserByEmail(tx: Prisma.TransactionClient, email: string) {
  const users = await tx.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: tutorSelect,
  });
  const sameEmail = users.filter((user) => user.email?.toLowerCase() === email);
  return sameEmail.find((user) => user.email === email) ?? sameEmail[0] ?? null;
}

/**
 * The class this admin already created with this Idempotency-Key (kept in the
 * ADMIN_CLASS_CREATE audit payload), so a retry after a lost response does not
 * create a second class. Null when there is none.
 */
async function findReplayedClass(actorId: string, idempotencyKey: string) {
  const event = await prisma.auditEvent.findFirst({
    where: {
      action: "ADMIN_CLASS_CREATE",
      actorId,
      payload: { path: ["idempotencyKey"], equals: idempotencyKey },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!event) return null;
  const cls = await prisma.class.findUnique({
    where: { classId: event.entityId },
    include: {
      book: true,
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!cls) return null;
  const tutor = await prisma.user.findUnique({ where: { userId: cls.tutorUserId }, select: tutorSelect });
  if (!tutor) return null;
  const tutorCreated = (event.payload as { tutorCreated?: unknown } | null)?.tutorCreated === true;
  return { cls, tutor, tutorCreated };
}

function isEmailUniqueViolation(error: unknown) {
  const { code, meta } = (error ?? {}) as { code?: string; meta?: { target?: unknown } };
  return code === "P2002" && String(meta?.target ?? "").includes("email");
}

// GET /v1/admin/classes?q=&setup=pending|done&includeDemo=true&page=&pageSize=
export async function getAdminClasses(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res);
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20),
    );
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const setup = req.query.setup === "pending" || req.query.setup === "done" ? req.query.setup : null;
    const includeDemo = req.query.includeDemo === "true";

    // Class has no relation to User, so tutor name/email matches become ids first.
    const matchingTutorIds = q
      ? (
          await prisma.user.findMany({
            where: {
              OR: [
                { displayName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { userId: true },
          })
        ).map((user) => user.userId)
      : [];

    const where: Prisma.ClassWhereInput = {
      ...(includeDemo ? {} : { isDemo: false }),
      ...(setup === "pending" ? { setupRequiredAt: { not: null } } : {}),
      ...(setup === "done" ? { setupRequiredAt: null } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              ...(matchingTutorIds.length > 0 ? [{ tutorUserId: { in: matchingTutorIds } }] : []),
              ...(UUID_RE.test(q) ? [{ classId: q }] : []),
            ],
          }
        : {}),
    };

    const [total, classes] = await Promise.all([
      prisma.class.count({ where }),
      prisma.class.findMany({
        where,
        include: {
          book: true,
          _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const tutorIds = [...new Set(classes.map((cls) => cls.tutorUserId))];
    const tutors = tutorIds.length
      ? await prisma.user.findMany({ where: { userId: { in: tutorIds } }, select: tutorSelect })
      : [];
    const tutorById = new Map(tutors.map((tutor) => [tutor.userId, tutor]));

    return res.status(200).json({
      items: classes.map((cls) =>
        presentAdminClass(cls, cls._count.enrollments, tutorById.get(cls.tutorUserId)),
      ),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error("Get Admin Classes Error:", error);
    return res.status(500).json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not fetch classes"));
  }
}

// POST /v1/admin/classes — create a class for a tutor, pre-provisioning the tutor if needed
export async function createAdminClass(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return forbidden(req, res);
    }
    const actorId = req.user.userId;
    const body = req.body ?? {};

    const tutorEmail = typeof body.tutorEmail === "string" ? body.tutorEmail.trim().toLowerCase() : "";
    if (!tutorEmail || tutorEmail.length > EMAIL_MAX || !EMAIL_RE.test(tutorEmail)) {
      return res.status(400).json(errorBody(req, "INVALID_EMAIL", "A valid tutor email is required"));
    }
    const tutorDisplayName = typeof body.tutorDisplayName === "string" ? body.tutorDisplayName.trim() : "";
    if (!tutorDisplayName || tutorDisplayName.length > DISPLAY_NAME_MAX) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_DISPLAY_NAME", `tutorDisplayName must be 1-${DISPLAY_NAME_MAX} characters`));
    }
    const title = parseClassTitle(body.title);
    if (!title) {
      return res.status(400).json(errorBody(req, "INVALID_TITLE", "title must be 1-120 characters"));
    }
    const capacity = optionalInteger(body.capacity, DEFAULT_CAPACITY, 1, MAX_CAPACITY);
    if (capacity === null) {
      return res.status(400).json(errorBody(req, "INVALID_CAPACITY", `capacity must be 1-${MAX_CAPACITY}`));
    }
    const packagePriceSatang = optionalInteger(
      body.packagePriceSatang,
      DEFAULT_PACKAGE_PRICE_SATANG,
      1,
      MAX_PACKAGE_PRICE_SATANG,
    );
    if (packagePriceSatang === null) {
      return res
        .status(400)
        .json(errorBody(req, "INVALID_PRICE", `packagePriceSatang must be between 1 and ${MAX_PACKAGE_PRICE_SATANG}`));
    }

    const rawKey = req.headers["idempotency-key"];
    const idempotencyKey = typeof rawKey === "string" && IDEMPOTENCY_KEY_RE.test(rawKey) ? rawKey : null;
    if (idempotencyKey) {
      const replayed = await findReplayedClass(actorId, idempotencyKey);
      if (replayed) {
        return res.status(200).json({
          class: presentAdminClass(replayed.cls, replayed.cls._count.enrollments, replayed.tutor),
          tutor: { ...presentTutor(replayed.tutor), created: replayed.tutorCreated },
        });
      }
    }

    const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
    const bookLookup = bookId ? await findClassBook(bookId) : { book: null, error: "NOT_FOUND" as const };
    if (bookLookup.error === "NOT_FOUND") {
      return res.status(404).json(errorBody(req, "BOOK_NOT_FOUND", "Book not found"));
    }
    if (bookLookup.error === "UNAVAILABLE") {
      return res.status(403).json(unavailableBookResponse(req));
    }
    const book = bookLookup.book;

    const provision = () =>
      prisma.$transaction(async (tx) => {
        const existing = await findUserByEmail(tx, tutorEmail);
        if (existing && existing.role !== "TUTOR") {
          throw new AdminClassError(409, "EMAIL_NOT_TUTOR", `This email belongs to a ${existing.role} account`);
        }
        if (existing && !existing.isActive) {
          throw new AdminClassError(409, "TUTOR_SUSPENDED", "This tutor account is suspended");
        }

        // An existing tutor keeps their own display name; it is only used for a new account.
        const tutor =
          existing ??
          (await tx.user.create({
            data: { email: tutorEmail, role: "TUTOR", displayName: tutorDisplayName, isActive: true },
            select: tutorSelect,
          }));
        const tutorCreated = !existing;

        const cls = await tx.class.create({
          data: {
            tutorUserId: tutor.userId,
            bookId: book.bookId,
            title,
            capacity,
            packagePriceMinor: BigInt(packagePriceSatang),
            status: "OPEN",
            setupRequiredAt: new Date(),
            scheduleData: Prisma.DbNull,
            freeHours: 0,
            isDemo: false,
          },
        });

        await tx.classBookCycle.create({
          data: {
            classId: cls.classId,
            bookId: book.bookId,
            sequence: 1,
            status: "OPEN",
            packagePriceMinor: BigInt(packagePriceSatang),
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId,
            action: "ADMIN_CLASS_CREATE",
            entityType: "Class",
            entityId: cls.classId,
            payload: {
              tutorUserId: tutor.userId,
              tutorEmail: tutor.email ?? tutorEmail,
              tutorCreated,
              title,
              bookCode: book.bookCode,
              packagePriceSatang,
              capacity,
              ...(idempotencyKey ? { idempotencyKey } : {}),
            },
          },
        });

        if (tutorCreated) {
          await tx.auditEvent.create({
            data: {
              actorId,
              action: "ADMIN_TUTOR_PROVISION",
              entityType: "User",
              entityId: tutor.userId,
              payload: { email: tutorEmail, displayName: tutorDisplayName, classId: cls.classId },
            },
          });
        }

        return { cls, tutor, tutorCreated };
      });

    let result: Awaited<ReturnType<typeof provision>>;
    try {
      result = await provision();
    } catch (error) {
      if (!isEmailUniqueViolation(error)) throw error;
      // Another request created this email between the lookup and the insert;
      // run once more so the reuse rules apply to that row.
      result = await provision();
    }

    const { cls, tutor, tutorCreated } = result;
    return res.status(201).json({
      class: presentAdminClass({ ...cls, book }, 0, tutor),
      tutor: { ...presentTutor(tutor), created: tutorCreated },
    });
  } catch (error) {
    if (error instanceof AdminClassError) {
      return res.status(error.status).json(errorBody(req, error.code, error.message));
    }
    logger.error("Create Admin Class Error:", error);
    return res.status(500).json(errorBody(req, "INTERNAL_SERVER_ERROR", "Could not create class"));
  }
}
