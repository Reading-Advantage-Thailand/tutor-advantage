import { Request, Response } from "express";
import { isValidInternalKey, logger } from "@tutor-advantage/shared-config";
import { countOverdueAndAwaiting } from "../services/supportTicketCounts";
import { buildOverdueDigestEmbed, postTicketsChannel } from "../services/ticketNotifications";

/**
 * POST /v1/internal/tickets/overdue-digest
 * Called by Google Cloud Scheduler daily at 09:00 ICT
 * (infra/cloud-scheduler/ticket-overdue-digest-cron.yaml).
 * Protected by X-Internal-Key header (shared secret), NOT JWT.
 *
 * Posts one count-only embed to DISCORD_TICKETS_WEBHOOK_URL when any ticket is
 * past its first-response deadline. Nothing is posted when the channel is not
 * configured or nothing is overdue.
 */
export async function runTicketOverdueDigest(req: Request, res: Response) {
  if (!isValidInternalKey(req.headers["x-internal-key"], process.env.INTERNAL_API_KEY)) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid internal key" },
    });
  }

  try {
    const counts = await countOverdueAndAwaiting(new Date());
    let posted = false;
    if (counts.overdue > 0 && process.env.DISCORD_TICKETS_WEBHOOK_URL) {
      const result = await postTicketsChannel(buildOverdueDigestEmbed(counts));
      posted = result.ok;
      if (!result.ok) {
        logger.warn("[SupportTickets] Overdue digest Discord post failed", { alert: false, reason: result.reason });
      }
    }
    return res.status(200).json({ ...counts, posted });
  } catch (error_err) {
    const error = error_err as Error;
    logger.error("[SupportTickets] Overdue digest failed:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ticket overdue digest failed",
      },
    });
  }
}
