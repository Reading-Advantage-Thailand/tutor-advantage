import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import crypto from "crypto";
import {
  buildReceiptNumber,
  calculateVatInclusive,
} from "../services/taxService";
import { getIctMonthWindow } from "../services/commissionService";

export async function createPaymentIntent(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { enrollmentId, amountSatang, method = "promptpay" } = req.body;
    const idempotencyKey =
      req.body.idempotencyKey ||
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"];

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    if (!enrollmentId || typeof amountSatang !== "number") {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "enrollmentId and amountSatang (as number) are required",
          requestId: req.id,
        },
      });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { enrollmentId },
      include: { class: true },
    });

    if (!enrollment) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Enrollment not found",
          requestId: req.id,
        },
      });
    }

    if (enrollment.studentUserId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Cannot create payment intent for someone else's enrollment",
          requestId: req.id,
        },
      });
    }

    if (enrollment.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: "Enrollment is not in PENDING_PAYMENT status",
          requestId: req.id,
        },
      });
    }

    // Amount must be an integer represented in Satang
    if (!Number.isInteger(amountSatang)) {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang must be an integer",
          requestId: req.id,
        },
      });
    }

    if (BigInt(amountSatang) !== enrollment.class.packagePriceMinor) {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang must match the class package price",
          requestId: req.id,
        },
      });
    }

    const student = await prisma.user.findUnique({
      where: { userId },
      select: { dateOfBirth: true },
    });

    if (student?.dateOfBirth && isUnderage(student.dateOfBirth)) {
      const guardianConsent = await prisma.userConsent.findFirst({
        where: {
          userId,
          consentType: "GUARDIAN_CONTACT_PAYMENT",
          status: "granted",
        },
      });

      if (!guardianConsent) {
        return res.status(403).json({
          error: {
            code: "GUARDIAN_CONSENT_REQUIRED",
            message: "Guardian consent is required before payment",
            requestId: req.id,
          },
        });
      }
    }

    if (amountSatang <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang must be greater than zero",
          requestId: req.id,
        },
      });
    }

    if (!["promptpay", "card"].includes(method)) {
      return res.status(400).json({
        error: {
          code: "INVALID_METHOD",
          message: "method must be promptpay or card",
          requestId: req.id,
        },
      });
    }

    if (idempotencyKey && typeof idempotencyKey !== "string") {
      return res.status(400).json({
        error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message: "Idempotency key must be a string",
          requestId: req.id,
        },
      });
    }

    if (idempotencyKey) {
      const existingByKey = await prisma.paymentIntent.findUnique({
        where: { idempotencyKey },
      });

      if (existingByKey) {
        return res.status(200).json({
          message: "Existing payment intent returned by idempotency key",
          intent: {
            ...existingByKey,
            amountMinor: Number(existingByKey.amountMinor),
          },
        });
      }
    }

    const existingIntent = await prisma.paymentIntent.findFirst({
      where: {
        enrollmentId,
        studentUserId: userId,
        method,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingIntent) {
      return res.status(200).json({
        message: "Existing pending payment intent returned",
        intent: {
          ...existingIntent,
          amountMinor: Number(existingIntent.amountMinor),
        },
      });
    }

    const intent = await prisma.paymentIntent.create({
      data: {
        enrollmentId,
        studentUserId: userId,
        amountMinor: BigInt(amountSatang), // using BigInt as specified in schema
        currency: "THB",
        method,
        status: "PENDING",
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    // When returning, convert BigInt back to String/Number to keep JSON serializable
    return res.status(201).json({
      message: "Payment intent created successfully",
      intent: {
        ...intent,
        amountMinor: Number(intent.amountMinor),
      },
    });
  } catch (error: any) {
    console.error("Create Payment Intent Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not create payment intent",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

async function fulfillPaymentIntent(paymentIntentId: string, providerRef?: string | null) {
  return prisma.$transaction(async (tx) => {
    const existingIntent = await tx.paymentIntent.findUnique({
      where: { paymentIntentId },
    });

    if (!existingIntent) {
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    if (existingIntent.status === "SUCCESS") {
      return existingIntent;
    }

    const intent = await tx.paymentIntent.update({
      where: { paymentIntentId },
      data: {
        status: "SUCCESS",
        providerRef,
      },
    });

    await tx.enrollment.update({
      where: { enrollmentId: intent.enrollmentId },
      data: {
        status: "ACTIVE",
        paymentTransactionId: providerRef,
      },
    });

    const tax = calculateVatInclusive(intent.amountMinor);
    await tx.paymentReceipt.upsert({
      where: { paymentIntentId },
      update: {},
      create: {
        paymentIntentId,
        studentUserId: intent.studentUserId,
        receiptNumber: buildReceiptNumber(paymentIntentId),
        grossAmountMinor: tax.grossAmountMinor,
        vatAmountMinor: tax.vatAmountMinor,
        netAmountMinor: tax.netAmountMinor,
        currency: intent.currency,
      },
    });

    return intent;
  });
}

export async function confirmMockPayment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        error: {
          code: "MOCK_PAYMENT_DISABLED",
          message: "Mock payment confirmation is disabled in production",
          requestId: req.id,
        },
      });
    }

    const userId = req.user?.userId;
    const { paymentIntentId } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    if (!paymentIntentId) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "paymentIntentId is required",
          requestId: req.id,
        },
      });
    }

    const intent = await prisma.paymentIntent.findUnique({
      where: { paymentIntentId },
    });

    if (!intent) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Payment intent not found",
          requestId: req.id,
        },
      });
    }

    if (intent.studentUserId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Cannot confirm someone else's payment intent",
          requestId: req.id,
        },
      });
    }

    const providerRef = `mock_${paymentIntentId}`;

    await prisma.paymentEvent.create({
      data: {
        paymentIntentId,
        eventType: "mock.charge.successful",
        rawPayload: {
          id: providerRef,
          status: "successful",
          metadata: { paymentIntentId },
        },
        occurredAt: new Date(),
      },
    });

    const fulfilledIntent = await fulfillPaymentIntent(paymentIntentId, providerRef);

    return res.status(200).json({
      message: "Mock payment confirmed",
      intent: {
        ...fulfilledIntent,
        amountMinor: Number(fulfilledIntent.amountMinor),
      },
    });
  } catch (error: any) {
    console.error("Confirm Mock Payment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not confirm mock payment",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const payload = req.body as any;

    if (!verifyWebhookSignature(req, payload)) {
      return res.status(401).send("Invalid webhook signature");
    }

    // Mocking an Omise-like structured event payload
    const eventType = payload.key || payload.type || "charge.complete";
    const providerRef = payload.data?.id || payload.id;
    const providerEventId = payload.id || payload.event_id || payload.data?.id;
    const paymentIntentId = payload.data?.metadata?.paymentIntentId;
    const isSuccessful =
      payload.data?.status === "successful" || payload.status === "successful";
    const isNegativeOutcome =
      eventType.includes("refund") ||
      eventType.includes("chargeback") ||
      payload.data?.status === "reversed" ||
      payload.data?.status === "failed" ||
      payload.status === "reversed" ||
      payload.status === "failed";

    if (providerEventId) {
      const existingEvent = await prisma.paymentEvent.findUnique({
        where: { providerEventId },
      });
      if (existingEvent) {
        return res.status(200).send("Webhook replay ignored");
      }
    }

    // 1. Create a durable record of the event arriving
    await prisma.paymentEvent.create({
      data: {
        paymentIntentId: paymentIntentId || null,
        providerEventId: providerEventId || null,
        eventType,
        rawPayload: payload,
        occurredAt: new Date(),
      },
    });

    if (!paymentIntentId) {
      // If we don't know what intent this belongs to, just ack it to prevent retries
      return res.status(200).send("Event recorded without intent mapping");
    }

    // Wrap the fulfillment operations in a Transaction
    if (isSuccessful) {
      await fulfillPaymentIntent(paymentIntentId, providerRef);
    } else if (isNegativeOutcome) {
      await recordNegativePaymentOutcome(paymentIntentId, providerRef, eventType);
    } else {
      await prisma.paymentIntent.update({
        where: { paymentIntentId },
        data: {
          status: "FAILED",
          providerRef,
        },
      });
    }

    return res.status(200).send("Webhook processed successfully");
  } catch (error: any) {
    console.error("Payment Webhook Error:", error);
    // Return 200 even on errors for certain webhook providers to stop blast retries,
    // unless we strictly want them to retry. Returning 500 for now for visibility.
    return res.status(500).send("Webhook processing failed");
  }
}

