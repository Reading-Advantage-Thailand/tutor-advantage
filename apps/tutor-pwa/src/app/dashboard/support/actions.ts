"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LEARNING_URL } from "@/lib/service-urls";
import { isValidTicketId, type CreateTicketRequest, type TicketDetail } from "./lib/support";

/**
 * Support ticket mutations. They return `{ ok, code }` instead of throwing so
 * the UI can show the server's reason (thrown messages are hidden in
 * production). `code` is learning-service's `error.code`, or
 * SUPPORT_REQUEST_FAILED for a network failure / non-JSON error.
 */

export type TicketActionResult = { ok: true; ticket: TicketDetail } | { ok: false; code: string };

const FALLBACK_CODE = "SUPPORT_REQUEST_FAILED";

async function postToLearning(path: string, body: unknown, label: string): Promise<TicketActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return { ok: false, code: "UNAUTHORIZED" };

  try {
    const res = await fetch(`${LEARNING_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { ticket?: TicketDetail; error?: { code?: string } } | null;
    if (!res.ok) return { ok: false, code: data?.error?.code || FALLBACK_CODE };
    if (!data?.ticket) return { ok: false, code: FALLBACK_CODE };
    return { ok: true, ticket: { ...data.ticket, messages: data.ticket.messages ?? [] } };
  } catch (error) {
    console.error(`[${label}] request failed:`, error);
    return { ok: false, code: FALLBACK_CODE };
  }
}

function revalidateSupport(ticketId?: string) {
  revalidatePath("/dashboard/support");
  if (ticketId) revalidatePath(`/dashboard/support/${ticketId}`);
}

/** POST /v1/tickets. Replays with the same idempotencyKey return the existing ticket. */
export async function createTicket(request: CreateTicketRequest): Promise<TicketActionResult> {
  const result = await postToLearning("/v1/tickets", request, "createTicket");
  if (result.ok) revalidateSupport(result.ticket.ticketId);
  return result;
}

/** POST /v1/tickets/:id/messages. Replays with the same clientMessageId are no-ops. */
export async function replyToTicket(ticketId: string, body: string, clientMessageId: string): Promise<TicketActionResult> {
  if (!isValidTicketId(ticketId)) return { ok: false, code: "TICKET_NOT_FOUND" };
  const result = await postToLearning(
    `/v1/tickets/${encodeURIComponent(ticketId)}/messages`,
    { body, clientMessageId },
    "replyToTicket",
  );
  if (result.ok) revalidateSupport(ticketId);
  return result;
}

/** POST /v1/tickets/:id/resolve ("ปิดคำร้อง"). Already resolved → unchanged ticket. */
export async function resolveTicket(ticketId: string): Promise<TicketActionResult> {
  if (!isValidTicketId(ticketId)) return { ok: false, code: "TICKET_NOT_FOUND" };
  const result = await postToLearning(`/v1/tickets/${encodeURIComponent(ticketId)}/resolve`, {}, "resolveTicket");
  if (result.ok) revalidateSupport(ticketId);
  return result;
}
