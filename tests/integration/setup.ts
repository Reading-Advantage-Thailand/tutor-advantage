/**
 * Integration test helpers — seed data creation and teardown.
 *
 * All seed functions return the created record's primary-key ID so the caller
 * can register it in the cleanup list (`track()`).
 *
 * Usage inside a test file:
 *
 *   const ids = createIdTracker();
 *   afterAll(() => ids.cleanup());
 *
 *   const tutorId = await seedTutor();
 *   ids.track("user", tutorId);
 */
import { prisma } from "@tutor-advantage/database";
import { v4 as uuidv4 } from "uuid";

export { prisma };

// ---------------------------------------------------------------------------
// Unique ID helper — prefix all test data with a run tag so it's easy to
// identify and sweep if a test crashes before cleanup.
// ---------------------------------------------------------------------------
let _runTag = "";
export function runTag(): string {
  if (!_runTag) _runTag = `it_${uuidv4().slice(0, 8)}`;
  return _runTag;
}

// ---------------------------------------------------------------------------
// ID tracker — collects created record IDs and provides a cleanup helper.
// ---------------------------------------------------------------------------
type EntityType =
  | "user"
  | "book"
  | "class"
  | "referral"
  | "enrollment"
  | "paymentIntent"
  | "paymentReceipt"
  | "paymentEvent"
  | "settlementRun"
  | "payoutLine"
  | "payoutDocument"
  | "adjustment"
  | "auditEvent";

export function createIdTracker() {
  const registry = new Map<EntityType, Set<string>>();

  function track(type: EntityType, id: string) {
    if (!registry.has(type)) registry.set(type, new Set());
    registry.get(type)!.add(id);
  }

  /**
   * Delete all tracked records in reverse-dependency order.
   * Failures in individual deletes are logged but do not abort the rest.
   */
  async function cleanup() {
    if (registry.size === 0) {
      return;
    }

    const del = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        console.warn("[integration teardown]", e);
      }
    };

    const ids = (type: EntityType) => Array.from(registry.get(type) ?? []);

    // finance_mlm — leaf records first
    await del(() =>
      prisma.auditEvent.deleteMany({
        where: { auditEventId: { in: ids("auditEvent") } },
      }),
    );
    await del(() =>
      prisma.payoutDocument.deleteMany({
        where: { payoutLineId: { in: ids("payoutDocument") } },
      }),
    );
    await del(() =>
      prisma.payoutLine.deleteMany({
        where: { payoutLineId: { in: ids("payoutLine") } },
      }),
    );
    await del(() =>
      prisma.adjustment.deleteMany({
        where: { adjustmentId: { in: ids("adjustment") } },
      }),
    );
    await del(() =>
      prisma.settlementRun.deleteMany({
        where: { settlementRunId: { in: ids("settlementRun") } },
      }),
    );
    await del(() =>
      prisma.paymentReceipt.deleteMany({
        where: { paymentIntentId: { in: ids("paymentReceipt") } },
      }),
    );
    await del(() =>
      prisma.paymentEvent.deleteMany({
        where: { paymentIntentId: { in: ids("paymentEvent") } },
      }),
    );
    await del(() =>
      prisma.paymentIntent.deleteMany({
        where: { paymentIntentId: { in: ids("paymentIntent") } },
      }),
    );
    // learning
    await del(() =>
      prisma.enrollment.deleteMany({
        where: { enrollmentId: { in: ids("enrollment") } },
      }),
    );
    await del(() =>
      prisma.referral.deleteMany({
        where: { token: { in: ids("referral") } },
      }),
    );
    await del(() =>
      prisma.class.deleteMany({
        where: { classId: { in: ids("class") } },
      }),
    );
    await del(() =>
      prisma.book.deleteMany({
        where: { bookId: { in: ids("book") } },
      }),
    );
    await del(() =>
      prisma.series.deleteMany({
        where: { code: `INT-SERIES-${runTag()}` },
      }),
    );
    // identity — users last (FK parent)
    await del(() =>
      prisma.user.deleteMany({
        where: { userId: { in: ids("user") } },
      }),
    );
  }

  return { track, cleanup };
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/** Creates a TUTOR user and returns their userId. */
export async function seedTutor(overrides: Partial<{
  displayName: string;
  sponsorTutorId: string | null;
}> = {}): Promise<string> {
  const user = await prisma.user.create({
    data: {
      role: "TUTOR",
      displayName: overrides.displayName ?? `Test Tutor ${runTag()}`,
      email: `tutor-${uuidv4().slice(0, 8)}@integration.test`,
      isActive: true,
      sponsorTutorId: overrides.sponsorTutorId ?? null,
      verificationStatus: "VERIFIED",
    },
  });
  return user.userId;
}

