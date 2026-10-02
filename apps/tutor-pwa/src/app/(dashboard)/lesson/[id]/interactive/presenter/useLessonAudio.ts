"use client";

/**
 * Audio for the presenter: resolves the article's TTS manifest (inline or
 * /api/tts-manifest) and plays question / option / word clips, falling back
 * to browser speech synthesis with a small notice when a clip is missing.
 */
import React from "react";
import type { ArticleData } from "@/lib/lesson-types";
import type { QuestionAudioLookup } from "./questionModels";

export interface LessonAudio extends QuestionAudioLookup {
  /** Article data with the resolved audio manifest merged in (for ArticleDisplay). */
  presentationArticleData?: ArticleData;
  /** Text currently spoken by the browser fallback (shown as a notice). */
  fallbackText: string | null;
  playClip: (url: string | null | undefined, fallbackText: string) => void;
  playOption: (options: {
    optionText: string;
    label: string;
    sourceQuestion?: any;
    optionAudioUrls?: Record<string, string>;
  }) => void;
}

const isHttpUrl = (value: unknown): value is string => typeof value === "string" && /^https?:\/\//i.test(value);

export function useLessonAudio(articleData?: ArticleData): LessonAudio {
  const standaloneAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const [fallbackText, setFallbackText] = React.useState<string | null>(null);
  const [remoteAudioManifest, setRemoteAudioManifest] = React.useState<any | null>(null);

  const inlineAudioManifest = (articleData as any)?.audio_manifest;
  const manifestArticleId = (articleData as any)?.id || (articleData as any)?.articleId;
  const manifestUrl = manifestArticleId ? `/api/tts-manifest/${encodeURIComponent(manifestArticleId)}` : null;
  const inlineQuestions = Array.isArray(inlineAudioManifest?.questions) ? inlineAudioManifest.questions : [];
  const sourceQuestions = [
    ...((articleData as any)?.multipleChoiceQuestions || []).map((item: any) => item?.question),
    ...((articleData as any)?.shortAnswerQuestions || []).map((item: any) => item?.question),
  ]
    .filter(Boolean)
    .map((text: string) => text.trim().toLowerCase());
  const sourceSentences = ((articleData as any)?.sentences || [])
    .map((sentence: any) =>
      String(
        typeof sentence === "object" ? sentence?.sentences || sentence?.text || sentence?.sentence || "" : sentence || "",
      ).trim(),
    )
    .filter(Boolean);
  const inlineSentences = Array.isArray(inlineAudioManifest?.sentences) ? inlineAudioManifest.sentences : [];
  const inlineQuestionsMatch =
    sourceQuestions.length > 0
      ? sourceQuestions.every((text: string) =>
          inlineQuestions.some((item: any) => String(item?.text || "").trim().toLowerCase() === text),
        )
      : inlineQuestions.length > 0;
  const inlineSentencesMatch =
    sourceSentences.length > 0
      ? sourceSentences.every((text: string, index: number) => String(inlineSentences[index]?.text || "").trim() === text)
      : inlineSentences.length > 0;
  const inlineManifestIsComplete = inlineQuestionsMatch && inlineSentencesMatch;
  const inlineNeedsSentenceWordRefresh = sourceSentences.length > 0 && !Array.isArray(inlineAudioManifest?.sentenceWords);

  React.useEffect(() => {
    if ((inlineManifestIsComplete && !inlineNeedsSentenceWordRefresh) || !manifestUrl) {
      setRemoteAudioManifest(null);
      return;
    }
    let cancelled = false;
    fetch(manifestUrl, { headers: { accept: "application/json" }, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (!cancelled && manifest?.version === 1) setRemoteAudioManifest(manifest);
      })
      .catch(() => {
        // The explicit per-question URLs remain the next source of truth.
      });
    return () => {
      cancelled = true;
    };
  }, [articleData, inlineManifestIsComplete, inlineNeedsSentenceWordRefresh, manifestUrl]);

  React.useEffect(
    () => () => {
      standaloneAudioRef.current?.pause();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const audioManifest = remoteAudioManifest || inlineAudioManifest;
  const presentationArticleData = React.useMemo(
    () => (audioManifest && articleData ? { ...articleData, audio_manifest: audioManifest } : articleData),
    [articleData, audioManifest],
  );
  const manifestQuestions: any[] = Array.isArray(audioManifest?.questions) ? audioManifest.questions : [];

  const getManifestQuestion = (type: "mcq" | "saq", index: number) =>
    manifestQuestions.filter((item: any) => item?.type === type)[index] as any;
  const getManifestQuestionByText = (text: string, type?: "mcq" | "saq") => {
    const questionKey = String(text || "").trim().toLowerCase();
    return manifestQuestions.find(
      (item: any) => (!type || item?.type === type) && String(item?.text || "").trim().toLowerCase() === questionKey,
    ) as any;
  };
  const getWordAudioUrl = (text: string) => {
    const word = (articleData?.words || []).find(
      (item: any) => String(item?.vocabulary || item?.word || item?.text || "").toLowerCase() === text.toLowerCase(),
    ) as any;
    if (word?.audioUrl || word?.audio_url) return word.audioUrl || word.audio_url;
    const manifestWords = [
      ...(Array.isArray(audioManifest?.words) ? audioManifest.words : []),
      ...(Array.isArray(audioManifest?.sentenceWords) ? audioManifest.sentenceWords : []),
    ];
    const manifestWord = manifestWords.find((item: any) => String(item?.text || "").toLowerCase() === text.toLowerCase());
    return manifestWord?.audioUrl;
  };
  const normaliseOptionAudioUrls = (urls?: Record<string, string>) => {
    if (!urls) return undefined;
    const normalised: Record<string, string> = { ...urls };
    ["A", "B", "C", "D"].forEach((label, index) => {
      const legacyKey = `option${index + 1}`;
      if (!normalised[label] && normalised[legacyKey]) normalised[label] = normalised[legacyKey];
    });
    return normalised;
  };
  const getSentenceAudioUrl = (sentence: any, index: number) => {
    const directUrl = typeof sentence === "object" ? sentence?.audioUrl || sentence?.audio_url : undefined;
    const manifestSentence = Array.isArray(audioManifest?.sentences) ? audioManifest.sentences[index] : undefined;
    return directUrl || manifestSentence?.audioUrl;
  };

  const showFallbackNotice = (text: string) => {
    setFallbackText(text);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setFallbackText(null), 4500);
  };

  const stopAll = () => {
    standaloneAudioRef.current?.pause();
    standaloneAudioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const speakFallback = (text: string) => {
    showFallbackNotice(text);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
      } catch {
        // ignore
      }
    }
  };

  /** Play the first playable URL, then fall back to speech synthesis. */
  const playCandidates = (candidates: string[], fallback: string) => {
    let candidateIndex = 0;
    const tryNext = () => {
      if (candidateIndex >= candidates.length) {
        speakFallback(fallback);
        return;
      }
      const clip = new Audio();
      standaloneAudioRef.current = clip;
      clip.oncanplay = () => {
        try {
          clip.playbackRate = 1.0;
        } catch {}
      };
      clip.onended = () => {
        if (standaloneAudioRef.current === clip) standaloneAudioRef.current = null;
      };
      clip.onerror = () => {
        if (standaloneAudioRef.current !== clip) return;
        standaloneAudioRef.current = null;
        candidateIndex++;
        tryNext();
      };
      clip.src = candidates[candidateIndex];
      clip.play().catch((err) => {
        if (standaloneAudioRef.current !== clip) return;
        if (err?.name !== "AbortError") {
          standaloneAudioRef.current = null;
          candidateIndex++;
          tryNext();
        }
      });
    };
    tryNext();
  };

  const playClip = (url: string | null | undefined, text: string) => {
    stopAll();
    playCandidates(isHttpUrl(url) ? [url] : [], text);
  };

  const playOption: LessonAudio["playOption"] = ({ optionText, label, sourceQuestion, optionAudioUrls }) => {
    stopAll();
    const candidateKeys: string[] = [label];
    if (sourceQuestion?.options) {
      if (Array.isArray(sourceQuestion.options)) {
        const idx = sourceQuestion.options.indexOf(optionText);
        if (idx !== -1) candidateKeys.unshift(`option${idx + 1}`, `${idx}`);
      } else if (typeof sourceQuestion.options === "object") {
        for (const [k, v] of Object.entries(sourceQuestion.options)) {
          if (v === optionText) {
            candidateKeys.unshift(k);
            break;
          }
        }
      }
    }
    const explicitUrl = candidateKeys
      .map((key) => optionAudioUrls?.[key] || sourceQuestion?.optionAudioUrls?.[key])
      .find(isHttpUrl);
    playCandidates(explicitUrl ? [explicitUrl] : [], optionText);
  };

  return {
    presentationArticleData,
    fallbackText,
    playClip,
    playOption,
    getManifestQuestion,
    getManifestQuestionByText,
    getSentenceAudioUrl,
    getWordAudioUrl,
    normaliseOptionAudioUrls,
  };
}
