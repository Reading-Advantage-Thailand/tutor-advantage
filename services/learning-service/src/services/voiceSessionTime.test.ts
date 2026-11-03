import { describe, expect, it } from "vitest";
import { consumedVoiceSeconds, providerEventShowsUse } from "./voiceSessionTime";

describe("provider events that start the clock", () => {
  it("treats learner speech and any reply as use", () => {
    expect(providerEventShowsUse("input_audio_buffer.speech_started")).toBe(true);
    expect(providerEventShowsUse("response.created")).toBe(true);
  });

  it("ignores events that do not prove the call is in use", () => {
    expect(providerEventShowsUse("session.created")).toBe(false);
    expect(providerEventShowsUse("session.updated")).toBe(false);
    expect(providerEventShowsUse("response.done")).toBe(false);
  });
});

describe("voice session usage", () => {
  const start = new Date("2026-09-28T00:00:00.000Z");

  it("charges connected elapsed time, rounded up to a second", () => {
    expect(consumedVoiceSeconds(start, new Date("2026-09-28T00:00:12.250Z"), 600)).toBe(13);
  });

  it("does not charge a pending call or more than the reservation", () => {
    expect(consumedVoiceSeconds(null, new Date("2026-09-28T00:00:12.250Z"), 600)).toBe(0);
    expect(consumedVoiceSeconds(start, new Date("2026-09-28T00:20:00.000Z"), 600)).toBe(600);
  });

  it("never charges negative time", () => {
    expect(consumedVoiceSeconds(start, new Date("2026-09-27T23:59:59.000Z"), 600)).toBe(0);
  });
});
