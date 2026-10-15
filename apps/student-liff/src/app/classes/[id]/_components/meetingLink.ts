// Pure (no "@/…" imports): the root vitest config maps "@" to another app.

/** Only http(s) links are opened; anything else the tutor typed is ignored. */
export function safeMeetingUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
