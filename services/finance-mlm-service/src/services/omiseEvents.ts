/**
 * Maps an Omise webhook event to the charge it concerns.
 *
 * Charge events (`charge.complete`, …) carry the charge itself in `data`.
 * Refund and dispute events (`refund.create`, `dispute.create`, …) carry a
 * refund or dispute object whose `charge` field points at the charge; those
 * objects have no paymentIntentId metadata of their own.
 */
export type OmiseEventKind = "charge" | "refund" | "chargeback";

export interface ClassifiedOmiseEvent {
  eventType: string;
  kind: OmiseEventKind;
  /** The charge the event is about (null when the payload names none). */
  chargeId: string | null;
  /** paymentIntentId from the payload metadata, if the object carries it. */
  metadataPaymentIntentId: string | null;
  /** Dispute status from the payload (open, pending, won, lost, closed). */
  disputeStatus: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function refId(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  if (value && typeof value === "object") return asString((value as { id?: unknown }).id);
  return null;
}

export function classifyOmiseEvent(payload: unknown): ClassifiedOmiseEvent {
  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, any>;
  const eventType = asString(body.key) ?? asString(body.type) ?? "charge.complete";
  const object = asString(data.object);
  const metadataPaymentIntentId = asString(data.metadata?.paymentIntentId);

  if (object === "refund" || object === "dispute") {
    return {
      eventType,
      kind: object === "refund" ? "refund" : "chargeback",
      chargeId: refId(data.charge),
      metadataPaymentIntentId,
      disputeStatus: object === "dispute" ? asString(data.status) : null,
    };
  }

  // Older/simplified payloads name the outcome in the event type and send the
  // charge itself (e.g. `charge.refunded`).
  const lowered = eventType.toLowerCase();
  const kind: OmiseEventKind =
    lowered.includes("chargeback") || lowered.startsWith("dispute.")
      ? "chargeback"
      : lowered.includes("refund")
        ? "refund"
        : "charge";

  return {
    eventType,
    kind,
    chargeId: refId(data.id),
    metadataPaymentIntentId,
    disputeStatus: null,
  };
}

/** A lost/open dispute takes the money back; a won one returns it. */
export function disputeTakesFunds(status: string | null | undefined): boolean {
  return !status || !["won", "closed"].includes(status.toLowerCase());
}

/**
 * Whether the verified charge has been refunded in full. A missing
 * `refunded_amount` (older payloads) counts as a full refund.
 */
export function refundState(charge: { amount: number; refunded_amount?: number | null }):
  "full" | "partial" | "none" {
  const refunded = charge.refunded_amount;
  if (typeof refunded !== "number") return "full";
  if (refunded <= 0) return "none";
  return refunded >= charge.amount ? "full" : "partial";
}
