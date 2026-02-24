import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

export async function createPaymentIntent(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { enrollmentId, amountSatang } = req.body;

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

    const intent = await prisma.paymentIntent.create({
      data: {
        enrollmentId,
        studentUserId: userId,
        amountMinor: BigInt(amountSatang), // using BigInt as specified in schema
        currency: "THB",
        method: "PROMPTPAY", // Default method for now
        status: "PENDING",
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

export async function handleWebhook(req: Request, res: Response) {
  try {
    const payload = req.body as any;

    // In a real Omise/Stripe implementation, we verify headers
    // const signature = req.headers['omise-signature'];
    // verifySignature(payload, signature);

    // Mocking an Omise-like structured event payload
    const eventType = payload.key || payload.type || "charge.complete";
    const providerRef = payload.data?.id || payload.id;
    const paymentIntentId = payload.data?.metadata?.paymentIntentId;
    const isSuccessful =
      payload.data?.status === "successful" || payload.status === "successful";

    // 1. Create a durable record of the event arriving
    await prisma.paymentEvent.create({
      data: {
        paymentIntentId: paymentIntentId || null,
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
      await prisma.$transaction(async (tx) => {
        const intent = await tx.paymentIntent.update({
          where: { paymentIntentId },
          data: {
            status: "SUCCESS",
            providerRef,
          },
        });

        // Cross-domain Activation: Update Learning Enrollment to ACTIVE
        await tx.enrollment.update({
          where: { enrollmentId: intent.enrollmentId },
          data: {
            status: "ACTIVE",
            paymentTransactionId: providerRef,
          },
        });
      });
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
