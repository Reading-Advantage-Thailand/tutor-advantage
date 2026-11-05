import { Request, Response } from "express";
import { isValidInternalKey, logger, postDiscordEmbeds } from "@tutor-advantage/shared-config";
import { buildMonitoringEmbed, type MonitoringNotification } from "../services/monitoringAlert";

export const MONITORING_BASIC_AUTH_USER = "monitoring";

/** Parses `Authorization: Basic base64(user:password)`; null when malformed. */
export function parseBasicAuth(header: string | string[] | undefined): { user: string; password: string } | null {
  if (typeof header !== "string") return null;
  const match = /^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i.exec(header);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  return { user: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}

/**
 * POST /v1/internal/alerts/monitoring
 * Cloud Monitoring "webhook_basicauth" notification channel → Discord.
 * HTTP Basic auth: user "monitoring", password = INTERNAL_API_KEY. No JWT.
 *
 * Once authenticated it always answers 200, even when Discord is down:
 * a non-2xx makes Monitoring retry and repost the same incident.
 */
export async function relayMonitoringAlert(req: Request, res: Response) {
  const creds = parseBasicAuth(req.headers.authorization);
  // Evaluate both checks so a wrong user and a wrong password look the same.
  const passwordOk = isValidInternalKey(creds?.password, process.env.INTERNAL_API_KEY);
  if (!creds || creds.user !== MONITORING_BASIC_AUTH_USER || !passwordOk) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid monitoring credentials" },
    });
  }

  const payload = req.body as MonitoringNotification | undefined;
  const incidentId = payload?.incident?.incident_id;
  try {
    const embed = buildMonitoringEmbed(payload);
    if (!embed) {
      logger.warn("[MonitoringRelay] Payload has no incident; nothing forwarded", { alert: false });
      return res.status(200).json({ forwarded: false, reason: "NO_INCIDENT" });
    }

    const result = await postDiscordEmbeds([embed]);
    if (!result.ok) {
      // alert:false keeps the app-error Discord transport from echoing this.
      logger.warn("[MonitoringRelay] Discord delivery failed", {
        alert: false,
        reason: result.reason,
        status: result.status,
        incidentId,
      });
      return res.status(200).json({ forwarded: false, reason: result.reason ?? "HTTP_ERROR" });
    }

    logger.info("[MonitoringRelay] Alert forwarded to Discord", { incidentId, state: payload?.incident?.state });
    return res.status(200).json({ forwarded: true });
  } catch (error_err) {
    logger.warn("[MonitoringRelay] Relay failed", { alert: false, incidentId, error: (error_err as Error).message });
    return res.status(200).json({ forwarded: false, reason: "RELAY_ERROR" });
  }
}
