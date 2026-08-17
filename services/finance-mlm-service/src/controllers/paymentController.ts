import {
  CONSENT_STATUS_GRANTED,
  GUARDIAN_CONSENT_TYPE,
  isUnderGuardianAge,
  logger,
} from "@tutor-advantage/shared-config";
import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import crypto from "crypto";
import { buildReceiptNumber } from "../services/taxService";
import {
  calculateCommissionInfo,
  calculatePayoutMinor,
  formatIctPeriodMonth,
  getIctMonthWindow,
} from "../services/commissionService";
import {
  createOmiseCharge,
  downloadOmiseDocumentAsDataUri,
  getOmisePublicKey,
  isOmiseConfigured,
  retrieveOmiseCharge,
} from "../services/omiseService";

export async function createPaymentIntent(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const {
      enrollmentId,
      enrollmentPackageId,
      amountSatang,
      method = "promptpay",
      omiseToken,
      returnUri,
    } = req.body;
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

    const enrollmentPackage = enrollmentPackageId
      ? await prisma.enrollmentPackage.findUnique({
          where: { enrollmentPackageId },
          include: { classBookCycle: true },
        })
      : null;

    if (enrollmentPackageId && !enrollmentPackage) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Enrollment package not found",
          requestId: req.id,
        },
      });
    }

    if (
      enrollmentPackage &&
      (enrollmentPackage.enrollmentId !== enrollment.enrollmentId ||
        enrollmentPackage.studentUserId !== userId)
    ) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Cannot create payment intent for someone else's package",
          requestId: req.id,
        },
      });
    }

    if (!enrollmentPackage && enrollment.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: "Enrollment is not in PENDING_PAYMENT status",
          requestId: req.id,
        },
      });
    }

    if (enrollmentPackage && enrollmentPackage.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: "Enrollment package is not in PENDING_PAYMENT status",
          requestId: req.id,
        },
      });
    }

    // Amount must be an integer represented in Satang
    if (!Number.isSafeInteger(amountSatang)) {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang must be a safe integer",
          requestId: req.id,
        },
      });
    }

    const expectedAmount = enrollmentPackage
      ? enrollmentPackage.classBookCycle.packagePriceMinor
      : enrollment.class.packagePriceMinor;

    if (BigInt(amountSatang) !== expectedAmount) {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang must match the package price",
          requestId: req.id,
        },
      });
    }

    const guardianGate = await getPaymentGuardianGate(userId);
    if (guardianGate) {
      return res.status(guardianGate.status).json({
        error: {
          code: guardianGate.code,
          message: guardianGate.message,
          requestId: req.id,
        },
      });
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

    if (!isOmiseConfigured()) {
      return res.status(503).json({
        error: {
          code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
          message: "Omise public/private keys are not configured",
          requestId: req.id,
        },
      });
    }

    if (method === "card" && typeof omiseToken !== "string") {
      return res.status(400).json({
        error: {
          code: "OMISE_TOKEN_REQUIRED",
          message: "omiseToken is required for card payments",
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

      if (existingByKey?.providerRef) {
        const checkout = await buildCheckoutDetails(existingByKey.providerRef);
        return res.status(200).json({
          message: "Existing payment intent returned by idempotency key",
          intent: serializePaymentIntent(existingByKey),
          checkout,
        });
      }
    }

    const existingIntent = await prisma.paymentIntent.findFirst({
      where: {
        enrollmentId,
        enrollmentPackageId: enrollmentPackageId || null,
        studentUserId: userId,
        status: { in: ["PENDING", "SUCCESS"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingIntent?.status === "SUCCESS") {
      return res.status(409).json({
        error: {
          code: "PAYMENT_ALREADY_COMPLETED",
          message: "This enrollment already has a successful payment",
          requestId: req.id,
        },
      });
    }

    if (existingIntent && existingIntent.method !== method) {
      return res.status(409).json({
        error: {
          code: "PAYMENT_IN_PROGRESS",
          message: "Another payment method is already in progress for this enrollment",
          requestId: req.id,
        },
      });
    }

    if (existingIntent?.providerRef) {
      const checkout = await buildCheckoutDetails(existingIntent.providerRef);
      return res.status(200).json({
        message: "Existing pending payment intent returned",
        intent: serializePaymentIntent(existingIntent),
        checkout,
      });
    }

    // A pending provider charge may have been marked FAILED by an earlier
    // webhook. Reconcile it before allowing another intent for this target.
    const failedIntent = await prisma.paymentIntent.findFirst({
      where: {
        enrollmentId,
        enrollmentPackageId: enrollmentPackageId || null,
        studentUserId: userId,
        status: "FAILED",
        providerRef: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (failedIntent?.providerRef) {
      let charge;
      try {
        charge = await retrieveOmiseCharge(failedIntent.providerRef);
      } catch (error) {
        logger.warn("Could not reconcile failed payment intent before creating another charge:", error);
        return res.status(409).json({
          error: {
            code: "PAYMENT_IN_PROGRESS",
            message: "An existing payment is still being reconciled",
            requestId: req.id,
          },
        });
      }

      if (charge.paid || charge.status === "successful") {
        const recoveredIntent = await fulfillPaymentIntent(
          failedIntent.paymentIntentId,
          charge.id,
        );
        return res.status(200).json({
          message: "Existing payment intent recovered",
          intent: serializePaymentIntent(recoveredIntent),
          checkout: buildCheckoutDetailsFromCharge(charge),
        });
      }

      if (!isTerminalChargeStatus(charge.status)) {
        return res.status(409).json({
          error: {
            code: "PAYMENT_IN_PROGRESS",
            message: "An existing payment is still in progress for this enrollment",
            requestId: req.id,
          },
        });
      }
    }

    const intent =
      existingIntent ||
      (await prisma.paymentIntent.create({
        data: {
          enrollmentId,
          enrollmentPackageId: enrollmentPackageId || undefined,
          studentUserId: userId,
          amountMinor: BigInt(amountSatang), // using BigInt as specified in schema
          currency: "THB",
          method,
          status: "PENDING",
          idempotencyKey: idempotencyKey || undefined,
        },
      }));

    const charge = await createOmiseCharge({
      amount: amountSatang,
      currency: "THB",
      description: `Tutor Advantage enrollment ${enrollmentId}`,
      paymentIntentId: intent.paymentIntentId,
      enrollmentId,
      studentUserId: userId,
      returnUri: buildReturnUri(returnUri, intent.paymentIntentId),
      method,
      cardToken: omiseToken,
      ip: getClientIp(req),
    });

    const updatedIntent = await prisma.paymentIntent.update({
      where: { paymentIntentId: intent.paymentIntentId },
      data: {
        providerRef: charge.id,
        status: charge.status === "failed" ? "FAILED" : "PENDING",
      },
    });

    await prisma.paymentEvent.create({
      data: {
        paymentIntentId: intent.paymentIntentId,
        providerEventId: `local:${charge.id}:create`,
        eventType: "omise.charge.create",
        rawPayload: charge as any,
        occurredAt: new Date(),
      },
    });

    const finalIntent = (charge.paid || charge.status === "successful")
      ? await fulfillPaymentIntent(intent.paymentIntentId, charge.id)
      : charge.status === "failed"
        ? await recordNegativePaymentOutcome(
            intent.paymentIntentId,
            charge.id,
            "omise.charge.failed",
          )
        : updatedIntent;

    // When returning, convert BigInt back to String/Number to keep JSON serializable
    return res.status(201).json({
      message: "Payment intent created successfully",
      intent: serializePaymentIntent(finalIntent),
      checkout: buildCheckoutDetailsFromCharge(charge),
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    if (error.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "PAYMENT_IN_PROGRESS",
          message: "Another payment intent already exists for this enrollment",
          requestId: req.id,
        },
      });
    }
    logger.error("Create Payment Intent Error:", error);
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

export async function getPaymentConfig(_req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({
    provider: "omise",
    publicKey: getOmisePublicKey(),
    configured: isOmiseConfigured(),
  });
}

export async function getPaymentStatus(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const paymentIntentId = req.params.paymentIntentId;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
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
          message: "Cannot view someone else's payment intent",
          requestId: req.id,
        },
      });
    }

    let currentIntent = intent;
    let checkout = await buildCheckoutDetails(intent.providerRef);

    if (intent.providerRef && ["PENDING", "FAILED"].includes(intent.status)) {
      const charge = await retrieveOmiseCharge(intent.providerRef);
      checkout = buildCheckoutDetailsFromCharge(charge);

      if (charge.paid || charge.status === "successful") {
        currentIntent = await fulfillPaymentIntent(intent.paymentIntentId, charge.id);
      } else if (
        intent.status === "PENDING" &&
        ["failed", "expired", "reversed"].includes(charge.status)
      ) {
        currentIntent = await recordNegativePaymentOutcome(
          intent.paymentIntentId,
          charge.id,
          `omise.charge.${charge.status}`,
        );
      }
    }

    return res.status(200).json({
      intent: serializePaymentIntent(currentIntent),
      checkout,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Payment Status Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch payment status",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

export async function getPromptPayQrCode(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const paymentIntentId = req.params.paymentIntentId;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
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
          message: "Cannot view someone else's QR code",
          requestId: req.id,
        },
      });
    }

    if (!intent.providerRef) {
      return res.status(400).json({
        error: {
          code: "QR_NOT_READY",
          message: "Payment intent has no Omise charge yet",
          requestId: req.id,
        },
      });
    }

    const charge = await retrieveOmiseCharge(intent.providerRef);
    const downloadUri = charge.source?.scannable_code?.image?.download_uri;

    if (!downloadUri) {
      return res.status(404).json({
        error: {
          code: "QR_NOT_FOUND",
          message: "Omise did not return a PromptPay QR code for this charge",
          requestId: req.id,
        },
      });
    }

    const dataUri = await downloadOmiseDocumentAsDataUri(downloadUri);

    return res.status(200).json({
      paymentIntentId,
      chargeId: charge.id,
      dataUri,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get PromptPay QR Code Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch PromptPay QR code",
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

    const duplicateSuccess = await tx.paymentIntent.findFirst({
      where: {
        enrollmentId: existingIntent.enrollmentId,
        enrollmentPackageId: existingIntent.enrollmentPackageId,
        studentUserId: existingIntent.studentUserId,
        status: "SUCCESS",
        NOT: { paymentIntentId },
      },
    });

    if (duplicateSuccess) {
      return tx.paymentIntent.update({
        where: { paymentIntentId },
        data: { status: "FAILED", providerRef },
      });
    }

    const cancelledEnrollment = !existingIntent.enrollmentPackageId
      ? await tx.enrollment.findUnique({
          where: { enrollmentId: existingIntent.enrollmentId },
          select: { status: true, classId: true },
        })
      : null;

    const intent = await tx.paymentIntent.update({
      where: { paymentIntentId },
      data: {
        status: "SUCCESS",
        providerRef,
        paidAt: new Date(),
      },
    });

    if (intent.enrollmentPackageId) {
      await tx.enrollmentPackage.update({
        where: { enrollmentPackageId: intent.enrollmentPackageId },
        data: {
          status: "ACTIVE",
          paymentTransactionId: providerRef,
        },
      });
    } else {
      await tx.enrollment.update({
        where: { enrollmentId: intent.enrollmentId },
        data: {
          status: "ACTIVE",
          paymentTransactionId: providerRef,
        },
      });

      if (cancelledEnrollment?.status === "CANCELLED") {
        await tx.class.update({
          where: { classId: cancelledEnrollment.classId },
          data: { enrolledCount: { increment: 1 } },
        });
      }

      await tx.enrollmentPackage.updateMany({
        where: {
          enrollmentId: intent.enrollmentId,
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "ACTIVE",
          paymentTransactionId: providerRef,
        },
      });
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Confirm Mock Payment Error:", error);
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
      payload.data?.status === "successful" ||
      payload.status === "successful" ||
      payload.data?.paid === true ||
      payload.paid === true;
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

    if (!paymentIntentId) {
      // If we don't know what intent this belongs to, just ack it to prevent retries
      await prisma.paymentEvent.create({
        data: {
          paymentIntentId: null,
          providerEventId: providerEventId || null,
          eventType,
          rawPayload: payload,
          occurredAt: new Date(),
        },
      });
      return res.status(200).send("Event recorded without intent mapping");
    }

    // Omise webhook payloads are notifications, not the source of truth. A
    // successful-looking event must be confirmed by retrieving the charge.
    let verifiedCharge: Awaited<ReturnType<typeof retrieveOmiseCharge>> | null = null;
    if (isSuccessful && !isNegativeOutcome && providerRef) {
      verifiedCharge = await retrieveOmiseCharge(providerRef);
    }

    if (isNegativeOutcome) {
      await recordNegativePaymentOutcome(paymentIntentId, providerRef, eventType);
    } else if (verifiedCharge && (verifiedCharge.paid || verifiedCharge.status === "successful")) {
      await fulfillPaymentIntent(paymentIntentId, verifiedCharge.id);
    }

    // Record the event after state reconciliation so a failed processing
    // attempt can be retried safely by the provider.
    await prisma.paymentEvent.create({
      data: {
        paymentIntentId,
        providerEventId: providerEventId || null,
        eventType,
        rawPayload: payload,
        occurredAt: new Date(),
      },
    });

    return res.status(200).send("Webhook processed successfully");
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Payment Webhook Error:", error);
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
    return prisma.$transaction(async (tx) => {
      const failedIntent = await tx.paymentIntent.update({
        where: { paymentIntentId },
        data: { status: "FAILED", providerRef },
      });

      if (intent.enrollmentPackageId) {
        await tx.enrollmentPackage.updateMany({
          where: {
            enrollmentPackageId: intent.enrollmentPackageId,
            status: "PENDING_PAYMENT",
          },
          data: {
            status: "CANCELLED",
          },
        });

        return failedIntent;
      }

      const cancelled = await tx.enrollment.updateMany({
        where: {
          enrollmentId: intent.enrollmentId,
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "CANCELLED",
          paymentExpiresAt: null,
        },
      });

      if (cancelled.count > 0) {
        const enrollment = await tx.enrollment.findUnique({
          where: { enrollmentId: intent.enrollmentId },
          select: { classId: true, class: { select: { enrolledCount: true } } },
        });

        if (enrollment) {
          await tx.class.update({
            where: { classId: enrollment.classId },
            data: {
              enrolledCount: Math.max(0, enrollment.class.enrolledCount - 1),
            },
          });
        }
      }

      return failedIntent;
    });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { enrollmentId: intent.enrollmentId },
    include: { class: true },
  });

  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

  const reason = `${eventType}:${paymentIntentId}`;
  const existingAdjustment = await prisma.adjustment.findFirst({
    where: { reason },
    select: { adjustmentId: true },
  });
  if (existingAdjustment) return intent;

  const paidPeriodMonth = formatIctPeriodMonth(intent.paidAt ?? intent.updatedAt);
  const paidRun = await prisma.settlementRun.findFirst({
    where: { periodMonth: paidPeriodMonth },
    orderBy: { createdAt: "desc" },
  });

  // If the original period is still being prepared, keep the clawback there.
  // Once it has been approved, put the reclaim in the next period instead.
  const clawbackPeriodMonth =
    paidRun?.status === "APPROVED"
      ? getFollowingIctPeriodMonth(paidPeriodMonth)
      : paidPeriodMonth;
  let run =
    paidRun && paidPeriodMonth === clawbackPeriodMonth &&
    ["DRAFT", "SUBMITTED", "ADJUSTMENT_PENDING"].includes(paidRun.status)
      ? paidRun
      : await prisma.settlementRun.findFirst({
          where: { periodMonth: clawbackPeriodMonth, status: "DRAFT" },
          orderBy: { createdAt: "desc" },
        });

  if (!run) {
    run = await prisma.settlementRun.findFirst({
      where: { periodMonth: clawbackPeriodMonth, status: "ADJUSTMENT_PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!run) {
    // This holder is deliberately not DRAFT: it lets the monthly scheduler
    // create the real preview instead of treating a webhook as a settlement.
    run = await prisma.settlementRun.create({
      data: {
        periodMonth: clawbackPeriodMonth,
        status: "ADJUSTMENT_PENDING",
        createdBy: "payment-webhook",
        previewPayload: {},
      },
    });
  }

  const amountMinor = await estimatePaidCommissionMinor(
    intent,
    enrollment.class.tutorUserId,
    paidPeriodMonth,
  );

  await prisma.$transaction(async (tx) => {
    if (intent.enrollmentPackageId) {
      await tx.enrollmentPackage.updateMany({
        where: {
          enrollmentPackageId: intent.enrollmentPackageId,
          status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
        },
        data: { status: "REVOKED" },
      });
    } else {
      const revoked = await tx.enrollment.updateMany({
        where: {
          enrollmentId: intent.enrollmentId,
          status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
        },
        data: {
          status: "REVOKED",
          paymentExpiresAt: null,
        },
      });

      await tx.enrollmentPackage.updateMany({
        where: {
          enrollmentId: intent.enrollmentId,
          status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
        },
        data: { status: "REVOKED" },
      });

      if (revoked.count > 0) {
        const currentEnrollment = await tx.enrollment.findUnique({
          where: { enrollmentId: intent.enrollmentId },
          select: { classId: true, class: { select: { enrolledCount: true } } },
        });
        if (currentEnrollment) {
          await tx.class.update({
            where: { classId: currentEnrollment.classId },
            data: {
              enrolledCount: Math.max(
                0,
                currentEnrollment.class.enrolledCount - revoked.count,
              ),
            },
          });
        }
      }
    }

    await tx.adjustment.create({
      data: {
        settlementRunId: run!.settlementRunId,
        tutorUserId: enrollment.class.tutorUserId,
        amountMinor: -amountMinor,
        reason,
        status: "PENDING",
        createdBy: "payment-webhook",
      },
    });
  });

  return intent;
}

async function estimatePaidCommissionMinor(
  intent: { amountMinor: bigint },
  tutorUserId: string,
  paidPeriodMonth: string,
) {
  const settledRun = await prisma.settlementRun.findFirst({
    where: { periodMonth: paidPeriodMonth, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
  });

  if (settledRun) {
    const payoutLine = await prisma.payoutLine.findFirst({
      where: {
        settlementRunId: settledRun.settlementRunId,
        tutorUserId,
      },
      select: { payoutAmountMinor: true, grossVolumeMinor: true },
    });

    if (payoutLine && payoutLine.grossVolumeMinor > 0n) {
      return (payoutLine.payoutAmountMinor * intent.amountMinor) /
        payoutLine.grossVolumeMinor;
    }
  }

  // Before the period is settled there is no paid payout line to reference.
  // Use the standalone commission for this charge as a conservative estimate;
  // importantly, never claw back the student's full class price.
  const rate = calculateCommissionInfo(Number(intent.amountMinor) / 100).rate;
  return calculatePayoutMinor(intent.amountMinor, rate);
}

function verifyWebhookSignature(req: Request, payload: unknown) {
  const secret = process.env.OMISE_WEBHOOK_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!secret) {
    logger.error("CRITICAL: Webhook secret is not configured");
    return false;
  }

  const signature = req.headers["omise-signature"] || req.headers["x-omise-signature"];
  const timestamp = req.headers["omise-signature-timestamp"];
  if (!signature || Array.isArray(signature) || !timestamp || Array.isArray(timestamp)) {
    return false;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(payload);
  const expected = crypto
    .createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${timestamp}.${rawBody}`)
    .digest();

  return signature.split(",").some((candidate) => {
    const normalizedSignature = candidate.trim().replace(/^sha256=/, "");
    const signatureBuffer = Buffer.from(normalizedSignature, "hex");
    return (
      signatureBuffer.length === expected.length &&
      crypto.timingSafeEqual(signatureBuffer, expected)
    );
  });
}

function serializePaymentIntent(intent: {
  paymentIntentId: string;
  enrollmentId: string;
  enrollmentPackageId?: string | null;
  studentUserId: string;
  amountMinor: bigint;
  currency: string;
  method: string;
  status: string;
  idempotencyKey: string | null;
  providerRef: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...intent,
    amountMinor: Number(intent.amountMinor),
  };
}

function isTerminalChargeStatus(status: string) {
  return ["failed", "expired", "reversed"].includes(status);
}

async function buildCheckoutDetails(providerRef?: string | null) {
  if (!providerRef) return null;

  try {
    const charge = await retrieveOmiseCharge(providerRef);
    return buildCheckoutDetailsFromCharge(charge);
  } catch (error) {
    logger.error("Could not retrieve Omise checkout details:", error);
    return { providerRef };
  }
}

function buildCheckoutDetailsFromCharge(charge: {
  id: string;
  status: string;
  paid?: boolean;
  authorize_uri?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  source?: {
    scannable_code?: {
      image?: {
        download_uri?: string;
      };
    };
  } | null;
}) {
  return {
    provider: "omise",
    chargeId: charge.id,
    status: charge.status,
    paid: Boolean(charge.paid),
    authorizeUri: charge.authorize_uri || null,
    qrCodeUrl: charge.source?.scannable_code?.image?.download_uri || null,
    failureCode: charge.failure_code || null,
    failureMessage: charge.failure_message || null,
  };
}

function buildReturnUri(returnUri: unknown, paymentIntentId: string) {
  const defaultStudentAppBaseUrl = process.env.NODE_ENV === "production"
    ? "https://student-liff-1090865515742.asia-southeast1.run.app"
    : "https://resource-pushpin-tabby.ngrok-free.dev";
  const fallbackBase =
    process.env.STUDENT_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    defaultStudentAppBaseUrl;
  const fallback = `${fallbackBase.replace(/\/$/, "")}/payment`;
  const candidate = typeof returnUri === "string" && returnUri ? returnUri : fallback;

  try {
    const url = new URL(candidate);
    url.searchParams.set("paymentIntentId", paymentIntentId);
    url.searchParams.set("paymentReturn", "omise");
    return url.toString();
  } catch {
    return `${fallback}?paymentIntentId=${encodeURIComponent(paymentIntentId)}&paymentReturn=omise`;
  }
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim();
  }
  return req.ip;
}

export async function getPaymentGuardianGate(userId: string) {
  const student = await prisma.user.findUnique({
    where: { userId },
    select: { dateOfBirth: true },
  });
  if (!student?.dateOfBirth) {
    return {
      status: 400,
      code: "DATE_OF_BIRTH_REQUIRED",
      message: "Date of birth is required before payment",
    } as const;
  }
  if (!isUnderGuardianAge(student.dateOfBirth)) return null;

  const guardianConsent = await prisma.userConsent.findFirst({
    where: {
      userId,
      consentType: GUARDIAN_CONSENT_TYPE,
      status: CONSENT_STATUS_GRANTED,
    },
  });
  if (guardianConsent) return null;

  return {
    status: 403,
    code: "GUARDIAN_CONSENT_REQUIRED",
    message: "Guardian consent is required before payment",
  } as const;
}

function getFollowingIctPeriodMonth(periodMonth: string) {
  const [yearText, monthText] = periodMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextPeriod = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  getIctMonthWindow(nextPeriod);
  return nextPeriod;
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
        paidAt: payment.paidAt,
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

  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Payment History Error:", error);
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

