import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNumber(value: bigint | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

function issueForPayment(
  payment: {
    status: string;
    createdAt: Date;
    enrollmentPackageId: string | null;
  },
  enrollment?: { status: string; paymentTransactionId: string | null },
  enrollmentPackage?: { status: string; paymentTransactionId: string | null },
) {
  const target = payment.enrollmentPackageId ? enrollmentPackage : enrollment;

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

export async function getPaymentReconciliation(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { q, days } = req.query as Record<string, string | undefined>;
    const daysBack = Math.min(Math.max(Number(days) || 30, 1), 180);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const search = q?.trim();

    const paymentWhere: Prisma.PaymentIntentWhereInput = {
      createdAt: { gte: since },
    };

    if (search) {
      paymentWhere.OR = [
        ...(UUID_RE.test(search)
          ? [
              { paymentIntentId: search },
              { enrollmentId: search },
              { enrollmentPackageId: search },
              { studentUserId: search },
            ]
          : []),
        { status: { contains: search, mode: "insensitive" } },
        { method: { contains: search, mode: "insensitive" } },
        { providerRef: { contains: search, mode: "insensitive" } },
      ];
    }

    const [
      payments,
      statusGroups,
      totalVolume,
      orphanEvents,
      recentActiveEnrollments,
    ] = await Promise.all([
      prisma.paymentIntent.findMany({
        where: paymentWhere,
        orderBy: { createdAt: "desc" },
        include: {
          events: { orderBy: { occurredAt: "desc" }, take: 1 },
          receipt: true,
        },
        take: 100,
      }),
      prisma.paymentIntent.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.paymentIntent.aggregate({
        where: { status: "SUCCESS", createdAt: { gte: since } },
        _sum: { amountMinor: true },
      }),
      prisma.paymentEvent.findMany({
        where: {
          paymentIntentId: null,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.enrollment.findMany({
        where: {
          status: "ACTIVE",
          createdAt: { gte: since },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);

    const enrollmentIds = [...new Set(payments.map((item) => item.enrollmentId))];
    const packageIds = [
      ...new Set(
        payments
          .map((item) => item.enrollmentPackageId)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    const studentIds = [...new Set(payments.map((item) => item.studentUserId))];

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
            select: { userId: true, displayName: true, email: true, role: true },
          })
        : [],
    ]);

    const enrollmentMap = new Map(enrollments.map((item) => [item.enrollmentId, item]));
    const packageMap = new Map(packages.map((item) => [item.enrollmentPackageId, item]));
    const userMap = new Map(users.map((item) => [item.userId, item]));

    const successfulEnrollmentIds = new Set(
      (
        await prisma.paymentIntent.findMany({
          where: {
            status: "SUCCESS",
            enrollmentId: {
              in: recentActiveEnrollments.map((item) => item.enrollmentId),
            },
          },
          select: { enrollmentId: true },
        })
      ).map((item) => item.enrollmentId),
    );

    const activeWithoutPayment = recentActiveEnrollments
      .filter((item) => !successfulEnrollmentIds.has(item.enrollmentId))
      .slice(0, 25)
      .map((item) => ({
        enrollmentId: item.enrollmentId,
        studentUserId: item.studentUserId,
        classId: item.classId,
        status: item.status,
        paymentTransactionId: item.paymentTransactionId,
        updatedAt: item.updatedAt,
      }));

    const paymentItems = payments.map((payment) => {
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
        studentName: student?.displayName || student?.email || "Unknown student",
        amountMinor: toNumber(payment.amountMinor),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        providerRef: payment.providerRef,
        receiptStatus: payment.receipt?.status ?? null,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        enrollmentStatus: enrollment?.status ?? null,
        enrollmentPaymentTransactionId: enrollment?.paymentTransactionId ?? null,
        packageStatus: enrollmentPackage?.status ?? null,
        packagePaymentTransactionId: enrollmentPackage?.paymentTransactionId ?? null,
        classId: enrollment?.classId ?? null,
        classTitle: enrollment?.class.title ?? null,
        tutorUserId: enrollment?.class.tutorUserId ?? null,
        lastEventType: payment.events[0]?.eventType ?? null,
        lastEventAt: payment.events[0]?.occurredAt ?? null,
        issue,
      };
    });

    const statusCounts = statusGroups.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    const issueCounts = paymentItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.issue.type] = (acc[item.issue.type] ?? 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      summary: {
        daysBack,
        totalPayments: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        successfulPayments: statusCounts.SUCCESS ?? 0,
        pendingPayments: statusCounts.PENDING ?? 0,
        failedPayments: statusCounts.FAILED ?? 0,
        successVolumeMinor: toNumber(totalVolume._sum.amountMinor) ?? 0,
        issueCount:
          (issueCounts.SUCCESS_NOT_ACTIVE ?? 0) +
          (issueCounts.FAILED_ACTIVE ?? 0) +
          (issueCounts.STALE_PENDING ?? 0) +
          (issueCounts.MISSING_PAYMENT_REF ?? 0) +
          orphanEvents.length +
          activeWithoutPayment.length,
        orphanEventCount: orphanEvents.length,
        activeWithoutPaymentCount: activeWithoutPayment.length,
        issueCounts,
      },
      payments: paymentItems,
      orphanEvents: orphanEvents.map((event) => ({
        paymentEventId: event.paymentEventId,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        createdAt: event.createdAt,
      })),
      activeWithoutPayment,
    });
  } catch (error) {
    logger.error("Get Payment Reconciliation Error:", error);
    return res.status(500).json({ error: "Could not fetch payment reconciliation" });
  }
}
