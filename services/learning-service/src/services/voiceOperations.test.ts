import { describe, expect, it } from "vitest";
import { summarizeVoiceOperations, type VoiceOperationRow } from "./voiceOperations";

const base: VoiceOperationRow = {
  voiceSessionId: "one", createdAt: new Date("2026-09-28T00:00:00Z"), startedAt: new Date("2026-09-28T00:00:01Z"),
  status: "ENDED", endReason: "USER_ENDED", consumedSeconds: 30, summary: { summaryTh: "ok" },
  providerUsage: { measuredRealtimeCostUsd: 0.12 },
};

describe("voice operations metrics", () => {
  it("uses the correct denominators and reports missing usage", () => {
    const result = summarizeVoiceOperations([
      base,
      { ...base, voiceSessionId: "two", endReason: "CONNECTION_LOST", summary: null, providerUsage: {} },
      { ...base, voiceSessionId: "three", startedAt: null, status: "PROVIDER_FAILED", endReason: "PROVIDER_FAILED" },
      { ...base, voiceSessionId: "four", startedAt: null, status: "ENDED", endReason: "CONNECTION_TIMEOUT" },
    ]);
    expect(result.attempts).toBe(4);
    expect(result.failedStarts).toBe(2);
    expect(result.failedStartRate).toBeCloseTo(0.5);
    expect(result.disconnectRate).toBe(0.5);
    expect(result.summaryFailureRate).toBe(0.5);
    expect(result.averageMeasuredRealtimeCostUsd).toBe(0.12);
    expect(result.missingCostSessions).toBe(1);
    expect(result.missingTranscriptionCostSessions).toBe(1);
  });

  it("adds transcription cost to the measured Realtime cost", () => {
    const result = summarizeVoiceOperations([
      { ...base, providerUsage: { measuredRealtimeCostUsd: 0.1, measuredTranscriptionCostUsd: 0.02 } },
      { ...base, voiceSessionId: "two", providerUsage: { measuredRealtimeCostUsd: 0.3, measuredTranscriptionCostUsd: 0.04 } },
    ]);
    expect(result.totalMeasuredRealtimeCostUsd).toBeCloseTo(0.4);
    expect(result.totalMeasuredTranscriptionCostUsd).toBeCloseTo(0.06);
    expect(result.totalMeasuredCostUsd).toBeCloseTo(0.46);
    expect(result.averageMeasuredCostUsd).toBeCloseTo(0.23);
    expect(result.missingTranscriptionCostSessions).toBe(0);
    expect(result.recentSessions[1].measuredCostUsd).toBeCloseTo(0.34);
  });
});
