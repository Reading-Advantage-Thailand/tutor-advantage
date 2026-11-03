// Provider events that only happen while the call is really in use: the
// learner speaking, or a reply being generated (the client can also ask for
// one over the WebRTC data channel). The server sees them on its sideband, so
// metering never depends on the client reporting that it connected.
const IN_USE_EVENTS = new Set(["input_audio_buffer.speech_started", "response.created"]);

export function providerEventShowsUse(type: string) {
  return IN_USE_EVENTS.has(type);
}

export function consumedVoiceSeconds(startedAt: Date | null, endedAt: Date, reservedSeconds: number) {
  if (!startedAt) return 0;
  return Math.min(reservedSeconds, Math.max(0, Math.ceil((endedAt.getTime() - startedAt.getTime()) / 1000)));
}
