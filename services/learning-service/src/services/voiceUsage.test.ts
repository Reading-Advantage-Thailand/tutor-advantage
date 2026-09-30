import { describe, expect, it } from "vitest";
import {
  addRealtimeUsage, emptyRealtimeUsage, realtimeCostUsd,
  reportedTranscriptionSeconds, transcriptionCostUsd, vadSpeechSeconds,
} from "./voiceUsage";

describe("provider reported realtime usage", () => {
  it("sums every response and prices cached audio separately", () => {
    const response = {
      input_token_details: { text_tokens: 1000, audio_tokens: 2000, image_tokens: 0,
        cached_tokens_details: { text_tokens: 500, audio_tokens: 1000, image_tokens: 0 } },
      output_token_details: { text_tokens: 100, audio_tokens: 300 },
    };
    const total = addRealtimeUsage(addRealtimeUsage(emptyRealtimeUsage(), response), response);
    expect(total.responses).toBe(2);
    expect(total.inputAudioTokens).toBe(4000);
    expect(realtimeCostUsd("gpt-realtime-2.1-mini", total)).toBeCloseTo(0.03374);
  });

  it("does not invent a cost for missing usage or an unknown model", () => {
    expect(realtimeCostUsd("gpt-realtime-2.1-mini", emptyRealtimeUsage())).toBeNull();
    expect(addRealtimeUsage(emptyRealtimeUsage(), { input_tokens: 500 }).responses).toBe(0);
    expect(realtimeCostUsd("unknown", addRealtimeUsage(emptyRealtimeUsage(), {
      input_token_details: { text_tokens: 1 }, output_token_details: { text_tokens: 1 },
    }))).toBeNull();
  });
});

describe("input transcription usage", () => {
  it("prefers provider duration and prices gpt-transcribe per minute", () => {
    expect(reportedTranscriptionSeconds({ type: "duration", seconds: 12.5 })).toBe(12.5);
    expect(reportedTranscriptionSeconds({ type: "tokens", input_tokens: 17 })).toBeNull();
    expect(vadSpeechSeconds(1200, 4200)).toBe(3);
    expect(vadSpeechSeconds(4200, 1200)).toBeNull();
    expect(transcriptionCostUsd("gpt-transcribe", 120)).toBeCloseTo(0.009);
    expect(transcriptionCostUsd("unknown", 120)).toBeNull();
  });
});
