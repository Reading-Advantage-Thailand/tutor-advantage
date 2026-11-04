import { Request, Response } from "express";
import { isValidInternalKey, logger } from "@tutor-advantage/shared-config";
import {
  DEFAULT_LEAD_MINUTES,
  sendBookPaymentReminders,
  sendClassSessionReminders,
} from "../services/ReminderService";

function rejectInvalidKey(req: Request, res: Response) {
  if (isValidInternalKey(req.headers["x-internal-key"], process.env.INTERNAL_API_KEY)) return false;
  res.status(401).json({
    error: { code: "UNAUTHORIZED", message: "Invalid internal key" },
  });
  return true;
}

/**
 * POST /v1/internal/reminders/class-sessions
 * Called by Google Cloud Scheduler every 5 minutes.
 * Protected by X-Internal-Key header (shared secret), NOT JWT.
 */
export async function runClassSessionReminders(req: Request, res: Response) {
  if (rejectInvalidKey(req, res)) return;

  const rawLead = Number((req.body as { leadMinutes?: unknown } | undefined)?.leadMinutes ?? DEFAULT_LEAD_MINUTES);
  const leadMinutes = Number.isInteger(rawLead) && rawLead >= 5 && rawLead <= 120 ? rawLead : DEFAULT_LEAD_MINUTES;

  try {
    const summary = await sendClassSessionReminders({ leadMinutes });
    return res.status(200).json({ leadMinutes, ...summary });
  } catch (error_err) {
    const error = error_err as Error;
    logger.error("[ReminderService] Class session reminders failed:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Class session reminders failed",
        details: error.message,
      },
    });
  }
}

/**
 * POST /v1/internal/reminders/book-payments
 * Called by Google Cloud Scheduler daily at 10:00 ICT.
 * Protected by X-Internal-Key header (shared secret), NOT JWT.
 *
 * Answers 503 when any delivery failed so Cloud Scheduler's retryConfig runs
 * it again the same day, while LINE still remembers each push's retry key
 * (24 hours). The next daily run would be too late for that.
 */
export async function runBookPaymentReminders(req: Request, res: Response) {
  if (rejectInvalidKey(req, res)) return;

  try {
    const summary = await sendBookPaymentReminders();
    if (summary.failed > 0) {
      return res.status(503).json({
        error: {
          code: "REMINDER_DELIVERIES_FAILED",
          message: "Some book payment reminders failed; retry the run",
        },
        ...summary,
      });
    }
    return res.status(200).json(summary);
  } catch (error_err) {
    const error = error_err as Error;
    logger.error("[ReminderService] Book payment reminders failed:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Book payment reminders failed",
        details: error.message,
      },
    });
  }
}
