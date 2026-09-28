export function consumedVoiceSeconds(startedAt: Date | null, endedAt: Date, reservedSeconds: number) {
  if (!startedAt) return 0;
  return Math.min(reservedSeconds, Math.max(0, Math.ceil((endedAt.getTime() - startedAt.getTime()) / 1000)));
}
