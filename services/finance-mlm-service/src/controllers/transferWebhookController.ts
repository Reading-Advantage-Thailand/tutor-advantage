import { logger } from "@tutor-advantage/shared-config";
import crypto from "crypto";
import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";

/**
 * POST /v1/webhooks/omise-transfer
 *
 * Receives Omise transfer lifecycle events and syncs transfer status to
 * payout_documents. Supported event keys:
 *   - transfer.create  → CREATED
 *   - transfer.send    → SENT
 *   - transfer.pay     → PAID
 *   - transfer.fail    → TRANSFER_FAILED
 */

const TRANSFER_KEY_MAP: Record<string, string> = {
  "transfer.create": "CREATED",
  "transfer.send":   "SENT",
  "transfer.pay":    "PAID",
  "transfer.fail":   "TRANSFER_FAILED",
};

function verifySignature(req: Request, payload: unknown): boolean {
  const secret = process.env.OMISE_WEBHOOK_SECRET;
  // In non-production, allow unsigned webhooks for local testing
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) {
    logger.error("[TransferWebhook] OMISE_WEBHOOK_SECRET not configured");
    return false;
  }

  const signature = req.headers["omise-signature"] || req.headers["x-omise-signature"];
  const timestamp  = req.headers["omise-signature-timestamp"];
  if (!signature || Array.isArray(signature) || !timestamp || Array.isArray(timestamp)) {
    return false;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(payload);
  const expected = crypto
    .createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${timestamp}.${rawBody}`)
    .digest();

  return signature.split(",").some((candidate) => {
    const hex = candidate.trim().replace(/^sha256=/, "");
    const buf = Buffer.from(hex, "hex");
    return buf.length === expected.length && crypto.timingSafeEqual(buf, expected);
  });
}

export async function handleTransferWebhook(req: Request, res: Response) {
  try {
    const payload = req.body as any;

    if (!verifySignature(req, payload)) {
      return res.status(401).send("Invalid webhook signature");
    }

    const eventKey     = payload.key as string | undefined;
    const eventId      = payload.id  as string | undefined;
    const transferData = payload.data as any;
    const transferId   = transferData?.id as string | undefined;

    if (!eventKey || !transferId) {
      return res.status(200).send("Missing key or transfer id — ignored");
    }

    const mappedStatus = TRANSFER_KEY_MAP[eventKey];
    if (!mappedStatus) {
      // Not a transfer event we care about; ack to stop retries
      return res.status(200).send(`Event '${eventKey}' not handled`);
    }

    // Idempotency — skip if already in a final state
    const existing = await prisma.$queryRaw<Array<{ transfer_status: string }>>`
      SELECT "transfer_status"
      FROM "finance_mlm"."payout_documents"
      WHERE "provider_transfer_id" = ${transferId}
      LIMIT 1
    `;

    if (existing.length === 0) {
      logger.warn(`[TransferWebhook] No payout_document found for transfer ${transferId}`);
      return res.status(200).send("Transfer not tracked — ignored");
    }

    const currentStatus = existing[0].transfer_status;
    const FINAL_STATUSES = ["PAID", "TRANSFER_FAILED"];
    if (FINAL_STATUSES.includes(currentStatus) && mappedStatus !== "PAID") {
      // Don't overwrite a final state with an earlier one
      return res.status(200).send("Already in final state — skipped");
    }

    const failureCode    = transferData?.failure_code    ?? null;
    const failureMessage = transferData?.failure_message ?? null;
    const paidAt         = transferData?.paid_at   ? new Date(transferData.paid_at)  : null;
    const sentAt         = transferData?.sent_at   ? new Date(transferData.sent_at)  : null;
    const transferredAt  = paidAt ?? sentAt ?? null;

    await prisma.$executeRaw`
      UPDATE "finance_mlm"."payout_documents"
      SET
        "transfer_status"          = ${mappedStatus},
        "transfer_failure_code"    = ${failureCode},
        "transfer_failure_message" = ${failureMessage},
        "transferred_at"           = ${transferredAt}
      WHERE "provider_transfer_id" = ${transferId}
    `;

    logger.info(`[TransferWebhook] ${eventKey} → ${mappedStatus} for transfer ${transferId} (event ${eventId})`);

    return res.status(200).send("OK");
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("[TransferWebhook] Error:", error);
    return res.status(500).send("Webhook processing failed");
  }
}
