export type RealtimeUsage = {
  responses: number;
  inputTextTokens: number;
  inputAudioTokens: number;
  inputImageTokens: number;
  cachedTextTokens: number;
  cachedAudioTokens: number;
  cachedImageTokens: number;
  outputTextTokens: number;
  outputAudioTokens: number;
};

export const emptyRealtimeUsage = (): RealtimeUsage => ({
  responses: 0, inputTextTokens: 0, inputAudioTokens: 0, inputImageTokens: 0,
  cachedTextTokens: 0, cachedAudioTokens: 0, cachedImageTokens: 0,
  outputTextTokens: 0, outputAudioTokens: 0,
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function count(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function addRealtimeUsage(total: RealtimeUsage, raw: unknown): RealtimeUsage {
  const usage = record(raw);
  if (!Object.keys(record(usage.input_token_details)).length || !Object.keys(record(usage.output_token_details)).length) return total;
  const input = record(usage.input_token_details);
  const cached = record(input.cached_tokens_details);
  const output = record(usage.output_token_details);
  return {
    responses: total.responses + 1,
    inputTextTokens: total.inputTextTokens + count(input.text_tokens),
    inputAudioTokens: total.inputAudioTokens + count(input.audio_tokens),
    inputImageTokens: total.inputImageTokens + count(input.image_tokens),
    cachedTextTokens: total.cachedTextTokens + count(cached.text_tokens),
    cachedAudioTokens: total.cachedAudioTokens + count(cached.audio_tokens),
    cachedImageTokens: total.cachedImageTokens + count(cached.image_tokens),
    outputTextTokens: total.outputTextTokens + count(output.text_tokens),
    outputAudioTokens: total.outputAudioTokens + count(output.audio_tokens),
  };
}

// USD per million tokens. Keep this table aligned with the dated OpenAI rate card.
const RATE_CARD = {
  "gpt-realtime-2.1-mini": { textIn: 0.60, textCached: 0.06, textOut: 2.40, audioIn: 10, audioCached: 0.30, audioOut: 20, imageIn: 0.80, imageCached: 0.08 },
  "gpt-realtime-2.1": { textIn: 4, textCached: 0.40, textOut: 24, audioIn: 32, audioCached: 0.40, audioOut: 64, imageIn: 5, imageCached: 0.50 },
} as const;

export function realtimeCostUsd(model: string, usage: RealtimeUsage): number | null {
  const rates = RATE_CARD[model as keyof typeof RATE_CARD];
  if (!rates || !usage.responses) return null;
  const uncachedText = Math.max(0, usage.inputTextTokens - usage.cachedTextTokens);
  const uncachedAudio = Math.max(0, usage.inputAudioTokens - usage.cachedAudioTokens);
  const uncachedImage = Math.max(0, usage.inputImageTokens - usage.cachedImageTokens);
  return (
    uncachedText * rates.textIn + usage.cachedTextTokens * rates.textCached +
    uncachedAudio * rates.audioIn + usage.cachedAudioTokens * rates.audioCached +
    uncachedImage * rates.imageIn + usage.cachedImageTokens * rates.imageCached +
    usage.outputTextTokens * rates.textOut + usage.outputAudioTokens * rates.audioOut
  ) / 1_000_000;
}