async function recordNegativePaymentOutcome(
  paymentIntentId: string,
  providerRef: string | null | undefined,
  eventType: string,
) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { paymentIntentId },
  });

  if (!intent) throw new Error("PAYMENT_INTENT_NOT_FOUND");

  if (intent.status !== "SUCCESS") {
    await prisma.paymentIntent.update({
      where: { paymentIntentId },
      data: { status: "FAILED", providerRef },
    });
    return;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { enrollmentId: intent.enrollmentId },
    include: { class: true },
  });

  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

  const nextPeriodMonth = getNextIctPeriodMonth();
  let run = await prisma.settlementRun.findFirst({
    where: { periodMonth: nextPeriodMonth, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });

  if (!run) {
    run = await prisma.settlementRun.create({
      data: {
        periodMonth: nextPeriodMonth,
        status: "DRAFT",
        createdBy: "payment-webhook",
        previewPayload: {},
      },
    });
  }

  await prisma.adjustment.create({
    data: {
      settlementRunId: run.settlementRunId,
      tutorUserId: enrollment.class.tutorUserId,
      amountMinor: -intent.amountMinor,
      reason: `${eventType}:${paymentIntentId}`,
      status: "APPROVED",
      createdBy: "payment-webhook",
    },
  });
}

function verifyWebhookSignature(req: Request, payload: unknown) {
  const secret = process.env.OMISE_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers["omise-signature"] || req.headers["x-omise-signature"];
  if (!signature || Array.isArray(signature)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update((req as Request & { rawBody?: string }).rawBody || JSON.stringify(payload))
    .digest("hex");

  const normalizedSignature = signature.replace(/^sha256=/, "");
  if (normalizedSignature.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(normalizedSignature),
    Buffer.from(expected),
  );
}

function isUnderage(dateOfBirth: Date) {
  const now = new Date();
  const eighteenthBirthday = new Date(dateOfBirth);
  eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);
  return eighteenthBirthday > now;
}

