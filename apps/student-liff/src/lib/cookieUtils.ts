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
 * Wait for the server-side session to become available without reading the
 * HttpOnly cookie in browser JavaScript.
 */
export async function waitForSession(
  maxRetries = 10,
  intervalMs = 500,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({})) as { authenticated?: boolean };
        if (data.authenticated) return true;
      }
    } catch {
      // The auth exchange may still be completing; retry below.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
