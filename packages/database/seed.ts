/**
 * Seed script: สร้าง mock data ใน DB สำหรับ admin-console
 * รัน: npm run seed (ใน packages/database)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Valid UUID v4-format constants
const TUTOR_1 = "a1b2c3d4-1111-4000-8000-000000000001";
const TUTOR_2 = "a1b2c3d4-1111-4000-8000-000000000002";
const TUTOR_3 = "a1b2c3d4-1111-4000-8000-000000000003";
const ADMIN_ID = "ad000000-1111-4000-8000-000000000001";
const STUDENT_1 = "b0000000-1111-4000-8000-000000000001";

const SERIES_ID = "c0000000-1111-4000-8000-000000000001";
const BOOK_ID = "c0000000-1111-4000-8000-000000000002";

const CLASS_1 = "d0000000-1111-4000-8000-000000000001";
const CLASS_2 = "d0000000-1111-4000-8000-000000000002";

const ENROLLMENT_1 = "e0000000-1111-4000-8000-000000000001";

const PAYMENT_1 = "f0000000-1111-4000-8000-000000000001";
const PAYMENT_2 = "f0000000-1111-4000-8000-000000000002";
const PAYMENT_3 = "f0000000-1111-4000-8000-000000000003";

const SR_1 = "11000000-1111-4000-8000-000000000001";
const SR_2 = "11000000-1111-4000-8000-000000000002";
const SR_3 = "11000000-1111-4000-8000-000000000003";

const PL_1 = "22000000-1111-4000-8000-000000000001";
const PL_2 = "22000000-1111-4000-8000-000000000002";
const PL_3 = "22000000-1111-4000-8000-000000000003";

const ADJ_1 = "33000000-1111-4000-8000-000000000001";
const ADJ_2 = "33000000-1111-4000-8000-000000000002";

const AE_1 = "44000000-1111-4000-8000-000000000001";
const AE_2 = "44000000-1111-4000-8000-000000000002";
const AE_3 = "44000000-1111-4000-8000-000000000003";
const AE_4 = "44000000-1111-4000-8000-000000000004";
const AE_5 = "44000000-1111-4000-8000-000000000005";
const AE_6 = "44000000-1111-4000-8000-000000000006";
const AE_7 = "44000000-1111-4000-8000-000000000007";
const AE_8 = "44000000-1111-4000-8000-000000000008";

async function main() {
  console.log("🌱 Starting seed...");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── 1. Users ────────────────────────────────────────────────────────────
  const tutors = [
    {
      userId: TUTOR_1,
      displayName: "สมชาย ใจดี",
      email: "tutor1@example.com",
      sponsorTutorId: null,
    },
    {
      userId: TUTOR_2,
      displayName: "สมหญิง รักเรียน",
      email: "tutor2@example.com",
      sponsorTutorId: TUTOR_1,
    },
    {
      userId: TUTOR_3,
      displayName: "อนุชา มั่นใจ",
      email: "tutor3@example.com",
      sponsorTutorId: TUTOR_2,
    },
  ];

  for (const t of tutors) {
    // upsert โดย userId (primary key) เพื่อให้ FK ใน adjustments/payoutLines ตรงเสมอ
    // ถ้ามี email ซ้ำกับ user อื่นให้ใช้ skip email (ลบ email เดิมก่อนถ้าจำเป็น)
    try {
      await prisma.user.upsert({
        where: { userId: t.userId } as any,
        update: { displayName: t.displayName },
        create: {
          ...t,
          userId: t.userId,
          role: "TUTOR",
          isActive: true,
        } as any,
      });
    } catch {
      // อาจ conflict email unique — ลองสร้างโดยไม่ใส่ email
      await prisma.user.upsert({
        where: { userId: t.userId } as any,
        update: { displayName: t.displayName },
        create: {
          userId: t.userId,
          displayName: t.displayName,
          role: "TUTOR",
          isActive: true,
          sponsorTutorId: t.sponsorTutorId,
        } as any,
      });
    }
  }

  await prisma.user.upsert({
    where: { userId: STUDENT_1 } as any,
    update: { displayName: "นักเรียน ทดสอบ" },
    create: {
      userId: STUDENT_1,
      role: "STUDENT",
      displayName: "นักเรียน ทดสอบ",
      email: "student1@example.com",
      isActive: true,
    } as any,
  });

  // Admin user (ใช้เป็น actorId ใน AuditEvents)
  await prisma.user.upsert({
    where: { userId: ADMIN_ID } as any,
    update: { displayName: "Finance Admin" },
    create: {
      userId: ADMIN_ID,
      role: "ADMIN",
      displayName: "Finance Admin",
      email: "admin@example.com",
      isActive: true,
    } as any,
  });
  console.log("✅ Users created");

  // ── 2. Series & Book ────────────────────────────────────────────────────
  await prisma.series.upsert({
    where: { code: "RA-S1" },
    update: {},
    create: {
      seriesId: SERIES_ID,
      code: "RA-S1",
      name: "Reading Advantage Series 1",
      cefrLevel: "A1",
      raLevelStart: 1,
      raLevelEnd: 5,
    } as any,
  });

  const book = await prisma.book.upsert({
    where: { bookCode: "RA-S1-L1" },
    update: {},
    create: {
      bookId: BOOK_ID,
      seriesId: SERIES_ID,
      levelNumber: 1,
      bookCode: "RA-S1-L1",
      title: "Reading Advantage Level 1",
      articleCount: 20,
      classHours: 25,
    } as any,
  });
  const actualBookId = book.bookId;
  console.log("✅ Series & Book created (bookId:", actualBookId, ")");

  // ── 3. Classes ──────────────────────────────────────────────────────────
  const classes = [
    {
      classId: CLASS_1,
      tutorUserId: TUTOR_1,
      title: "คลาส Reading Advantage 1",
    },
    {
      classId: CLASS_2,
      tutorUserId: TUTOR_2,
      title: "คลาส Reading Advantage 2",
    },
  ];

  for (const c of classes) {
    await prisma.class.upsert({
      where: { classId: c.classId } as any,
      update: {},
      create: {
        ...c,
        bookId: actualBookId,
        capacity: 10,
        enrolledCount: 3,
        status: "OPEN",
      } as any,
    });
  }
  console.log("✅ Classes created");

  // ── 4. Enrollment ───────────────────────────────────────────────────────
  await prisma.enrollment.upsert({
    where: { enrollmentId: ENROLLMENT_1 } as any,
    update: {},
    create: {
      enrollmentId: ENROLLMENT_1,
      classId: CLASS_1,
      studentUserId: STUDENT_1,
      status: "ACTIVE",
    } as any,
  });
  console.log("✅ Enrollment created");

  // ── 5. PaymentIntents ───────────────────────────────────────────────────
  const payments = [
    { id: PAYMENT_1, key: "mock-payment-1", offset: 0 },
    { id: PAYMENT_2, key: "mock-payment-2", offset: 1 },
    { id: PAYMENT_3, key: "mock-payment-3", offset: 2 },
  ];

  for (const p of payments) {
    await prisma.paymentIntent.upsert({
      where: { idempotencyKey: p.key },
      update: {},
      create: {
        paymentIntentId: p.id,
        enrollmentId: ENROLLMENT_1,
        studentUserId: STUDENT_1,
        amountMinor: BigInt(250000), // 2500 THB
        currency: "THB",
        method: "PROMPTPAY",
        status: "SUCCESS",
        idempotencyKey: p.key,
        createdAt: new Date(monthStart.getTime() + p.offset * 86400000),
      } as any,
    });
  }
  console.log("✅ PaymentIntents created (3 × ฿2,500)");

  // ── 6. SettlementRuns ───────────────────────────────────────────────────
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = [now.getFullYear(), now.getMonth()];
  const prevPeriod =
    m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, "0")}`;
  const prevPrevPeriod =
    m <= 1
      ? `${y - 1}-${String(12 - (1 - m)).padStart(2, "0")}`
      : `${y}-${String(m - 1).padStart(2, "0")}`;

  const runs = [
    {
      settlementRunId: SR_1,
      periodMonth: prevPrevPeriod,
      status: "APPROVED",
      createdBy: ADMIN_ID,
      approvedBy: ADMIN_ID,
      approvedAt: new Date(now.getTime() - 60 * 24 * 3600000),
    },
    {
      settlementRunId: SR_2,
      periodMonth: prevPeriod,
      status: "APPROVED",
      createdBy: ADMIN_ID,
      approvedBy: ADMIN_ID,
      approvedAt: new Date(now.getTime() - 30 * 24 * 3600000),
    },
    {
      settlementRunId: SR_3,
      periodMonth: currentPeriod,
      status: "DRAFT",
      createdBy: ADMIN_ID,
    },
  ];

  for (const run of runs) {
    await prisma.settlementRun.upsert({
      where: { settlementRunId: run.settlementRunId } as any,
      update: {},
      create: { ...run, previewPayload: {} } as any,
    });
  }
  console.log(
    `✅ SettlementRuns created (${prevPrevPeriod}, ${prevPeriod} APPROVED + ${currentPeriod} DRAFT)`,
  );

  // ── 7. PayoutLines ──────────────────────────────────────────────────────
  const payoutLines = [
    {
      payoutLineId: PL_1,
      settlementRunId: SR_1,
      tutorUserId: TUTOR_1,
      gross: BigInt(750000),
      rate: 0.1,
      payout: BigInt(75000),
    },
    {
      payoutLineId: PL_2,
      settlementRunId: SR_2,
      tutorUserId: TUTOR_1,
      gross: BigInt(750000),
      rate: 0.1,
      payout: BigInt(75000),
    },
    {
      payoutLineId: PL_3,
      settlementRunId: SR_2,
      tutorUserId: TUTOR_2,
      gross: BigInt(500000),
      rate: 0.1,
      payout: BigInt(50000),
    },
  ];

  for (const line of payoutLines) {
    await prisma.payoutLine.upsert({
      where: { payoutLineId: line.payoutLineId } as any,
      update: {},
      create: {
        payoutLineId: line.payoutLineId,
        settlementRunId: line.settlementRunId,
        tutorUserId: line.tutorUserId,
        grossVolumeMinor: line.gross,
        payoutRate: line.rate,
        payoutAmountMinor: line.payout,
        eligibilityStatus: "ELIGIBLE",
      } as any,
    });
  }
  console.log("✅ PayoutLines created");

  // ── 8. Adjustments ──────────────────────────────────────────────────────
  const adjustments = [
    {
      adjustmentId: ADJ_1,
      settlementRunId: SR_2,
      tutorUserId: TUTOR_1,
      amountMinor: BigInt(-5000),
      reason: "เงินคืนค่าธรรมเนียมจากการยกเลิกคลาส",
      createdBy: ADMIN_ID,
      createdAt: new Date(now.getTime() - 35 * 24 * 3600000),
    },
    {
      adjustmentId: ADJ_2,
      settlementRunId: SR_3,
      tutorUserId: TUTOR_2,
      amountMinor: BigInt(10000),
      reason: "โบนัสพิเศษรายเดือน — ยอดขายเกินเป้า",
      createdBy: ADMIN_ID,
      createdAt: new Date(now.getTime() - 2 * 24 * 3600000),
    },
  ];

  for (const adj of adjustments) {
    await prisma.adjustment.upsert({
      where: { adjustmentId: adj.adjustmentId } as any,
      update: {},
      create: adj as any,
    });
  }
  console.log("✅ Adjustments created");

  // ── 9. AuditEvents ──────────────────────────────────────────────────────
  const auditEvents = [
    {
      id: AE_1,
      action: "PREVIEW",
      entityType: "SettlementRun",
      entityId: SR_1,
      payload: { periodMonth: prevPrevPeriod },
      daysAgo: 62,
    },
    {
      id: AE_2,
      action: "APPROVE",
      entityType: "SettlementRun",
      entityId: SR_1,
      payload: { periodMonth: prevPrevPeriod, totalPayoutSatang: 75000 },
      daysAgo: 60,
    },
    {
      id: AE_3,
      action: "PREVIEW",
      entityType: "SettlementRun",
      entityId: SR_2,
      payload: { periodMonth: prevPeriod },
      daysAgo: 32,
    },
    {
      id: AE_4,
      action: "ADJUST_CREATE",
      entityType: "Adjustment",
      entityId: ADJ_1,
      payload: { amountSatang: -5000, reason: "เงินคืนค่าธรรมเนียม" },
      daysAgo: 35,
    },
    {
      id: AE_5,
      action: "APPROVE",
      entityType: "SettlementRun",
      entityId: SR_2,
      payload: { periodMonth: prevPeriod, totalPayoutSatang: 125000 },
      daysAgo: 30,
    },
    {
      id: AE_6,
      action: "EXPORT",
      entityType: "SettlementRun",
      entityId: SR_2,
      payload: { filename: `settlement-${prevPeriod}.csv` },
      daysAgo: 29,
    },
    {
      id: AE_7,
      action: "PREVIEW",
      entityType: "SettlementRun",
      entityId: SR_3,
      payload: { periodMonth: currentPeriod },
      daysAgo: 1,
    },
    {
      id: AE_8,
      action: "ADJUST_CREATE",
      entityType: "Adjustment",
      entityId: ADJ_2,
      payload: { amountSatang: 10000, reason: "โบนัสพิเศษ" },
      daysAgo: 2,
    },
  ];

  for (const ev of auditEvents) {
    await prisma.auditEvent.upsert({
      where: { auditEventId: ev.id } as any,
      update: {},
      create: {
        auditEventId: ev.id,
        actorId: ADMIN_ID,
        action: ev.action,
        entityType: ev.entityType,
        entityId: ev.entityId,
        payload: ev.payload,
        createdAt: new Date(now.getTime() - ev.daysAgo * 24 * 3600000),
      } as any,
    });
  }
  console.log("✅ AuditEvents created (8 events)");

  console.log("\n🎉 Seed complete!");
  console.log(`   Tutors: 3, Student: 1`);
  console.log(`   Settlement Runs: 3 (2 APPROVED + 1 DRAFT)`);
  console.log(`   Payout Lines: ${payoutLines.length}`);
  console.log(`   Adjustments: ${adjustments.length}`);
  console.log(`   Audit Events: ${auditEvents.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