function getNextIctPeriodMonth() {
  const now = new Date();
  const ictDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = ictDate.getUTCFullYear();
  const month = ictDate.getUTCMonth() + 1;
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  getIctMonthWindow(`${next.year}-${String(next.month).padStart(2, "0")}`);
  return `${next.year}-${String(next.month).padStart(2, "0")}`;
}

export async function getPaymentHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    // 1. Fetch payments
    const payments = await prisma.paymentIntent.findMany({
      where: { studentUserId: userId },
      orderBy: { createdAt: "desc" },
      include: { receipt: true },
    });

    if (payments.length === 0) {
      return res.status(200).json({ payments: [] });
    }

    // 2. Collect unique enrollment IDs
    const enrollmentIds = [...new Set(payments.map(p => p.enrollmentId))];

    // 3. Fetch related Enrollments and their Class/Book info
    const enrollments = await prisma.enrollment.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      include: {
        class: {
          include: {
            book: true,
          },
        },
      },
    });

    // Map enrollments by ID for fast lookup
    const enrollmentMap = enrollments.reduce((acc: any, curr) => {
      acc[curr.enrollmentId] = curr;
      return acc;
    }, {});

    // 4. Combine data and format BigInts
    const result = payments.map(payment => {
      const enrollment = enrollmentMap[payment.enrollmentId];
      
      return {
        paymentIntentId: payment.paymentIntentId,
        amountMinor: Number(payment.amountMinor),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        providerRef: payment.providerRef,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        receipt: payment.receipt
          ? {
              receiptNumber: payment.receipt.receiptNumber,
              grossAmountMinor: Number(payment.receipt.grossAmountMinor),
              vatAmountMinor: Number(payment.receipt.vatAmountMinor),
              netAmountMinor: Number(payment.receipt.netAmountMinor),
              status: payment.receipt.status,
              issuedAt: payment.receipt.issuedAt,
            }
          : null,
        enrollment: enrollment ? {
          enrollmentId: enrollment.enrollmentId,
          status: enrollment.status,
          class: {
            classId: enrollment.class.classId,
            title: enrollment.class.title,
            book: {
              title: enrollment.class.book.title,
              bookCode: enrollment.class.book.bookCode,
            }
          }
        } : null
      };
    });

    return res.status(200).json({
      payments: result,
    });

  } catch (error: any) {
    console.error("Get Payment History Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch payment history",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

