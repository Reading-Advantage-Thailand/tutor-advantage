/** Pure helpers for the demo room page. */

export type ExpiryParts = { expired: boolean; hours: number; minutes: number };

/** Time left until `expiresAt` (same arithmetic as the original badge). */
export function expiryParts(expiresAt: string, now: number = Date.now()): ExpiryParts {
  const diffMs = new Date(expiresAt).getTime() - now;
  return {
    expired: diffMs <= 0,
    hours: Math.floor(diffMs / 3600000),
    minutes: Math.floor((diffMs % 3600000) / 60000),
  };
}

/** Demo rooms that have not expired yet. */
export function activeDemoClasses<T extends { expiresAt: string }>(classes: T[], now: number = Date.now()): T[] {
  return classes.filter((c) => new Date(c.expiresAt).getTime() > now);
}

/** Student invite URL for a demo room's referral token. */
export function demoInviteUrl(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}
