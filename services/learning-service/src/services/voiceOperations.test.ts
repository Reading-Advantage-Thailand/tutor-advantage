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
  });
});