/** Creates a STUDENT user and returns their userId. */
export async function seedStudent(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      role: "STUDENT",
      displayName: `Test Student ${runTag()}`,
      email: `student-${uuidv4().slice(0, 8)}@integration.test`,
      isActive: true,
    },
  });
  return user.userId;
}

/** Creates a Book and returns its bookId. */
export async function seedBook(): Promise<string> {
  const series = await prisma.series.upsert({
    where: { code: `INT-SERIES-${runTag()}` },
    update: {},
    create: {
      code: `INT-SERIES-${runTag()}`,
      name: `Integration Test Series ${runTag()}`,
      cefrLevel: "A1",
      raLevelStart: 1,
      raLevelEnd: 1,
    },
  });
  const book = await prisma.book.create({
    data: {
      seriesId: series.seriesId,
      title: `Integration Test Book ${runTag()}`,
      bookCode: `INT-${runTag()}`,
      levelNumber: 1,
      articleCount: 0,
      classHours: 10,
    },
  });
  return book.bookId;
}

/** Creates an OPEN Class and returns its classId. */
export async function seedClass(opts: {
  tutorUserId: string;
  bookId: string;
  packagePriceMinor?: bigint;
  capacity?: number;
}): Promise<string> {
  const cls = await prisma.class.create({
    data: {
      tutorUserId: opts.tutorUserId,
      bookId: opts.bookId,
      title: `Integration Test Class ${runTag()}`,
      status: "OPEN",
      packagePriceMinor: opts.packagePriceMinor ?? 100_000n, // 1,000 THB
      capacity: opts.capacity ?? 30,
      enrolledCount: 0,
    },
  });
  return cls.classId;
}

/** Creates an ACTIVE referral for the given class and returns the token. */
export async function seedReferral(opts: {
  classId: string;
  tutorUserId: string;
}): Promise<string> {
  const token = uuidv4();
  await prisma.referral.create({
    data: {
      token,
      classId: opts.classId,
      tutorUserId: opts.tutorUserId,
      status: "ACTIVE",
    },
  });
  return token;
}

/**
 * Enrolls a student via referral token (replicates enrollmentController logic).
 * Returns { enrollmentId, placement }.
 */
export async function seedEnrollment(opts: {
  referralToken: string;
  studentUserId: string;
}): Promise<{ enrollmentId: string; placement: "PRIMARY" | "FALLBACK" }> {
  const result = await prisma.$transaction(async (tx) => {
    const referral = await tx.referral.findUnique({
      where: { token: opts.referralToken },
      include: { class: true },
    });
    if (!referral || referral.status !== "ACTIVE") {
      throw new Error("REFERRAL_INVALID");
    }

    const primaryClass = referral.class;
    let targetClassId = primaryClass.classId;
    let isFallback = false;

    if (
      primaryClass.status !== "OPEN" ||
      primaryClass.enrolledCount >= primaryClass.capacity
    ) {
      const candidates = await tx.class.findMany({
        where: {
          tutorUserId: primaryClass.tutorUserId,
          status: "OPEN",
          classId: { not: primaryClass.classId },
          isDemo: false,
        },
      });
      const fallback = candidates.find(
        (candidate) => candidate.enrolledCount < candidate.capacity,
      );
      if (!fallback || fallback.enrolledCount >= fallback.capacity) {
        throw new Error("NO_FALLBACK_AVAILABLE");
      }
      targetClassId = fallback.classId;
      isFallback = true;
    }

    const enrollment = await tx.enrollment.create({
      data: {
        classId: targetClassId,
        studentUserId: opts.studentUserId,
        referralToken: opts.referralToken,
        status: "PENDING_PAYMENT",
      },
    });

    await tx.class.update({
      where: { classId: targetClassId },
      data: { enrolledCount: { increment: 1 } },
    });

    return {
      enrollmentId: enrollment.enrollmentId,
      placement: (isFallback ? "FALLBACK" : "PRIMARY") as "PRIMARY" | "FALLBACK",
    };
  });

  return result;
}

/**
 * Creates a PaymentIntent and immediately fulfills it (status → SUCCESS),
 * setting the enrollment to ACTIVE. Returns the paymentIntentId.
 */
export async function seedSuccessfulPayment(opts: {
  enrollmentId: string;
  studentUserId: string;
  amountMinor: bigint;
}): Promise<string> {
  const paymentIntentId = uuidv4();

  await prisma.$transaction(async (tx) => {
    const intent = await tx.paymentIntent.create({
      data: {
        paymentIntentId,
        enrollmentId: opts.enrollmentId,
        studentUserId: opts.studentUserId,
        amountMinor: opts.amountMinor,
        currency: "THB",
        method: "promptpay",
        status: "SUCCESS",
        providerRef: `mock_${paymentIntentId}`,
      },
    });

    await tx.enrollment.update({
      where: { enrollmentId: opts.enrollmentId },
      data: { status: "ACTIVE", paymentTransactionId: intent.providerRef },
    });
  });

  return paymentIntentId;
}
