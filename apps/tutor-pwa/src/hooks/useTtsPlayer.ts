"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const isHttpUrl = (value?: string | null): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

export function useTtsPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, audioUrl?: string | null) => {
    const value = text.trim();
    if (!value) return;

    stop();

    const speakFallback = () => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      try {
        const utterance = new SpeechSynthesisUtterance(value);
        utterance.lang = "en-US";
        utterance.rate = 0.85;
        utterance.onend = () => {
          if (utteranceRef.current === utterance) {
            utteranceRef.current = null;
            setIsSpeaking(false);
          }
        };
        utterance.onerror = () => {
          if (utteranceRef.current === utterance) {
            utteranceRef.current = null;
            setIsSpeaking(false);
          }
        };
        utteranceRef.current = utterance;
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    };

    if (!isHttpUrl(audioUrl)) {
      speakFallback();
      return;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    setIsSpeaking(true);

    const finish = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setIsSpeaking(false);
    };

    audio.onended = finish;
    audio.onerror = () => {
      if (audioRef.current !== audio) return;
      finish();
      speakFallback();
    };
    audio.src = audioUrl;
    audio.play().catch((error: unknown) => {
      if (audioRef.current !== audio) return;
      finish();
      if (!(error instanceof DOMException) || error.name !== "AbortError") {
        speakFallback();
      }
    });
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { isSpeaking, speak, stop };
}
