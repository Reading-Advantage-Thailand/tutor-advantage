"use client";

/**
 * What a sentence game shows as its prompt.
 *
 * Only about 1 lesson article in 9 stores Thai for its sentences. For the rest,
 * showing the English sentence all round would turn the game into copying, and
 * showing nothing makes a long sentence close to unguessable. So:
 *
 * - Thai exists (`item.thaiTranslation`): show the Thai all round.
 * - No Thai: play the recording and show the English for a few seconds, then
 *   hide it behind a replay button. Replay is free and can be used any time.
 *
 * Wiring, with the sentence the student is working on now:
 *
 *   const prompt = useSentencePrompt(currentSentence);
 *   prompt.hidden
 *     ? <button onClick={prompt.replay}>{SENTENCE_REPLAY_LABEL}</button>
 *     : <p>{prompt.text}</p>
 *
 * Pass `{ enabled: false }` in a tutor demo or tutorial: the text stays up and
 * no sound starts on its own. `item.translation` must not be used as a prompt,
 * because without Thai it holds the English answer.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { countSentenceWords } from "@/lib/games/sentenceRound";
import type { VocabularyItem } from "@/store/useGameStore";

export const SENTENCE_REPLAY_LABEL = "ดูประโยคอีกครั้ง";

export type SentencePromptItem = Pick<VocabularyItem, "term" | "thaiTranslation" | "audioUrl">;

export type SentencePromptContent =
  | { kind: "thai"; text: string; audioUrl?: string }
  | { kind: "peek"; text: string; audioUrl?: string; peekMs: number };

/** Long enough to read the sentence once at a child's pace, and never longer than a short wait. */
export function sentencePeekMs(sentence: string): number {
  return Math.min(8_000, Math.max(3_000, 2_000 + countSentenceWords(sentence) * 400));
}

export function sentencePromptFor(item: SentencePromptItem): SentencePromptContent {
  if (item.thaiTranslation) return { kind: "thai", text: item.thaiTranslation, audioUrl: item.audioUrl };
  return { kind: "peek", text: item.term, audioUrl: item.audioUrl, peekMs: sentencePeekMs(item.term) };
}

export type SentencePrompt = {
  /** "none" until there is a sentence. */
  kind: "thai" | "peek" | "none";
  /** The text to show. Empty while hidden. */
  text: string;
  /** True when the English has been hidden: show the replay button instead of the text. */
  hidden: boolean;
  /** Plays the recording again and, without Thai, shows the sentence again. */
  replay: () => void;
};

export function useSentencePrompt(
  item: SentencePromptItem | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): SentencePrompt {
  const content = item ? sentencePromptFor(item) : null;
  const key = item ? `${item.term}\n${enabled}` : "";
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const keyRef = useRef(key);
  keyRef.current = key;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const show = useCallback(() => {
    const current = contentRef.current;
    if (!current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setHiddenKey(null);
    if (current.kind === "peek" && enabledRef.current) {
      const shownKey = keyRef.current;
      timerRef.current = setTimeout(() => setHiddenKey(shownKey), current.peekMs);
    }
    if (current.audioUrl) {
      // One reused element: phones allow it to replay without a new tap on it.
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = current.audioUrl;
      // Not every article has a recording yet, and a blocked or missing one must not stop the game.
      void audio.play()?.catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (key && enabled) show();
    else setHiddenKey(null);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      audioRef.current?.pause();
    };
  }, [key, enabled, show]);

  const hidden = Boolean(key) && hiddenKey === key && content?.kind === "peek";
  return {
    kind: content?.kind ?? "none",
    text: hidden || !content ? "" : content.text,
    hidden,
    replay: show,
  };
}
