import { hashIdentifier, logger, postDiscordEmbeds, type DiscordEmbed } from "@tutor-advantage/shared-config";
import { LineNotificationService } from "./LineNotificationService";
import {
  CATEGORY_LABELS_TH,
  formatBangkokDate,
  isTicketCategory,
  REQUESTER_ROLE_LABELS_TH,
  requesterNoticeText,
  type RequesterNotice,
} from "./supportTickets";

/*
 * Support ticket notifications. Every send is fire-and-forget: the HTTP
 * response never waits on Discord or LINE, and failures are only logged.
 *
 * Discord goes to DISCORD_TICKETS_WEBHOOK_URL only (never the shared ops
 * channel in DISCORD_WEBHOOK_URL) and carries no PII: no subject, body, names,
 * emails or ids — only the ticket number, category, role and deadline.
 */

const TICKET_EMBED_COLOR = 0x3b82f6;
const DIGEST_EMBED_COLOR = 0xf59e0b;

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function adminTicketUrl(ticketId: string): string | undefined {
  const base = process.env.ADMIN_CONSOLE_URL;
  return base ? `${trimTrailingSlash(base)}/support/tickets/${ticketId}` : undefined;
}

export function buildNewTicketEmbed(ticket: {
  ticketId: string;
  ticketNumber: number;
  category: string;
  requesterRole: string;
  dueAt: Date;
  createdAt: Date;
}): DiscordEmbed {
  const category = isTicketCategory(ticket.category) ? CATEGORY_LABELS_TH[ticket.category] : ticket.category;
  const role =
    ticket.requesterRole === "STUDENT" || ticket.requesterRole === "TUTOR"
      ? REQUESTER_ROLE_LABELS_TH[ticket.requesterRole]
      : ticket.requesterRole;
  const embed: DiscordEmbed = {
    title: `คำร้องใหม่ #${ticket.ticketNumber}`,
    color: TICKET_EMBED_COLOR,
    fields: [
      { name: "หมวดหมู่", value: category, inline: true },
      { name: "ผู้แจ้ง", value: role, inline: true },
      { name: "ตอบกลับภายใน", value: formatBangkokDate(ticket.dueAt), inline: true },
    ],
    timestamp: ticket.createdAt.toISOString(),
  };
  const url = adminTicketUrl(ticket.ticketId);
  if (url) embed.url = url;
  return embed;
}

export function buildOverdueDigestEmbed(counts: { overdue: number; awaitingSupport: number }): DiscordEmbed {
  const embed: DiscordEmbed = {
    title: `คำร้องเกินกำหนดตอบกลับ ${counts.overdue} รายการ`,
    color: DIGEST_EMBED_COLOR,
    fields: [
      { name: "เกินกำหนด", value: String(counts.overdue), inline: true },
      { name: "รอทีมงาน", value: String(counts.awaitingSupport), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };
  const base = process.env.ADMIN_CONSOLE_URL;
  if (base) embed.url = `${trimTrailingSlash(base)}/support/tickets?overdue=true`;
  return embed;
}

/** Posts to the tickets channel; NOT_CONFIGURED when DISCORD_TICKETS_WEBHOOK_URL is unset. */
export async function postTicketsChannel(embed: DiscordEmbed) {
  const webhookUrl = process.env.DISCORD_TICKETS_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false as const, reason: "NOT_CONFIGURED" as const };
  return postDiscordEmbeds([embed], { webhookUrl });
}

export function notifyNewTicket(ticket: Parameters<typeof buildNewTicketEmbed>[0]): void {
  if (!process.env.DISCORD_TICKETS_WEBHOOK_URL) return;
  void postTicketsChannel(buildNewTicketEmbed(ticket))
    .then((result) => {
      if (!result.ok) {
        logger.warn("[SupportTickets] New-ticket Discord post failed", {
          alert: false,
          reason: result.reason,
          ticketNumber: ticket.ticketNumber,
        });
      }
    })
    .catch((error) => {
      logger.warn("[SupportTickets] New-ticket Discord post failed", { alert: false, error: String(error) });
    });
}

export function requesterTicketLink(role: string, ticketId: string): string {
  if (role === "STUDENT") return LineNotificationService.buildLiffDeepLink(`/support/${ticketId}`);
  const base = process.env.TUTOR_PWA_URL;
  return role === "TUTOR" && base ? `${trimTrailingSlash(base)}/dashboard/support/${ticketId}` : "";
}

export function notifyRequester(
  ticket: { ticketId: string; ticketNumber: number; requesterUserId: string; requesterRole: string },
  notice: RequesterNotice,
): void {
  const text = requesterNoticeText(notice, ticket.ticketNumber, requesterTicketLink(ticket.requesterRole, ticket.ticketId));
  void LineNotificationService.sendTextToUserWithResult(ticket.requesterUserId, text, { type: "notifyLineMessages" })
    .then((result) => {
      if (!result.sent) {
        logger.info("[SupportTickets] Requester LINE notice not sent", {
          reason: result.reason,
          user: hashIdentifier(ticket.requesterUserId),
          ticketNumber: ticket.ticketNumber,
        });
      }
    })
    .catch((error) => {
      logger.warn("[SupportTickets] Requester LINE notice failed", {
        alert: false,
        user: hashIdentifier(ticket.requesterUserId),
        error: String(error),
      });
    });
}
