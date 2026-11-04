import { createHash, timingSafeEqual } from "crypto";

/**
 * Checks the X-Internal-Key shared secret that Cloud Scheduler sends to
 * /v1/internal/* routes. Both sides are hashed first so the comparison is
 * constant-time whatever their lengths. Fails closed: false when the expected
 * key is not configured or the header is missing or repeated.
 */
export function isValidInternalKey(
  provided: string | string[] | undefined | null,
  expected: string | undefined = process.env.INTERNAL_API_KEY,
): boolean {
  if (!expected || typeof provided !== "string" || !provided) return false;
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}
