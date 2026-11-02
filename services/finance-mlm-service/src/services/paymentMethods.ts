/** Methods paid through an Omise charge: their providerRef is an Omise charge id. */
export const OMISE_PAYMENT_METHODS = ["promptpay", "card"] as const;

/**
 * 0 THB payment made with an admin-issued class discount code. There is no
 * Omise charge; providerRef is "discount:<redemptionId>".
 */
export const DISCOUNT_CODE_METHOD = "DISCOUNT_CODE";

/**
 * True when the intent's providerRef can be looked up at Omise. Every code path
 * that calls Omise with a stored providerRef must check this first, so a
 * discount (or other non-Omise) payment never triggers an Omise request.
 * Legacy rows use upper-case methods ("PROMPTPAY"), so compare case-insensitively.
 */
export function isOmiseIntent(intent: { method?: string | null }) {
  const method = (intent.method ?? "").trim().toLowerCase();
  return (OMISE_PAYMENT_METHODS as readonly string[]).includes(method);
}
