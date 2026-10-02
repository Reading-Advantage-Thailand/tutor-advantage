/**
 * Omise.js loader, card tokenization and the 3DS redirect.
 *
 * Card data only passes through memory: it goes straight from the form state
 * into Omise.createToken() and is never stored, logged or put in a URL.
 */

// Relative imports: the root vitest config maps "@" to another app.
import { buildOmiseCardPayload, PaymentFlowError, type CardFields } from "../../../lib/paymentFlow";

declare global {
  interface Window {
    Omise?: {
      setPublicKey: (key: string) => void;
      createToken: (
        type: "card",
        payload: Record<string, string | number>,
        callback: (statusCode: number, response: { id?: string; message?: string }) => void,
      ) => void;
    };
  }
}

export const OMISE_SCRIPT_SRC = "https://cdn.omise.co/omise.js";

/** GET /payments/config */
export type PaymentGatewayConfig = {
  configured?: boolean;
  publicKey?: string | null;
};

let scriptPromise: Promise<void> | null = null;

/**
 * Loads omise.js once (shared by the card-form prefetch and the pay tap).
 * A failed load removes its <script> so the next call can try again instead of
 * waiting forever on a dead tag.
 */
export function loadOmiseScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new PaymentFlowError("card-script"));
  if (window.Omise) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const promise = new Promise<void>((resolve, reject) => {
    const fail = (script: HTMLScriptElement | null) => {
      script?.remove();
      reject(new PaymentFlowError("card-script"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src='${OMISE_SCRIPT_SRC}']`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => fail(existing), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = OMISE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => fail(script);
    document.head.appendChild(script);
  });

  scriptPromise = promise;
  promise.catch(() => {
    if (scriptPromise === promise) scriptPromise = null;
  });
  return promise;
}

/** Omise.setPublicKey + Omise.createToken("card", …) → the token id. */
export function createOmiseCardToken(publicKey: string, card: CardFields): Promise<string> {
  const omise = typeof window === "undefined" ? undefined : window.Omise;
  if (!omise) return Promise.reject(new PaymentFlowError("card-script"));

  omise.setPublicKey(publicKey);
  return new Promise<string>((resolve, reject) => {
    omise.createToken("card", buildOmiseCardPayload(card), (statusCode, response) => {
      if (statusCode === 200 && response.id) {
        resolve(response.id);
        return;
      }
      reject(new PaymentFlowError("card-token", response.message ?? null));
    });
  });
}

/** Full-page navigation to the bank's 3DS page (external, so not router.push). */
export function redirectToAuthorizeUri(authorizeUri: string): void {
  window.location.href = authorizeUri;
}
