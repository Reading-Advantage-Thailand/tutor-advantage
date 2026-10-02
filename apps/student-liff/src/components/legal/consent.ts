/**
 * PDPA consent submission used by the consent gate. Pure (no "@/…" imports,
 * fetch is injectable) so vitest can load it.
 */

/** The consent the root layout checks (userConsents → TERMS_AND_PRIVACY / ACCEPTED). */
export const TERMS_CONSENT_TYPE = "TERMS_AND_PRIVACY";

/** "ok" → refresh the layout · "failed" → the server said no · "network" → request never completed. */
export type ConsentSubmitResult = "ok" | "failed" | "network";

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok">>;

/** POST /api/auth/consent { consentType: "TERMS_AND_PRIVACY" } (unchanged request). */
export async function postTermsConsent(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<ConsentSubmitResult> {
  try {
    const res = await fetchImpl("/api/auth/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentType: TERMS_CONSENT_TYPE }),
    });
    return res.ok ? "ok" : "failed";
  } catch {
    return "network";
  }
}
