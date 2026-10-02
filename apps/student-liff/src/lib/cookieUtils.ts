/**
 * Simple cookie utility for client-side usage
 */

interface CookieOptions {
  expires?: number; // Days
  path?: string;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

export const Cookies = {
  set(name: string, value: string, options: CookieOptions = {}) {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.expires) {
      const date = new Date();
      date.setTime(date.getTime() + options.expires * 24 * 60 * 60 * 1000);
      cookieString += `; expires=${date.toUTCString()}`;
    }

    cookieString += `; path=${options.path || "/"}`;

    if (options.secure || window.location.protocol === "https:") {
      cookieString += "; secure";
    }

    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    } else {
      cookieString += "; samesite=Lax";
    }

    document.cookie = cookieString;
  },

  get(name: string): string | null {
    const nameEQ = encodeURIComponent(name) + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
  },

  remove(name: string, path: string = "/") {
    this.set(name, "", { expires: -1, path });
  },
};

/**
 * How long a confirmed session is trusted without asking the server again.
 * An expired session still surfaces as a 401 from the real API call.
 */
export const SESSION_CONFIRMATION_TTL_MS = 5 * 60_000;

// Page-lifetime memory of the last confirmed session. Module state is per page
// load, so a full reload (or a different student) always starts unconfirmed.
let confirmedUntil = 0;
// Bumped by resetSessionProbe() so a probe that started before a logout can
// never mark the next session as confirmed.
let probeGeneration = 0;
let inflightProbe: Promise<boolean> | null = null;

/**
 * Record that the student-session cookie is known to be valid (for example
 * right after POST /api/auth/line succeeded). waitForSession() then resolves
 * immediately for `ttlMs`.
 */
export function markSessionReady(ttlMs: number = SESSION_CONFIRMATION_TTL_MS): void {
  confirmedUntil = Date.now() + ttlMs;
}

/**
 * Forget any confirmed session and abandon in-flight probes. Call on logout,
 * account switch, or when an API call proves the session is gone (401).
 */
export function resetSessionProbe(): void {
  confirmedUntil = 0;
  probeGeneration += 1;
  inflightProbe = null;
}

/** True while a confirmed session is still inside its TTL. */
export function isSessionConfirmed(): boolean {
  return Date.now() < confirmedUntil;
}

async function probeSession(
  maxRetries: number,
  intervalMs: number,
  generation: number,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    // The auth exchange may have finished (markSessionReady) while we waited.
    if (generation === probeGeneration && isSessionConfirmed()) return true;
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({})) as { authenticated?: boolean };
        if (data.authenticated) {
          if (generation === probeGeneration) markSessionReady();
          return true;
        }
      }
    } catch {
      // The auth exchange may still be completing; retry below.
    }
    if (i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

/**
 * Wait for the server-side session to become available without reading the
 * HttpOnly cookie in browser JavaScript.
 *
 * A confirmed session is remembered for SESSION_CONFIRMATION_TTL_MS, so after
 * the first success (or markSessionReady()) this resolves `true` without a
 * network round trip. Concurrent callers share one in-flight probe.
 * Negative results are never cached.
 */
export async function waitForSession(
  maxRetries = 10,
  intervalMs = 500,
): Promise<boolean> {
  if (isSessionConfirmed()) return true;
  if (inflightProbe) return inflightProbe;

  const probe = probeSession(maxRetries, intervalMs, probeGeneration).finally(() => {
    if (inflightProbe === probe) inflightProbe = null;
  });
  inflightProbe = probe;
  return probe;
}
