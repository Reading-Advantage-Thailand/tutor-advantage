/**
 * Integration test: full referral → enrollment → payment → settlement flow.
 *
 * Requires a real PostgreSQL database pointed to by DATABASE_URL.
 * Set SKIP_INTEGRATION_TESTS=1 to skip this suite (e.g. in unit-test CI).
 *
 * Run:
 *   npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createIdTracker,
  prisma,
  seedBook,
  seedClass,
  seedEnrollment,
  seedReferral,
  seedStudent,
  seedSuccessfulPayment,
  seedTutor,
} from "./setup";
import { SettlementService } from "../../services/finance-mlm-service/src/services/settlementService";

// ---------------------------------------------------------------------------
// Guard — skip if not targeting a real DB
// ---------------------------------------------------------------------------
const SKIP = process.env.SKIP_INTEGRATION_TESTS === "1";

describe.skipIf(SKIP)("Full referral → payment → settlement flow", () => {
  const ids = createIdTracker();

  // Period month we'll run the settlement against — far in the future so it
  // doesn't collide with real production data that might exist on the same DB.
  const PERIOD_MONTH = "2099-01";

  let tutorId: string;
  let studentId: string;
  let classId: string;
  let bookId: string;
  let referralToken: string;
  let enrollmentId: string;
  let paymentIntentId: string;
  let settlementRunId: string;

  // ---------------------------------------------------------------------------
  // Seed
  // ---------------------------------------------------------------------------
  beforeAll(async () => {
    // Verify connectivity early so the error is clear
    await prisma.$queryRaw`SELECT 1`;

    // 1. Create tutor and student users
    tutorId = await seedTutor({ displayName: "Integration Tutor" });
    ids.track("user", tutorId);

    studentId = await seedStudent();
    ids.track("user", studentId);

    // 2. Create a book and class
    bookId = await seedBook();
    ids.track("book", bookId);

    classId = await seedClass({
      tutorUserId: tutorId,
      bookId,
      packagePriceMinor: 300_000n, // 3,000 THB
      capacity: 30,
    });
    ids.track("class", classId);

    // 3. Create referral
    referralToken = await seedReferral({ classId, tutorUserId: tutorId });
    ids.track("referral", referralToken);

    // 4. Enroll student via referral
    const enrollResult = await seedEnrollment({
      referralToken,
      studentUserId: studentId,
    });
    enrollmentId = enrollResult.enrollmentId;
    ids.track("enrollment", enrollmentId);

    // 5. Simulate successful payment (sets enrollment → ACTIVE)
    paymentIntentId = await seedSuccessfulPayment({
      enrollmentId,
      studentUserId: studentId,
      amountMinor: 300_000n,
    });
    ids.track("paymentIntent", paymentIntentId);
  });

  // ---------------------------------------------------------------------------
  // Teardown — runs after ALL tests in this describe block
  // ---------------------------------------------------------------------------
  afterAll(async () => {
    // Delete settlement outputs first (FK order)
    if (settlementRunId) {
      // payoutLines → settlementRun
      const lines = await prisma.payoutLine.findMany({
        where: { settlementRunId },
        select: { payoutLineId: true },
      });
      for (const l of lines) ids.track("payoutLine", l.payoutLineId);
      ids.track("settlementRun", settlementRunId);
    }
    await ids.cleanup();
  });

  // ---------------------------------------------------------------------------
  // Test: enrollment placement is PRIMARY
  // ---------------------------------------------------------------------------
  it("enrolls the student in the primary class", async () => {
    const enrollment = await prisma.enrollment.findUnique({
      where: { enrollmentId },
    });
    expect(enrollment).not.toBeNull();
    expect(enrollment!.classId).toBe(classId);
    expect(enrollment!.referralToken).toBe(referralToken);
  });

  // ---------------------------------------------------------------------------
  // Test: payment makes enrollment ACTIVE
  // ---------------------------------------------------------------------------
  it("marks the enrollment as ACTIVE after payment", async () => {
    const enrollment = await prisma.enrollment.findUnique({
      where: { enrollmentId },
    });
    expect(enrollment!.status).toBe("ACTIVE");
    expect(enrollment!.paymentTransactionId).toBeTruthy();
  });

  it("records the payment intent with SUCCESS status", async () => {
    const intent = await prisma.paymentIntent.findUnique({
      where: { paymentIntentId },
    });
    expect(intent).not.toBeNull();
    expect(intent!.status).toBe("SUCCESS");
    expect(intent!.amountMinor).toBe(300_000n);
  });

  // ---------------------------------------------------------------------------
  // Test: settlement preview aggregates the tutor's volume
  // ---------------------------------------------------------------------------
  it("creates a settlement preview with the tutor's payout line", async () => {
    // The payment updatedAt must fall within the PERIOD_MONTH ICT window.
    // Since 2099-01 is in the future, we back-date the payment record to
    // the first day of that month so it's captured by the query window.
    const paymentDate = new Date(Date.UTC(2099, 0, 1, 0, 0, 0)); // 2099-01-01 UTC → 07:00 ICT
    await prisma.paymentIntent.update({
      where: { paymentIntentId },
      data: { updatedAt: paymentDate },
    });

    // Also ensure the enrollment record links correctly (settlement queries
    // enrollments to map payment → tutor).
    await prisma.enrollment.update({
      where: { enrollmentId },
      data: { updatedAt: paymentDate },
    });

    // Run the settlement preview
    const preview = await SettlementService.previewSettlement(
      PERIOD_MONTH,
      "integration-test-admin",
    );

    settlementRunId = preview.snapshotId;

    expect(preview.periodMonth).toBe(PERIOD_MONTH);
    expect(preview.status).toBe("DRAFT");
    expect(typeof preview.totalPayoutSatang).toBe("number");
    expect(preview.totalPayoutSatang).toBeGreaterThan(0);
  });

  it("creates a payout line for the tutor with correct volume", async () => {
    // settlementRunId is set by the previous test — in sequential mode this is fine.
    expect(settlementRunId).toBeTruthy();

    const line = await prisma.payoutLine.findFirst({
      where: { settlementRunId, tutorUserId: tutorId },
    });

    expect(line).not.toBeNull();
    // grossVolumeMinor should equal the payment amount
    expect(line!.grossVolumeMinor).toBe(300_000n);
    // payoutAmountMinor must be > 0 (tutor has personal volume)
    expect(line!.payoutAmountMinor).toBeGreaterThan(0n);
    // withholdingTaxMinor should be > 0 for positive payout
    expect(line!.withholdingTaxMinor).toBeGreaterThan(0n);
    // netPayoutMinor = payout - WHT
    expect(line!.netPayoutMinor).toBe(
      line!.payoutAmountMinor - line!.withholdingTaxMinor,
    );
    // Eligibility should reflect base or adjusted
    expect(line!.eligibilityStatus).toMatch(/^ELIGIBLE/);
  });

  // ---------------------------------------------------------------------------
  // Test: idempotency — a second call for the same period should throw
  // ---------------------------------------------------------------------------
  it("throws DRAFT_EXISTS if a second settlement preview is requested for the same period", async () => {
    await expect(
      SettlementService.previewSettlement(PERIOD_MONTH, "integration-test-admin"),
    ).rejects.toThrow("DRAFT_EXISTS");
  });
});

// ---------------------------------------------------------------------------
// Referral fallback test — separate describe so it gets its own seed state
// ---------------------------------------------------------------------------
describe.skipIf(SKIP)("Referral fallback: places student in alternate class", () => {
  const ids = createIdTracker();
  const PERIOD_MONTH = "2099-02"; // distinct period to avoid DRAFT_EXISTS conflict

  let tutorId: string;
  let studentId: string;
  let fullClassId: string;
  let fallbackClassId: string;
  let bookId: string;
  let referralToken: string;

  beforeAll(async () => {
    tutorId = await seedTutor({ displayName: "Fallback Tutor" });
    ids.track("user", tutorId);

    studentId = await seedStudent();
    ids.track("user", studentId);

    bookId = await seedBook();
    ids.track("book", bookId);

    // Create a class that is already at capacity
    fullClassId = await seedClass({
      tutorUserId: tutorId,
      bookId,
      capacity: 1,
      packagePriceMinor: 100_000n,
    });
    ids.track("class", fullClassId);
    // Fill it
    await prisma.class.update({
      where: { classId: fullClassId },
      data: { enrolledCount: 1 },
    });

    // Create the fallback class with capacity
    fallbackClassId = await seedClass({
      tutorUserId: tutorId,
      bookId,
      capacity: 30,
      packagePriceMinor: 100_000n,
    });
    ids.track("class", fallbackClassId);

    // Referral points to the full class
    referralToken = await seedReferral({
      classId: fullClassId,
      tutorUserId: tutorId,
    });
    ids.track("referral", referralToken);
  });

  afterAll(() => ids.cleanup());

  it("places student in the fallback class when primary is full", async () => {
    const result = await seedEnrollment({
      referralToken,
      studentUserId: studentId,
    });
    ids.track("enrollment", result.enrollmentId);

    expect(result.placement).toBe("FALLBACK");

    const enrollment = await prisma.enrollment.findUnique({
      where: { enrollmentId: result.enrollmentId },
    });
    expect(enrollment!.classId).toBe(fallbackClassId);
  });
});
