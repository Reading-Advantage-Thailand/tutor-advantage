// Bangkok wall-clock helpers shared by reminders and attendance. No I/O.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Thailand has no DST
const DAY_MS = 24 * 60 * 60 * 1000;

/** yyyy-MM-dd of the Bangkok calendar day that contains `instant`. */
export function bangkokDateKey(instant: Date): string {
  return new Date(instant.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant of a Bangkok date + HH:mm, or null for an impossible date. */
export function bangkokInstant(date: string, time: string): Date | null {
  const instant = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(instant.getTime())) return null;
  // Reject impossible dates such as 2026-02-31, which Date rolls over.
  return bangkokDateKey(instant) === date ? instant : null;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
