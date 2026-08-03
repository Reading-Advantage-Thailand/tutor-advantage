import { createHash } from "crypto";

export type TtsSource = "READING_ADVANTAGE" | "PRIMARY_ADVANTAGE";

export type TtsAudioItem = {
  id: string;
  order: number;
  text: string;
  objectPath: string;
  audioUrl: string;
  status: "ready" | "pending" | "missing";
};

export type TtsManifest = {
  version: 1;
  articleId: string;
  source: TtsSource;
  voice: {
    provider: string;
    voiceId: string;
    languageCode: string;
    speakingRate?: number;
    pitch?: number;
  };
  sentences: TtsAudioItem[];
  words: TtsAudioItem[];
  // Extra word clips used by sentence games. These are deliberately kept
  // separate from the curated vocabulary list shown in the lesson UI.
  sentenceWords?: TtsAudioItem[];
  questions: Array<{
    id: string;
    type: "mcq" | "saq";
    order: number;
    text: string;
    questionAudioUrl: string;
    optionAudioUrls?: Record<string, string>;
  }>;
  generatedAt?: string;
};

const cleanText = (value: unknown) => String(value ?? "").trim();

export function stableAudioItemId(kind: "sentence" | "word", order: number, text: string) {
  const digest = createHash("sha1").update(`${kind}\0${order}\0${text}`).digest("hex").slice(0, 10);
  return `${kind}-${String(order + 1).padStart(3, "0")}-${digest}`;
}

export function getTtsObjectPath(
  articleId: string,
  kind: "sentence" | "word",
  order: number,
  text: string,
) {
  const id = stableAudioItemId(kind, order, text);
  return `articles/${articleId}/${kind === "sentence" ? "sentences" : "words"}/${id}.mp3`;
}

export function getTtsAudioUrl(bucket: string, objectPath: string) {
  return `https://storage.googleapis.com/${bucket}/${objectPath}`;
}

export async function loadTtsManifest(articleId: string, bucket: string): Promise<TtsManifest | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(getTtsAudioUrl(bucket, `articles/${articleId}/manifest.json`), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const value = await response.json();
    if (value?.version !== 1 || value?.articleId !== articleId) return null;
    return value as TtsManifest;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toText(value: any) {
  return cleanText(typeof value === "object" ? value?.sentences ?? value?.sentence ?? value?.text : value);
}

export function buildTtsManifest({
  articleId,
  source,
  sentences,
  words,
  questions = [],
  bucket,
  voiceId = process.env.TTS_VOICE_ID || "en-US-Neural2-C",
}: {
  articleId: string;
  source: TtsSource;
  sentences: unknown[];
  words: unknown[];
  questions?: unknown[];
  bucket: string;
  voiceId?: string;
}): TtsManifest {
  const buildItems = (values: unknown[], kind: "sentence" | "word"): TtsAudioItem[] =>
    values.map((value: any, order) => {
      const text = kind === "word"
        ? cleanText(typeof value === "object" ? value?.vocabulary ?? value?.word ?? value?.text : value)
        : toText(value);
      const objectPath = getTtsObjectPath(articleId, kind, order, text);
      const existingUrl = typeof value === "object" ? value?.audioUrl ?? value?.audio_url : undefined;
      const audioUrl = typeof existingUrl === "string" && existingUrl.startsWith("http")
        ? existingUrl
        : getTtsAudioUrl(bucket, objectPath);
      return {
        id: stableAudioItemId(kind, order, text),
        order,
        text,
        objectPath,
        audioUrl,
        status: typeof existingUrl === "string" && existingUrl.startsWith("http") ? "ready" : "pending",
      };
    });

  const questionItems = questions.map((question: any, order: number) => {
    const text = cleanText(question?.question ?? question?.text);
    const questionId = `${question?.type === "saq" ? "saq" : "mcq"}-${String(order + 1).padStart(3, "0")}-${createHash("sha1").update(`question\0${order}\0${text}`).digest("hex").slice(0, 10)}`;
    const questionPath = `articles/${articleId}/questions/${questionId}.mp3`;
    const optionAudioUrls: Record<string, string> = {};
    const options = Array.isArray(question?.options)
      ? question.options
      : Object.entries(question?.options || {}).map(([key, value]) => ({ key, value }));
    options.forEach((option: any, optionIndex: number) => {
      const key = option?.key || `option${optionIndex + 1}`;
      const optionText = cleanText(option?.value ?? option);
      const optionId = `${questionId}-${key}-${createHash("sha1").update(`option\0${order}\0${key}\0${optionText}`).digest("hex").slice(0, 8)}`;
      optionAudioUrls[key] = getTtsAudioUrl(bucket, `articles/${articleId}/questions/${optionId}.mp3`);
    });
    return {
      id: questionId,
      type: (question?.type === "saq" ? "saq" : "mcq") as "mcq" | "saq",
      order,
      text,
      questionAudioUrl: getTtsAudioUrl(bucket, questionPath),
      ...(Object.keys(optionAudioUrls).length ? { optionAudioUrls } : {}),
    };
  });

  return {
    version: 1,
    articleId,
    source,
    voice: { provider: "google-cloud-text-to-speech", voiceId, languageCode: "en-US" },
    sentences: buildItems(sentences, "sentence"),
    words: buildItems(words, "word"),
    questions: questionItems,
  };
}
