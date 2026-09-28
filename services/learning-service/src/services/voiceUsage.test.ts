import { describe, expect, it } from "vitest";
import { addRealtimeUsage, emptyRealtimeUsage, realtimeCostUsd } from "./voiceUsage";

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
