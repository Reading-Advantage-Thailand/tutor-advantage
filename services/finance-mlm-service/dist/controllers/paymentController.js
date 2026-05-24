"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentIntent = createPaymentIntent;
exports.getPaymentConfig = getPaymentConfig;
exports.getPaymentStatus = getPaymentStatus;
exports.getPromptPayQrCode = getPromptPayQrCode;
exports.confirmMockPayment = confirmMockPayment;
exports.handleWebhook = handleWebhook;
exports.getPaymentHistory = getPaymentHistory;
const database_1 = require("@tutor-advantage/database");
const crypto_1 = __importDefault(require("crypto"));
const taxService_1 = require("../services/taxService");
const commissionService_1 = require("../services/commissionService");
const omiseService_1 = require("../services/omiseService");
async function createPaymentIntent(req, res) {
    try {
        const userId = req.user?.userId;
        const { enrollmentId, amountSatang, method = "promptpay", omiseToken, returnUri, } = req.body;
        const idempotencyKey = req.body.idempotencyKey ||
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
        const enrollment = await database_1.prisma.enrollment.findUnique({
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
        const student = await database_1.prisma.user.findUnique({
            where: { userId },
            select: { dateOfBirth: true },
        });
        if (student?.dateOfBirth && isUnderage(student.dateOfBirth)) {
            const guardianConsent = await database_1.prisma.userConsent.findFirst({
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
        if (!(0, omiseService_1.isOmiseConfigured)()) {
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
            const existingByKey = await database_1.prisma.paymentIntent.findUnique({
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
        const existingIntent = await database_1.prisma.paymentIntent.findFirst({
            where: {
                enrollmentId,
                studentUserId: userId,
                method,
                status: "PENDING",
            },
            orderBy: { createdAt: "desc" },
        });
        if (existingIntent?.providerRef) {
            const checkout = await buildCheckoutDetails(existingIntent.providerRef);
            return res.status(200).json({
                message: "Existing pending payment intent returned",
                intent: serializePaymentIntent(existingIntent),
                checkout,
            });
        }
        const intent = existingIntent ||
            (await database_1.prisma.paymentIntent.create({
                data: {
                    enrollmentId,
                    studentUserId: userId,
                    amountMinor: BigInt(amountSatang), // using BigInt as specified in schema
                    currency: "THB",
                    method,
                    status: "PENDING",
                    idempotencyKey: idempotencyKey || undefined,
                },
            }));
        const charge = await (0, omiseService_1.createOmiseCharge)({
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
        const updatedIntent = await database_1.prisma.paymentIntent.update({
            where: { paymentIntentId: intent.paymentIntentId },
            data: {
                providerRef: charge.id,
                status: charge.status === "failed" ? "FAILED" : "PENDING",
            },
        });
        await database_1.prisma.paymentEvent.create({
            data: {
                paymentIntentId: intent.paymentIntentId,
                providerEventId: `local:${charge.id}:create`,
                eventType: "omise.charge.create",
                rawPayload: charge,
                occurredAt: new Date(),
            },
        });
        const finalIntent = charge.paid
            ? await fulfillPaymentIntent(intent.paymentIntentId, charge.id)
            : charge.status === "failed"
                ? await recordNegativePaymentOutcome(intent.paymentIntentId, charge.id, "omise.charge.failed")
                : updatedIntent;
        // When returning, convert BigInt back to String/Number to keep JSON serializable
        return res.status(201).json({
            message: "Payment intent created successfully",
            intent: serializePaymentIntent(finalIntent),
            checkout: buildCheckoutDetailsFromCharge(charge),
        });
    }
    catch (error) {
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
async function getPaymentConfig(_req, res) {
    return res.status(200).json({
        provider: "omise",
        publicKey: (0, omiseService_1.getOmisePublicKey)(),
        configured: (0, omiseService_1.isOmiseConfigured)(),
    });
}
async function getPaymentStatus(req, res) {
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
        const intent = await database_1.prisma.paymentIntent.findUnique({
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
        if (intent.providerRef && intent.status === "PENDING") {
            const charge = await (0, omiseService_1.retrieveOmiseCharge)(intent.providerRef);
            checkout = buildCheckoutDetailsFromCharge(charge);
            if (charge.paid || charge.status === "successful") {
                currentIntent = await fulfillPaymentIntent(intent.paymentIntentId, charge.id);
            }
            else if (charge.status === "failed" ||
                charge.status === "expired" ||
                charge.status === "reversed") {
                currentIntent = await recordNegativePaymentOutcome(intent.paymentIntentId, charge.id, `omise.charge.${charge.status}`);
            }
        }
        return res.status(200).json({
            intent: serializePaymentIntent(currentIntent),
            checkout,
        });
    }
    catch (error) {
        console.error("Get Payment Status Error:", error);
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
async function getPromptPayQrCode(req, res) {
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
        const intent = await database_1.prisma.paymentIntent.findUnique({
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
        const charge = await (0, omiseService_1.retrieveOmiseCharge)(intent.providerRef);
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
        const dataUri = await (0, omiseService_1.downloadOmiseDocumentAsDataUri)(downloadUri);
        return res.status(200).json({
            paymentIntentId,
            chargeId: charge.id,
            dataUri,
        });
    }
    catch (error) {
        console.error("Get PromptPay QR Code Error:", error);
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
async function fulfillPaymentIntent(paymentIntentId, providerRef) {
    return database_1.prisma.$transaction(async (tx) => {
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
        await tx.paymentReceipt.upsert({
            where: { paymentIntentId },
            update: {},
            create: {
                paymentIntentId,
                studentUserId: intent.studentUserId,
                receiptNumber: (0, taxService_1.buildReceiptNumber)(paymentIntentId),
                grossAmountMinor: intent.amountMinor,
                vatAmountMinor: 0n,
                netAmountMinor: intent.amountMinor,
                currency: intent.currency,
            },
        });
        return intent;
    });
}
async function confirmMockPayment(req, res) {
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
        const intent = await database_1.prisma.paymentIntent.findUnique({
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
        await database_1.prisma.paymentEvent.create({
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
    }
    catch (error) {
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
async function handleWebhook(req, res) {
    try {
        const payload = req.body;
        if (!verifyWebhookSignature(req, payload)) {
            return res.status(401).send("Invalid webhook signature");
        }
        // Mocking an Omise-like structured event payload
        const eventType = payload.key || payload.type || "charge.complete";
        const providerRef = payload.data?.id || payload.id;
        const providerEventId = payload.id || payload.event_id || payload.data?.id;
        const paymentIntentId = payload.data?.metadata?.paymentIntentId;
        const isSuccessful = payload.data?.status === "successful" || payload.status === "successful";
        const isNegativeOutcome = eventType.includes("refund") ||
            eventType.includes("chargeback") ||
            payload.data?.status === "reversed" ||
            payload.data?.status === "failed" ||
            payload.status === "reversed" ||
            payload.status === "failed";
        if (providerEventId) {
            const existingEvent = await database_1.prisma.paymentEvent.findUnique({
                where: { providerEventId },
            });
            if (existingEvent) {
                return res.status(200).send("Webhook replay ignored");
            }
        }
        // 1. Create a durable record of the event arriving
        await database_1.prisma.paymentEvent.create({
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
        }
        else if (isNegativeOutcome) {
            await recordNegativePaymentOutcome(paymentIntentId, providerRef, eventType);
        }
        else {
            await database_1.prisma.paymentIntent.update({
                where: { paymentIntentId },
                data: {
                    status: "FAILED",
                    providerRef,
                },
            });
        }
        return res.status(200).send("Webhook processed successfully");
    }
    catch (error) {
        console.error("Payment Webhook Error:", error);
        // Return 200 even on errors for certain webhook providers to stop blast retries,
        // unless we strictly want them to retry. Returning 500 for now for visibility.
        return res.status(500).send("Webhook processing failed");
    }
}
async function recordNegativePaymentOutcome(paymentIntentId, providerRef, eventType) {
    const intent = await database_1.prisma.paymentIntent.findUnique({
        where: { paymentIntentId },
    });
    if (!intent)
        throw new Error("PAYMENT_INTENT_NOT_FOUND");
    if (intent.status !== "SUCCESS") {
        return database_1.prisma.$transaction(async (tx) => {
            const failedIntent = await tx.paymentIntent.update({
                where: { paymentIntentId },
                data: { status: "FAILED", providerRef },
            });
            const cancelled = await tx.enrollment.updateMany({
                where: {
                    enrollmentId: intent.enrollmentId,
                    status: "PENDING_PAYMENT",
                },
                data: {
                    status: "CANCELLED",
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
    const enrollment = await database_1.prisma.enrollment.findUnique({
        where: { enrollmentId: intent.enrollmentId },
        include: { class: true },
    });
    if (!enrollment)
        throw new Error("ENROLLMENT_NOT_FOUND");
    const nextPeriodMonth = getNextIctPeriodMonth();
    let run = await database_1.prisma.settlementRun.findFirst({
        where: { periodMonth: nextPeriodMonth, status: "DRAFT" },
        orderBy: { createdAt: "desc" },
    });
    if (!run) {
        run = await database_1.prisma.settlementRun.create({
            data: {
                periodMonth: nextPeriodMonth,
                status: "DRAFT",
                createdBy: "payment-webhook",
                previewPayload: {},
            },
        });
    }
    await database_1.prisma.adjustment.create({
        data: {
            settlementRunId: run.settlementRunId,
            tutorUserId: enrollment.class.tutorUserId,
            amountMinor: -intent.amountMinor,
            reason: `${eventType}:${paymentIntentId}`,
            status: "APPROVED",
            createdBy: "payment-webhook",
        },
    });
    return intent;
}
function verifyWebhookSignature(req, payload) {
    const secret = process.env.OMISE_WEBHOOK_SECRET;
    if (!secret && process.env.NODE_ENV !== "production") {
        return true;
    }
    if (!secret) {
        console.error("CRITICAL: Webhook secret is not configured");
        return false;
    }
    const signature = req.headers["omise-signature"] || req.headers["x-omise-signature"];
    const timestamp = req.headers["omise-signature-timestamp"];
    if (!signature || Array.isArray(signature) || !timestamp || Array.isArray(timestamp)) {
        return false;
    }
    const rawBody = req.rawBody || JSON.stringify(payload);
    const expected = crypto_1.default
        .createHmac("sha256", Buffer.from(secret, "base64"))
        .update(`${timestamp}.${rawBody}`)
        .digest();
    return signature.split(",").some((candidate) => {
        const normalizedSignature = candidate.trim().replace(/^sha256=/, "");
        const signatureBuffer = Buffer.from(normalizedSignature, "hex");
        return (signatureBuffer.length === expected.length &&
            crypto_1.default.timingSafeEqual(signatureBuffer, expected));
    });
}
function serializePaymentIntent(intent) {
    return {
        ...intent,
        amountMinor: Number(intent.amountMinor),
    };
}
async function buildCheckoutDetails(providerRef) {
    if (!providerRef)
        return null;
    try {
        const charge = await (0, omiseService_1.retrieveOmiseCharge)(providerRef);
        return buildCheckoutDetailsFromCharge(charge);
    }
    catch (error) {
        console.error("Could not retrieve Omise checkout details:", error);
        return { providerRef };
    }
}
function buildCheckoutDetailsFromCharge(charge) {
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
function buildReturnUri(returnUri, paymentIntentId) {
    const defaultStudentAppBaseUrl = process.env.NODE_ENV === "production"
        ? "https://student-liff-1090865515742.asia-southeast1.run.app"
        : "https://resource-pushpin-tabby.ngrok-free.dev";
    const fallbackBase = process.env.STUDENT_APP_BASE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        defaultStudentAppBaseUrl;
    const fallback = `${fallbackBase.replace(/\/$/, "")}/payment`;
    const candidate = typeof returnUri === "string" && returnUri ? returnUri : fallback;
    try {
        const url = new URL(candidate);
        url.searchParams.set("paymentIntentId", paymentIntentId);
        url.searchParams.set("paymentReturn", "omise");
        return url.toString();
    }
    catch {
        return `${fallback}?paymentIntentId=${encodeURIComponent(paymentIntentId)}&paymentReturn=omise`;
    }
}
function getClientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string") {
        return forwardedFor.split(",")[0]?.trim();
    }
    return req.ip;
}
function isUnderage(dateOfBirth) {
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
    (0, commissionService_1.getIctMonthWindow)(`${next.year}-${String(next.month).padStart(2, "0")}`);
    return `${next.year}-${String(next.month).padStart(2, "0")}`;
}
async function getPaymentHistory(req, res) {
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
        const payments = await database_1.prisma.paymentIntent.findMany({
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
        const enrollments = await database_1.prisma.enrollment.findMany({
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
        const enrollmentMap = enrollments.reduce((acc, curr) => {
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
    }
    catch (error) {
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
