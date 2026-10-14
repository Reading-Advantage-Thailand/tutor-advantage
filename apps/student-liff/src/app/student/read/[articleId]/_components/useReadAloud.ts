"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";

const noopSubscribe = () => () => {};

/**
 * True when the browser can speak text (Web Speech synthesis). Android
 * WebViews (LINE in-app browser on Android) usually cannot: there we hide the
 * listen buttons instead of showing controls that do nothing.
 */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
}

/**
 * Reads an article aloud paragraph by paragraph with the shared TTS player,
 * and speaks single words. `readingIndex` is the paragraph being read (null
 * when idle).
 */
export function useReadAloud(paragraphs: string[]) {
  const { isSpeaking, speak, stop } = useTtsPlayer();
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const startedRef = useRef(false);

  // Advance to the next paragraph when the current one finishes.
  useEffect(() => {
    if (readingIndex === null) return;
    if (isSpeaking) {
      startedRef.current = true;
      return;
    }
    if (!startedRef.current) return;
    startedRef.current = false;
    const next = readingIndex + 1;
    if (next < paragraphs.length) {
      setReadingIndex(next);
      speak(paragraphs[next]);
    } else {
      setReadingIndex(null);
    }
  }, [isSpeaking, readingIndex, paragraphs, speak]);

  const startReading = useCallback(
    (from = 0) => {
      if (!paragraphs[from]) return;
      startedRef.current = false;
      setReadingIndex(from);
      speak(paragraphs[from]);
    },
    [paragraphs, speak],
  );

  const stopReading = useCallback(() => {
    startedRef.current = false;
    setReadingIndex(null);
    stop();
  }, [stop]);

  const speakWord = useCallback(
    (word: string, audioUrl?: string) => {
      startedRef.current = false;
      setReadingIndex(null);
      speak(word, audioUrl);
    },
    [speak],
  );

  return { readingIndex, isReading: readingIndex !== null, isSpeaking, startReading, stopReading, speakWord };
}
