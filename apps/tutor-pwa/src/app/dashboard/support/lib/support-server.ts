import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { isValidTicketId, type SupportClassOption, type TicketDetail, type TicketSummary } from "./support";

/**
 * Server-only helpers for the support pages and `/api/support/*` GET routes.
 * Forwards the httpOnly `tutor_session` cookie as a bearer token;
 * learning-service scopes tickets to that user. Never cached (per tutor).
 */

export type SupportFetchResult<T> = { ok: true; data: T } | { ok: false; status: number };

export async function getTutorToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tutor_session")?.value || null;
}

async function learningGet<T>(path: string, token: string): Promise<SupportFetchResult<T>> {
  try {
    const res = await fetch(`${LEARNING_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch (error) {
    console.error("[support] learning-service request failed", path, error);
    return { ok: false, status: 502 };
  }
}

export async function fetchTickets(token: string): Promise<SupportFetchResult<TicketSummary[]>> {
  const result = await learningGet<{ tickets?: TicketSummary[] }>("/v1/tickets", token);
  if (!result.ok) return result;
  return { ok: true, data: result.data.tickets ?? [] };
}

/** One ticket with its thread. Note: learning-service marks it read for this tutor. */
export async function fetchTicket(token: string, ticketId: string): Promise<SupportFetchResult<TicketDetail>> {
  if (!isValidTicketId(ticketId)) return { ok: false, status: 404 };
  const result = await learningGet<{ ticket?: TicketDetail }>(`/v1/tickets/${encodeURIComponent(ticketId)}`, token);
  if (!result.ok) return result;
  if (!result.data.ticket) return { ok: false, status: 404 };
  return { ok: true, data: { ...result.data.ticket, messages: result.data.ticket.messages ?? [] } };
}

/** The tutor's classes (GET /v1/classes) for the optional "related class" select. Empty on failure. */
export async function fetchTutorClassOptions(token: string): Promise<SupportClassOption[]> {
  const result = await learningGet<{ classes?: { id?: string; name?: string; status?: string }[] }>("/v1/classes", token);
  if (!result.ok) return [];
  return (result.data.classes ?? [])
    .filter((cls): cls is { id: string; name?: string; status?: string } => isValidTicketId(cls.id))
    .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed"))
    .map((cls) => ({ value: cls.id, label: cls.name?.trim() || cls.id.slice(0, 8) }));
}
