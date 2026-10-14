import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { t } from "@/lib/i18n";
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Lightbulb, ListChecks, MessageCircle, Pause, Play, Sparkles, Target, Volume2 } from "lucide-react";
import { Chip, IconTile } from "@/components/app";
import { useThaiTranslations } from "@/hooks/useThaiTranslations";
import { LESSON_PHASE } from "@/lib/lessonPhases";

import { ArticleData } from "@/lib/lesson-types";

interface ArticleDisplayProps {
  articleData?: ArticleData;
  phase: number;
  isFullscreen?: boolean;
  flagCounts?: Record<number, number>;
  onActiveIdxChange?: (idx: number) => void;
}

const AUDIO_RATES = [0.75, 0.85, 1, 1.15] as const;
const SENTENCE_STOP_MARGIN_SECONDS = 0.06;

const getSentenceText = (sentence: any) =>
  String(
    typeof sentence === "object"
      ? sentence.sentences || sentence.text || sentence.sentence || ""
      : sentence || "",
  );

const getSentenceTime = (sentence: any) => {
  if (typeof sentence !== "object") return 0;
  const value = Number(sentence.timeSeconds ?? sentence.startTime ?? 0);
  return Number.isFinite(value) ? value : 0;
};

// Kept in sync with Primary's student/read/[articleId] ArticleContent.  The
// audio transcript and the rendered sentence occasionally tokenize
// contractions differently, so a plain word-index lookup can highlight the
// wrong display token.
const normalizeAudioWord = (word: string) =>
  word.toLowerCase().replace(/[\u2018\u2019'`]/g, "").replace(/[^a-z0-9]/g, "");

const splitIntoDisplayParts = (text: string) =>
  text.split(/(\s+|[.!?;:,"“”'`()[\]{}\-–—…]+)/);

const isDisplayWord = (part: string) =>
  /[\w]/.test(part) && /^[\w'-]+$/.test(part) && part.trim() !== "";

const getTimedWords = (sentence: any): any[] =>
  Array.isArray(sentence?.words) ? sentence.words : [];

const getTimedWordStart = (word: any) =>
  Number(word?.start ?? word?.startTime ?? word?.timeSeconds ?? NaN);

const getTimedWordEnd = (word: any) =>
  Number(word?.end ?? word?.endTime ?? NaN);

const getTimedWordText = (word: any) =>
  String(word?.word ?? word?.text ?? word?.vocabulary ?? "");

function buildPrimaryWordMap(sentence: any) {
  const displayWords = splitIntoDisplayParts(getSentenceText(sentence)).filter(isDisplayWord);
  const audioWords = getTimedWords(sentence);
  const audioToDisplay = new Map<number, number>();
  const displayToAudio = new Map<number, number>();
  let audioIndex = 0;

  for (
    let displayIndex = 0;
    displayIndex < displayWords.length && audioIndex < audioWords.length;
    displayIndex++
  ) {
    const displayWord = normalizeAudioWord(displayWords[displayIndex]);
    let combined = "";
    let matched = false;

    // Primary's article reader combines up to three timeline tokens. This is
    // required for entries such as "I'm" and "don't".
    for (let next = audioIndex; next < Math.min(audioIndex + 3, audioWords.length); next++) {
      combined += normalizeAudioWord(getTimedWordText(audioWords[next]));
      if (combined === displayWord) {
        for (let index = audioIndex; index <= next; index++) {
          audioToDisplay.set(index, displayIndex);
        }
        displayToAudio.set(displayIndex, audioIndex);
        audioIndex = next + 1;
        matched = true;
        break;
      }
    }

    // Preserve Primary's safe positional fallback when the transcript has a
    // spelling/tokenization mismatch.
    if (!matched) {
      audioToDisplay.set(audioIndex, displayIndex);
      displayToAudio.set(displayIndex, audioIndex);
      audioIndex++;
    }
  }

  return { audioToDisplay, displayToAudio };
}

function GuideQuestionCard({
  label,
  question,
  onSpeak,
  className = "",
  large = false,
  dataTourTarget,
}: {
  label: string;
  question: string;
  onSpeak?: () => void;
  className?: string;
  large?: boolean;
  dataTourTarget?: string;
}) {
  const { translations, loading } = useThaiTranslations([question], {
    enabled: Boolean(question),
  });
  const thaiQuestion = translations[0];

  return (
    <div data-tour-target={dataTourTarget} className={`rounded-lg border border-hairline bg-surface p-3 ${className}`}>
      <div className="flex items-start gap-2">
        <p className={`flex-1 font-semibold text-fg ${large ? "text-[clamp(16px,1.12vw,21px)] leading-snug" : "text-base leading-snug"}`}>
          {label}. {question}
        </p>
        {onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            data-tour-target={dataTourTarget ? `${dataTourTarget}-audio` : undefined}
            title={t("lesson.interactive.speakTitle")}
            aria-label={t("lesson.interactive.speakTitle")}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg transition-colors hover:bg-brand-soft/70"
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>
      {(thaiQuestion || loading) && (
        <p className={`mt-1.5 text-fg-muted ${large ? "text-[clamp(14px,0.92vw,18px)] leading-snug" : "text-sm leading-relaxed"}`}>
          {thaiQuestion || t("lesson.live.translating")}
        </p>
      )}
    </div>
  );
}

export const ArticleDisplay: React.FC<ArticleDisplayProps> = ({
  articleData,
  phase,
  isFullscreen = false,
  flagCounts,
  onActiveIdxChange,
}) => {
  const words = useMemo(() => articleData?.words || [], [articleData?.words]);
  const sentences = useMemo(
    () => articleData?.sentences || [],
    [articleData?.sentences],
  );
  const isPrimaryContent = articleData?.content_provider === "PRIMARY_ADVANTAGE";

  const displayCefr = String(articleData?.cefr_level || "").replace(/^CEFR\s*/i, "");

  // Article image URL from GCS
  const primaryImageUrls = Array.isArray((articleData as any)?.image_urls)
    ? (articleData as any).image_urls.filter(
        (url: unknown): url is string => typeof url === "string" && url.length > 0,
      )
    : [];
  const primaryImageUrl = primaryImageUrls[0] ?? null;
  const articleImageUrl = primaryImageUrl || (articleData?.id
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleData.id}.png`
    : null);

  // ── Audio state for the reading phase ────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  // Primary keeps one preloaded full-article audio element for seeking between
  // sentence timestamps. This mirrors Primary's ArticleContent/useAudioPlayer.
  const primaryArticleAudioRef = useRef<HTMLAudioElement>(null);
  const primaryTrackingRafRef = useRef<number | null>(null);
  const primarySentencePlaybackTokenRef = useRef(0);
  const activeSentenceRef = useRef(-1);
  const activeWordRef = useRef(-1);
  const primaryWordMapsRef = useRef<Map<number, ReturnType<typeof buildPrimaryWordMap>>>(
    new Map(),
  );
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const clipStopRafRef = useRef<number | null>(null);
  const phase5PassageRef = useRef<HTMLDivElement>(null);
  const phase5VocabRef = useRef<HTMLDivElement>(null);
  const stopAtRef = useRef<number>(Infinity); // for single-sentence mode
  const sentenceStopRafRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false); // prevent highlight flickering during seek
  const audioRequestRef = useRef(0);
  const granularAutoAdvanceRef = useRef(false);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speechRate, setSpeechRate] = useState(0.75);
  const [autoVocabTh, setAutoVocabTh] = useState<Record<number, string>>({});
  const [autoVocabEnTh, setAutoVocabEnTh] = useState<Record<number, string>>(
    {},
  );

  useEffect(() => {
    activeSentenceRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    activeWordRef.current = activeWordIdx;
  }, [activeWordIdx]);

  const sentenceTexts = useMemo(
    () => sentences.map((sentence: any) => getSentenceText(sentence)),
    [sentences],
  );
  const storedThaiSentences = useMemo(
    () =>
      Array.isArray(articleData?.translated_passage?.th)
        ? articleData.translated_passage.th
        : [],
    [articleData?.translated_passage],
  );
  const shouldTranslateArticle = Boolean(
    articleData && ([
      LESSON_PHASE.READ_ARTICLE,
      LESSON_PHASE.VOCABULARY_CONTEXT,
      LESSON_PHASE.DEEP_READING,
      LESSON_PHASE.KEY_SENTENCES,
    ] as number[]).includes(phase),
  );
  const { translations: thaiSentences, loading: translatingArticle } =
    useThaiTranslations(sentenceTexts, {
      enabled: shouldTranslateArticle,
      initialTranslations: storedThaiSentences,
    });
  const thaiPassage = useMemo(
    () => thaiSentences.filter(Boolean).join(" "),
    [thaiSentences],
  );

  // This is the same display-word/audio-word alignment Primary uses in its
  // student article reader. It deliberately only applies to Primary content;
  // Reading Advantage retains its existing, independent rendering flow.
  useEffect(() => {
    if (!isPrimaryContent) {
      primaryWordMapsRef.current = new Map();
      return;
    }
    primaryWordMapsRef.current = new Map(
      sentences.map((sentence: any, index: number) => [
        index,
        buildPrimaryWordMap(sentence),
      ]),
    );
  }, [isPrimaryContent, sentences]);

  useEffect(() => {
    if (phase !== LESSON_PHASE.VOCABULARY_CONTEXT) return;

    const passage = phase5PassageRef.current;
    const vocab = phase5VocabRef.current;
    if (!passage || !vocab) return;

    const syncPanelHeight = () => {
      // In fullscreen the Phase 4 vocabulary grid owns the available viewport height.
      // Matching the vocabulary panel to the passage's content height would
      // leave a large unused area below both cards.
      if (isFullscreen || window.innerWidth < 1024) {
        vocab.style.height = "";
        vocab.style.maxHeight = "";
        return;
      }

      const height = passage.getBoundingClientRect().height;
      vocab.style.height = `${height}px`;
      vocab.style.maxHeight = `${height}px`;
    };

    syncPanelHeight();
    const observer = new ResizeObserver(syncPanelHeight);
    observer.observe(passage);
    window.addEventListener("resize", syncPanelHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncPanelHeight);
      vocab.style.height = "";
      vocab.style.maxHeight = "";
    };
  }, [phase, thaiPassage, words.length, isFullscreen]);

  const articleId = String(articleData?.id || articleData?.articleId || "");
  const sentenceStopMarginSeconds = SENTENCE_STOP_MARGIN_SECONDS;
  const hasPublishedGranularManifest = Boolean(
    Array.isArray((articleData as any)?.audio_manifest?.sentences) &&
      (articleData as any).audio_manifest.sentences.length > 0,
  );
  const readingAdvantageAudioUrl = (() => {
    if (!articleId || hasPublishedGranularManifest) return null;
    const rawAudioUrl = String(
      articleData?.audio_url ||
        articleData?.raAudioUrl ||
        articleData?.readingAdvantageAudioUrl ||
        "",
    );
    return rawAudioUrl.startsWith("http") ? rawAudioUrl : null;
  })();

  const [audioToastText, setAudioToastText] = useState<string | null>(null);
  const [launchImageFailed, setLaunchImageFailed] = useState(false);

  const stopSpeechFallback = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const showAudioFallbackToast = (text: string) => {
    setAudioToastText(text);
    setTimeout(() => setAudioToastText(null), 4500);
  };

  const playClipUrl = (url?: string | null, fallbackText?: string) => {
    const requestId = ++audioRequestRef.current;
    primarySentencePlaybackTokenRef.current++;
    clearSentenceStopMonitor();
    stopSpeechFallback();
    clipAudioRef.current?.pause();
    clipAudioRef.current = null;

    const playFallback = () => {
      if (fallbackText) {
        showAudioFallbackToast(fallbackText);
      }
      if (fallbackText && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(fallbackText);
          u.lang = "en-US";
          window.speechSynthesis.speak(u);
        } catch {
          // ignore
        }
      }
    };

    if (!url) {
      playFallback();
      return;
    }

    clearClipStopMonitor();
    if (audioRef.current) audioRef.current.pause();
    const clip = new Audio();
    clipAudioRef.current = clip;
    setIsPlaying(true);

    clip.onended = () => {
      if (clipAudioRef.current === clip && audioRequestRef.current === requestId) {
        clipAudioRef.current = null;
        setIsPlaying(false);
      }
    };
    clip.onerror = () => {
      if (clipAudioRef.current !== clip || audioRequestRef.current !== requestId) return;
      clipAudioRef.current = null;
      setIsPlaying(false);
      playFallback();
    };

    clip.oncanplay = () => {
      try {
        clip.playbackRate = speechRate;
      } catch {
        // ignore
      }
    };

    clip.src = url;
    clip.play().catch((err) => {
      if (clipAudioRef.current !== clip || audioRequestRef.current !== requestId) return;
      clipAudioRef.current = null;
      setIsPlaying(false);
      if (err?.name !== "AbortError") playFallback();
    });
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speechRate;
    if (clipAudioRef.current) clipAudioRef.current.playbackRate = speechRate;
  }, [speechRate]);

  useEffect(() => {
    return () => {
      clearClipStopMonitor();
      if (sentenceStopRafRef.current !== null) {
        cancelAnimationFrame(sentenceStopRafRef.current);
      }
      if (primaryTrackingRafRef.current !== null) {
        cancelAnimationFrame(primaryTrackingRafRef.current);
      }
      clipAudioRef.current?.pause();
      clipAudioRef.current = null;
    };
  }, []);

  const clearClipStopMonitor = () => {
    if (clipStopRafRef.current !== null) {
      cancelAnimationFrame(clipStopRafRef.current);
      clipStopRafRef.current = null;
    }
  };

  const getWordTime = (word: any, fallbackIndex: number) => {
    const value = Number(word?.timeSeconds ?? word?.startTime ?? fallbackIndex * 2);
    return Number.isFinite(value) ? value : fallbackIndex * 2;
  };

  const getWordEndTime = (index: number, start: number) => {
    const nextWord = words[index + 1];
    const rawEnd = nextWord
      ? getWordTime(nextWord, index + 1)
      : start + (isPrimaryContent ? 10 : 2.5);
    return Math.max(start + 0.1, rawEnd - (isPrimaryContent ? 0.5 : sentenceStopMarginSeconds));
  };

  const getSentenceEndTime = (sentence: any, start: number, nextSentence?: any) => {
    const explicitEnd = Number(sentence?.endTime);
    if (isPrimaryContent && Number.isFinite(explicitEnd) && explicitEnd > start) {
      return Math.max(start + 0.1, explicitEnd);
    }
    const nextStart = nextSentence ? getSentenceTime(nextSentence) : Infinity;
    return Number.isFinite(nextStart)
      ? Math.max(start + 0.1, nextStart - sentenceStopMarginSeconds)
      : Infinity;
  };

  const getManifestAudioUrl = (rawUrl: any) => {
    // The backend manifest is the source of truth. Do not reconstruct an URL
    // from an array index: reordering content must never play another item.
    if (typeof rawUrl === "string" && /^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }
    return null;
  };

  const granularSentenceUrls = useMemo(
    () => sentences.map((sentence: any) => getManifestAudioUrl(sentence?.audioUrl || sentence?.audio_url)),
    [sentences],
  );
  const hasGranularSentenceAudio = granularSentenceUrls.some(Boolean);

  const findNextPlayableSentence = (fromIndex: number) => {
    for (let index = Math.max(0, fromIndex); index < granularSentenceUrls.length; index++) {
      if (granularSentenceUrls[index]) return index;
    }
    return -1;
  };

  // Unified sentence TTS player for ALL articles (Primary Advantage + Reading Advantage)
  const playSentence = (sentenceIndex: number) => {
    const targetSentence = sentences[sentenceIndex] as any;
    if (!targetSentence && targetSentence !== "") return;

    const sentenceText = typeof targetSentence === "object" ? (targetSentence.sentences || targetSentence.text || targetSentence.sentence || "") : String(targetSentence);
    const articleId = articleData?.id;
    const rawUrl = typeof targetSentence === "object" ? (targetSentence.audioUrl || targetSentence.audio_url) : null;
    const granularUrl = getManifestAudioUrl(rawUrl);

    setActiveIdx(sentenceIndex);
    if (phase === LESSON_PHASE.READ_ARTICLE && granularUrl && audioRef.current) {
      playGranularArticleSentence(sentenceIndex, false);
      return;
    }
    playClipUrl(granularUrl, sentenceText);
  };

  // Unified word TTS player for ALL articles (Primary Advantage + Reading Advantage)
  const playWord = (index: number) => {
    const targetWord = words[index] as any;
    if (!targetWord && targetWord !== "") return;

    const wordText = typeof targetWord === "object" ? (targetWord.vocabulary || targetWord.word || targetWord.text || "") : String(targetWord);
    const articleId = articleData?.id;
    const rawUrl = typeof targetWord === "object" ? (targetWord.audioUrl || targetWord.audio_url) : null;
    const granularUrl = getManifestAudioUrl(rawUrl);

    setActiveWordIdx(index);
    playClipUrl(granularUrl, wordText);
  };

  const playGranularArticleSentence = (sentenceIndex: number, autoAdvance = false) => {
    const audio = audioRef.current;
    const playableIndex = findNextPlayableSentence(sentenceIndex);
    const url = granularSentenceUrls[playableIndex];
    if (!audio || !url) return false;

    const requestId = ++audioRequestRef.current;
    primarySentencePlaybackTokenRef.current++;
    clearSentenceStopMonitor();
    clipAudioRef.current?.pause();
    audio.pause();
    audio.currentTime = 0;
    audio.src = url;
    audio.load();
    audio.playbackRate = speechRate;
    stopAtRef.current = Infinity;
    granularAutoAdvanceRef.current = autoAdvance;
    setActiveIdx(playableIndex);
    setActiveWordIdx(-1);
    activeSentenceRef.current = playableIndex;
    activeWordRef.current = -1;
    setCurrentTime(0);
    setDuration(0);
    const start = () => {
      audio.removeEventListener("canplay", start);
      audio.removeEventListener("loadedmetadata", start);
      if (audioRequestRef.current !== requestId || audioRef.current !== audio) return;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          if (audioRequestRef.current === requestId && audioRef.current === audio) {
            setIsPlaying(true);
          }
        })
        .catch((err) => {
          if (audioRequestRef.current === requestId && audioRef.current === audio) {
            if (err?.name !== "AbortError") {
              setIsPlaying(false);
            }
          }
        });
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      start();
    } else {
      audio.addEventListener("canplay", start, { once: true });
      audio.addEventListener("loadedmetadata", start, { once: true });
    }
    return true;
  };

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  const clearSentenceStopMonitor = () => {
    clearAutoAdvanceTimer();
    if (sentenceStopRafRef.current !== null) {
      cancelAnimationFrame(sentenceStopRafRef.current);
      sentenceStopRafRef.current = null;
    }
  };

  const stopSingleSentencePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = stopAtRef.current;
    stopAtRef.current = Infinity;
    clearSentenceStopMonitor();
    setIsPlaying(false);
  };

  const startSentenceStopMonitor = () => {
    clearSentenceStopMonitor();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || stopAtRef.current === Infinity || audio.paused) {
        sentenceStopRafRef.current = null;
        return;
      }
      if (audio.currentTime >= stopAtRef.current) {
        stopSingleSentencePlayback();
        return;
      }
      sentenceStopRafRef.current = requestAnimationFrame(tick);
    };
    sentenceStopRafRef.current = requestAnimationFrame(tick);
  };

  const startPrimarySentenceStopMonitor = (token: number, endTime: number) => {
    clearSentenceStopMonitor();
    const tick = () => {
      const audio = audioRef.current;
      if (
        !audio ||
        audio.paused ||
        token !== primarySentencePlaybackTokenRef.current
      ) {
        sentenceStopRafRef.current = null;
        return;
      }
      if (audio.currentTime >= endTime) {
        audio.pause();
        audio.currentTime = endTime;
        stopAtRef.current = Infinity;
        setCurrentTime(endTime);
        setIsPlaying(false);
        sentenceStopRafRef.current = null;
        return;
      }
      sentenceStopRafRef.current = requestAnimationFrame(tick);
    };
    sentenceStopRafRef.current = requestAnimationFrame(tick);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);

      if (hasGranularSentenceAudio) return;

    if (t >= stopAtRef.current) {
      stopSingleSentencePlayback();
      return;
    }

    // Primary tracks sentence/word highlighting via requestAnimationFrame in
    // its ArticleContent hook. Let that loop be the sole source of truth here
    // as well; the browser timeupdate event is too coarse for word timing.
    if (isPrimaryContent) return;

    const idx = findSentenceIndexAtTime(t);
    if (idx !== activeIdx) setActiveIdx(idx);

    if (isSeekingRef.current) return;
  };

  const findSentenceIndexAtTime = (time: number) => {
    let idx = -1;
    for (let i = 0; i < sentences.length; i++) {
      const ts = getSentenceTime(sentences[i]);
      if (ts <= time + 0.05) idx = i;
      else break;
    }
    return idx;
  };

  const findPrimaryAudioPosition = useCallback((time: number) => {
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
      const sentence = sentences[sentenceIndex] as any;
      const start = getSentenceTime(sentence);
      const end = Number(sentence?.endTime);
      if (time < start || (Number.isFinite(end) && time > end)) continue;

      const timedWords = getTimedWords(sentence);
      for (let wordIndex = 0; wordIndex < timedWords.length; wordIndex++) {
        const wordStart = getTimedWordStart(timedWords[wordIndex]);
        const wordEnd = getTimedWordEnd(timedWords[wordIndex]);
        if (Number.isFinite(wordStart) && Number.isFinite(wordEnd) && time >= wordStart && time < wordEnd) {
          return { sentenceIndex, wordIndex };
        }
      }

      // This gap behaviour is copied from Primary's useAudioPlayer: keep a
      // nearby word highlighted only within 0.3 seconds of its timestamp.
      let closestWordIndex = -1;
      let minDistance = Infinity;
      for (let wordIndex = 0; wordIndex < timedWords.length; wordIndex++) {
        const wordStart = getTimedWordStart(timedWords[wordIndex]);
        const wordEnd = getTimedWordEnd(timedWords[wordIndex]);
        if (!Number.isFinite(wordStart) || !Number.isFinite(wordEnd)) continue;
        const distance = time < wordStart ? wordStart - time : time - wordEnd;
        if (distance < minDistance) {
          minDistance = distance;
          closestWordIndex = wordIndex;
        }
      }
      return {
        sentenceIndex,
        wordIndex: minDistance < 0.3 ? closestWordIndex : -1,
      };
    }
    return { sentenceIndex: -1, wordIndex: -1 };
  }, [sentences]);

  // Exact Primary article-reader tracking model: requestAnimationFrame reads
  // the full-article MP3 timeline and drives sentence and word highlights.
  useEffect(() => {
    if (!isPrimaryContent || hasGranularSentenceAudio || phase !== LESSON_PHASE.READ_ARTICLE || !isPlaying) return;

    const track = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        primaryTrackingRafRef.current = null;
        return;
      }

      const time = audio.currentTime;
      const { sentenceIndex, wordIndex } = findPrimaryAudioPosition(time);
      const previousSentence = activeSentenceRef.current;
      const effectiveSentence =
        sentenceIndex === -1 && previousSentence !== -1
          ? previousSentence
          : sentenceIndex;
      const effectiveWord =
        wordIndex === -1
          ? effectiveSentence !== previousSentence
            ? -1
            : activeWordRef.current
          : wordIndex;

      setCurrentTime(time);
      if (effectiveSentence !== previousSentence) {
        activeSentenceRef.current = effectiveSentence;
        setActiveIdx(effectiveSentence);
      }
      if (effectiveWord !== activeWordRef.current) {
        activeWordRef.current = effectiveWord;
        setActiveWordIdx(effectiveWord);
      }
      primaryTrackingRafRef.current = requestAnimationFrame(track);
    };

    primaryTrackingRafRef.current = requestAnimationFrame(track);
    return () => {
      if (primaryTrackingRafRef.current !== null) {
        cancelAnimationFrame(primaryTrackingRafRef.current);
        primaryTrackingRafRef.current = null;
      }
    };
  }, [isPrimaryContent, hasGranularSentenceAudio, phase, isPlaying, findPrimaryAudioPosition]);

  const playAudioSentenceFallback = (sentenceIdx: number) => {
    const audio = audioRef.current;
    const item = sentences[sentenceIdx];
    if (!audio || !item) {
      setIsPlaying(false);
      return;
    }

    const requestId = ++audioRequestRef.current;
    const start = Math.max(0, getSentenceTime(item));
    if (isPrimaryContent) {
      // In the Interactive reader, selecting a sentence is intentionally a
      // single-sentence action (unlike Primary's Play-all control). Use the
      // original PA timeline exactly, including its explicit endTime.
      const end = getSentenceEndTime(item, start, sentences[sentenceIdx + 1]);
      const playbackToken = ++primarySentencePlaybackTokenRef.current;
      stopAtRef.current = end;
      clearSentenceStopMonitor();
      clipAudioRef.current?.pause();
      audio.pause();
      audio.playbackRate = speechRate;
      const position = findPrimaryAudioPosition(start);
      activeSentenceRef.current = sentenceIdx;
      activeWordRef.current = position.wordIndex;
      setActiveIdx(sentenceIdx);
      setActiveWordIdx(position.wordIndex);
      audio.currentTime = start;
      setCurrentTime(start);
      audio
        .play()
        .then(() => {
          if (
            playbackToken !== primarySentencePlaybackTokenRef.current ||
            requestId !== audioRequestRef.current
          ) return;
          setIsPlaying(true);
          startPrimarySentenceStopMonitor(playbackToken, end);
        })
        .catch(() => {
          if (
            playbackToken !== primarySentencePlaybackTokenRef.current ||
            requestId !== audioRequestRef.current
          ) return;
          stopAtRef.current = Infinity;
          setIsPlaying(false);
        });
      return;
    }
    const nextItem = sentences[sentenceIdx + 1];
    const sentenceEnd = getSentenceEndTime(item, start, nextItem);
    const nextStart = Number.isFinite(sentenceEnd)
      ? sentenceEnd
      : Number.isFinite(duration) && duration > start
        ? duration
        : Infinity;

    stopAtRef.current = nextStart;
    clearSentenceStopMonitor();
    clipAudioRef.current?.pause();
    audio.pause();
    audio.playbackRate = speechRate;
    audio.currentTime = start;
    setCurrentTime(start);
    setIsPlaying(true);
    audio
      .play()
      .then(() => {
        if (requestId !== audioRequestRef.current || audioRef.current !== audio) return;
        startSentenceStopMonitor();
      })
      .catch(() => {
        if (requestId !== audioRequestRef.current || audioRef.current !== audio) return;
        stopAtRef.current = Infinity;
        clearSentenceStopMonitor();
        setIsPlaying(false);
      });
  };

  const seekToSentence = (sentenceIdx: number) => {
    if (hasGranularSentenceAudio && granularSentenceUrls[sentenceIdx]) {
      playGranularArticleSentence(sentenceIdx, false);
      return;
    }

    const requestId = ++audioRequestRef.current;
    const item = sentences[sentenceIdx];
    if (!item) return;
    const ts = getSentenceTime(item);

    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentTime(ts);
    isSeekingRef.current = false;
    activeSentenceRef.current = sentenceIdx;
    activeWordRef.current = -1;
    setActiveIdx(sentenceIdx);
    setActiveWordIdx(-1);

    if (requestId === audioRequestRef.current) {
      playAudioSentenceFallback(sentenceIdx);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRequestRef.current++;
      primarySentencePlaybackTokenRef.current++;
      clearSentenceStopMonitor();
      audioRef.current.pause();
      clipAudioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (hasGranularSentenceAudio) {
        const currentIndex = activeIdx >= 0 ? activeIdx : 0;
        const firstPlayableIndex = findNextPlayableSentence(currentIndex);
        if (firstPlayableIndex >= 0) {
          playGranularArticleSentence(firstPlayableIndex, true);
        }
        return;
      }
      const requestId = ++audioRequestRef.current;
      primarySentencePlaybackTokenRef.current++;
      clipAudioRef.current?.pause();
      stopAtRef.current = Infinity; // always continuous when pressing Play
      clearSentenceStopMonitor();
      audioRef.current.playbackRate = speechRate;
      audioRef.current
        .play()
        .then(() => {
          if (requestId === audioRequestRef.current) setIsPlaying(true);
        })
        .catch(() => {
          if (requestId === audioRequestRef.current) setIsPlaying(false);
        });
    }
  };

  // Auto-scroll active sentence into view in Phase 3 (Read the Article)
  useEffect(() => {
    if (phase !== LESSON_PHASE.READ_ARTICLE || activeIdx < 0) return;
    const el = document.getElementById(`read-sentence-${activeIdx}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx, phase]);

  const lastReportedIdxRef = useRef(-2);
  useEffect(() => {
    if (
      phase === LESSON_PHASE.READ_ARTICLE &&
      onActiveIdxChange &&
      activeIdx !== lastReportedIdxRef.current
    ) {
      lastReportedIdxRef.current = activeIdx;
      onActiveIdxChange(activeIdx);
    }
  }, [activeIdx, phase, onActiveIdxChange]);

  // Auto-translate vocab words and English definitions
  useEffect(() => {
    if (phase !== LESSON_PHASE.VOCABULARY_CONTEXT) return;

    // 1. Find words missing a short Thai translation (definition.th)
    const missingTh: { index: number; text: string }[] = [];
    words.forEach((item: any, i: number) => {
      const wordText =
        typeof item === "object"
          ? item.vocabulary || item.word || item.text
          : item;
      const hasTh = typeof item === "object" && item.definition?.th;
      if (!hasTh && wordText) {
        missingTh.push({ index: i, text: String(wordText) });
      }
    });

    // 2. Find words with English definitions (definition.en) to translate to Thai explanations
    const missingEnTh: { index: number; text: string }[] = [];
    words.forEach((item: any, i: number) => {
      const enText =
        typeof item === "object" && item.definition?.en
          ? item.definition.en
          : null;
      if (enText) {
        missingEnTh.push({ index: i, text: enText });
      }
    });

    // Fetch short word translations if any missing
    if (missingTh.length > 0) {
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: missingTh.map((m) => m.text) }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.translations) return;
          const map: Record<number, string> = {};
          missingTh.forEach((m, j) => {
            map[m.index] = data.translations[j];
          });
          setAutoVocabTh((prev) => ({ ...prev, ...map }));
        })
        .catch(() => {});
    }

    // Fetch definition explanation translations if any
    if (missingEnTh.length > 0) {
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: missingEnTh.map((m) => m.text) }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.translations) return;
          const map: Record<number, string> = {};
          missingEnTh.forEach((m, j) => {
            map[m.index] = data.translations[j];
          });
          setAutoVocabEnTh(map);
        })
        .catch(() => {});
    }
  }, [phase, words]);

  if (!articleData) {
    return (
      <div className="flex flex-1 items-center justify-center text-base text-fg-muted">
        {t("lesson.interactive.articleLoading")}
      </div>
    );
  }

  const renderThaiPassageCard = (
    className = "",
    textClassName = "text-fg text-base leading-relaxed",
    titleClassName = "text-fg-muted",
  ) => {
    if (!thaiPassage && !translatingArticle) return null;

    return (
      <div
        className={`rounded-lg border border-hairline bg-surface-muted p-4 ${className}`}
      >
        <p
          className={`mb-1.5 text-sm font-medium ${titleClassName}`}
        >
          {t("lesson.live.thaiTranslation")}
        </p>
        {thaiPassage ? (
          <p className={textClassName}>
            {thaiPassage}
          </p>
        ) : (
          <p className={`${textClassName} italic opacity-80`}>
            {t("lesson.live.translating")}
          </p>
        )}
      </div>
    );
  };

  /* ─── Phase 1: Introduction ──────────────────────────────── */
  if (phase === LESSON_PHASE.LAUNCH) {
    const checklist = [
      { icon: MessageCircle, tone: "blue" as const, title: t("lesson.interactive.introChecklistIntroduceTitle"), desc: t("lesson.interactive.introChecklistIntroduceDesc") },
      { icon: Target, tone: "amber" as const, title: t("lesson.interactive.introChecklistGoalTitle"), desc: t("lesson.interactive.introChecklistGoalDesc") },
      { icon: Sparkles, tone: "purple" as const, title: t("lesson.interactive.introChecklistSparkTitle"), desc: t("lesson.interactive.introChecklistSparkDesc") },
    ];
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-stretch gap-6 py-2 lg:flex-row lg:items-center">
        {/* Left: article cover */}
        <div className="relative w-full shrink-0 overflow-hidden rounded-xl border border-hairline bg-tile-brand lg:w-[44%]">
          <div className="aspect-[4/3] w-full">
            {articleImageUrl && !launchImageFailed ? (
              <img
                src={articleImageUrl}
                alt={articleData.title}
                className="size-full object-cover"
                onError={() => setLaunchImageFailed(true)}
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <BookOpen aria-hidden="true" className="size-20 text-icon-brand" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline bg-surface">
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-fg-muted">{t("lesson.interactive.vocabulary")}</p>
              <p className="text-2xl font-bold tabular-nums text-fg">{words.length}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-fg-muted">{t("lesson.interactive.keySentences")}</p>
              <p className="text-2xl font-bold tabular-nums text-fg">{sentences.length}</p>
            </div>
          </div>
        </div>

        {/* Right: title + tutor checklist */}
        <div data-tour-target="phase-1-overview" className="flex flex-1 flex-col justify-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {articleData.genre ? <Chip>{String(articleData.genre)}</Chip> : null}
            {articleData?.content_provider !== "PRIMARY_ADVANTAGE" && displayCefr ? <Chip tone="brand">CEFR {displayCefr}</Chip> : null}
          </div>
          <h1 className="text-3xl font-bold leading-tight text-fg xl:text-4xl">{articleData.title}</h1>
          <p className="line-clamp-3 text-lg leading-relaxed text-fg-muted">
            {articleData.translated_summary?.th?.[0] ||
              articleData.summary ||
              t("lesson.interactive.articleFallbackSummary")}
          </p>

          <ol data-tour-target="phase-1-checklist" className="mt-1 flex flex-col gap-2.5">
            {checklist.map((item) => (
              <li key={item.title} className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4">
                <IconTile icon={item.icon} tone={item.tone} size="lg" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-fg">{item.title}</p>
                  <p className="text-base text-fg-muted">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  /* ─── Phase 3 (Read the Article) is rendered by the audio reader block below ─── */

  /* ─── Phase 4: Vocabulary Focus ──────────────────────────── */
  if (phase === LESSON_PHASE.VOCABULARY_CONTEXT) {
    const vocabWords: string[] = words.map((w: any) =>
      typeof w === "object"
        ? w.vocabulary || w.word || w.text || ""
        : String(w),
    );

    const highlightPassage = (text: string) => {
      if (!text) return null;
      const parts = text.split(/(\s+)/);
      return parts.map((part, i) => {
        const clean = part.replace(/[.,!?;:"'()]/g, "").toLowerCase();
        const match = vocabWords.find((v) => v.toLowerCase() === clean);
        if (match) {
          return (
            <mark
              key={i}
              className="bg-[var(--highlight-bg)] text-[var(--highlight-text)] font-bold rounded px-0.5 not-italic"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      });
    };

    return (
      <div
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center ${
          isFullscreen ? "px-5 py-4 pb-32" : "px-2 py-4 sm:px-3"
        }`}
      >
        <p className={`w-full text-base text-fg-muted ${isFullscreen ? "mb-2 hidden xl:block" : "mb-3"}`}>
          {t("lesson.interactive.wordPrefix")}{" "}
          <mark className="rounded bg-[var(--highlight-bg)] px-1 font-semibold text-[var(--highlight-text)]">highlight</mark>{" "}
          {t("lesson.interactive.vocabInLessonSuffix")}
        </p>

        <div
          className={`grid w-full min-h-0 flex-1 grid-cols-1 items-stretch gap-4 ${
            isFullscreen
              ? "lg:grid-cols-[1.08fr_1fr]"
              : "lg:grid-cols-[1.12fr_1fr]"
          }`}
        >
          {/* Passage with highlights */}
          <div
            ref={phase5PassageRef}
            data-tour-target="phase-4-passage"
            className={`flex min-h-0 flex-col rounded-xl border border-hairline bg-surface shadow-card ${
              isFullscreen ? "h-full overflow-hidden p-4" : "overflow-y-auto p-5 sm:p-6"
            }`}
          >
            <h3 className={`flex items-center gap-2 text-base font-semibold text-fg ${isFullscreen ? "mb-2" : "mb-3"}`}>
              <BookOpen aria-hidden="true" className="size-5 text-brand-fg" />
              {t("lesson.live.readingPassage")}
            </h3>
            <p
              className={isFullscreen
                ? "flex-1 text-[clamp(15px,1.15vw,21px)] font-medium leading-[1.82] text-fg"
                : "text-lg font-medium leading-[1.9] text-fg xl:text-xl"}
              style={{ fontFamily: "Georgia, serif" }}
            >
              {highlightPassage(articleData.passage)}
            </p>
            <div className={isFullscreen ? "pt-3" : "pt-5"}>
              {renderThaiPassageCard(
                isFullscreen ? "p-3" : "",
                isFullscreen
                  ? "text-[clamp(12px,0.85vw,15px)] leading-[1.72] text-fg"
                  : undefined,
              )}
            </div>
          </div>

          {/* Vocab sidebar */}
          <div
            ref={phase5VocabRef}
            data-tour-target="phase-4-vocabulary"
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface p-4 shadow-card sm:p-5"
          >
            <h3 className={`flex items-center gap-2 text-base font-semibold text-fg ${isFullscreen ? "mb-2" : "mb-3"}`}>
              <ListChecks aria-hidden="true" className="size-5 text-brand-fg" />
              {t("lesson.live.vocabularyList")} <span className="font-normal text-fg-muted">({words.length})</span>
            </h3>
            <div
              className={isFullscreen
                ? "grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-hidden"
                : "flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1"}
            >
              {words.map((item: any, i: number) => {
                const wordText =
                  typeof item === "object"
                    ? item.vocabulary || item.word || item.text
                    : item;
                const defTh =
                  typeof item === "object" && item.definition
                    ? item.definition.th || autoVocabTh[i] || null
                    : autoVocabTh[i] || null;
                const defEn =
                  typeof item === "object" && item.definition
                    ? item.definition.en
                    : null;
                const partOfSpeech =
                  typeof item === "object"
                    ? item.partOfSpeech || item.part_of_speech || item.pos
                    : null;
                return (
                  <div
                    key={i}
                    className={`relative grid min-h-[88px] gap-x-3 rounded-lg border border-hairline bg-surface-muted px-3 py-3 ${
                      isFullscreen
                        ? "h-full min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] content-center"
                        : "shrink-0 grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_minmax(0,1fr)_minmax(180px,.9fr)_auto] sm:items-center sm:px-4"
                    }`}
                  >
                    <span
                      className={isFullscreen
                        ? "absolute left-3 top-3 inline-flex size-6 items-center justify-center rounded-full bg-brand-solid text-xs font-semibold text-on-brand"
                        : "mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-brand-solid text-xs font-semibold text-on-brand sm:mt-0"}
                    >
                      {i + 1}
                    </span>
                    <div className={`min-w-0 ${isFullscreen ? "col-span-2 col-start-1 pl-8 pr-2" : "sm:pr-4"}`}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="break-words text-lg font-bold text-fg">
                          {String(wordText)}
                        </p>
                        {partOfSpeech && (
                          <span className="text-sm text-fg-muted">
                            ({String(partOfSpeech)})
                          </span>
                        )}
                      </div>
                      {defEn && (
                        <p className={`mt-1 break-words text-sm text-fg-muted ${isFullscreen ? "leading-snug" : "leading-relaxed"}`}>
                          {defEn}
                        </p>
                      )}
                    </div>
                    <div
                      className={isFullscreen
                        ? "col-span-2 col-start-1 mt-1 min-w-0 border-t border-hairline pl-8 pt-1.5 pr-2"
                        : "col-start-2 mt-2 min-w-0 border-t border-hairline pt-2 sm:col-start-auto sm:mt-0 sm:border-l sm:border-t-0 sm:py-1 sm:pl-5"}
                    >
                      {defTh && (
                        <p className="break-words text-base font-semibold text-brand-fg">
                          {defTh}
                        </p>
                      )}
                      {autoVocabEnTh[i] && (
                        <p className={`mt-1 break-words text-sm text-fg-muted ${isFullscreen ? "leading-snug" : "leading-relaxed"}`}>
                          {autoVocabEnTh[i]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => playWord(i)}
                      data-tour-target={i === 0 ? "phase-4-first-audio" : undefined}
                      title={t("lesson.interactive.speakTitle")}
                      aria-label={`${t("lesson.interactive.speakTitle")} ${String(wordText)}`}
                      className={isFullscreen
                        ? "absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand-fg transition-colors hover:bg-brand-soft/70"
                        : "col-start-3 row-start-1 inline-flex size-10 items-center justify-center self-center rounded-full bg-brand-soft text-brand-fg transition-colors hover:bg-brand-soft/70 sm:col-start-auto sm:row-start-auto"}
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 5: Deep Reading ──────────────────────────────── */
  if (phase === LESSON_PHASE.DEEP_READING) {
    const comprehensionQuestions =
      articleData.shortAnswerQuestions?.slice(0, 3) || [];
    const getQuestionAudioUrl = (question: string, questionData: any) => {
      const questionKey = String(question || "").trim().toLowerCase();
      const manifestQuestion = Array.isArray((articleData as any)?.audio_manifest?.questions)
        ? (articleData as any).audio_manifest.questions.find(
          (item: any) => String(item?.text || "").trim().toLowerCase() === questionKey,
        )
        : undefined;
      return manifestQuestion?.questionAudioUrl || questionData?.questionAudioUrl || questionData?.audioUrl;
    };

    return (
      <div
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center ${
          isFullscreen ? "px-5 py-4 pb-32" : "px-2 py-4 sm:px-3"
        }`}
      >

        <div className="grid w-full min-h-0 flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,.85fr)]">
          {/* Passage */}
          <div className="min-h-0 min-w-0">
            <div data-tour-target="phase-5-passage" className={`flex h-full min-h-0 flex-col rounded-xl border border-hairline bg-surface shadow-card ${isFullscreen ? "overflow-hidden p-5" : "p-5 sm:p-6"}`}>
              <h3 className={`flex items-center gap-2 text-base font-semibold text-fg ${isFullscreen ? "mb-2" : "mb-3"}`}>
                <BookOpen aria-hidden="true" className="size-5 text-brand-fg" />
                {articleData.title}
              </h3>
              <p
                className={isFullscreen
                  ? "flex-1 text-[clamp(15px,1.06vw,20px)] font-medium leading-[1.82] text-fg"
                  : "text-lg font-medium leading-[1.9] text-fg xl:text-xl"}
                style={{ fontFamily: "Georgia, serif" }}
              >
                {articleData.passage}
              </p>
              {renderThaiPassageCard(
                isFullscreen ? "mt-3 p-3" : "mt-5",
                isFullscreen ? "text-[clamp(12px,0.82vw,15px)] leading-[1.7] text-fg" : undefined,
              )}
            </div>
          </div>

          {/* Comprehension Guide */}
          <div className={`flex min-h-0 min-w-0 flex-col ${isFullscreen ? "gap-3" : "space-y-4"}`}>
            <div data-tour-target="phase-5-questions" className={`flex min-h-0 flex-1 flex-col rounded-xl border border-hairline bg-surface-muted ${isFullscreen ? "p-4" : "p-4"}`}>
              <h4 className="mb-1 flex items-center gap-2 text-base font-semibold text-fg">
                <ListChecks aria-hidden="true" className="size-5 text-brand-fg" />
                {t("lesson.live.comprehensionGuide")}
              </h4>
              <p className={`text-fg-muted ${isFullscreen ? "mb-3 text-sm" : "mb-3 text-sm"}`}>
                {t("lesson.interactive.comprehensionGuideHelp")}
              </p>
              {comprehensionQuestions.length > 0 ? (
                <div className={isFullscreen ? "grid min-h-0 flex-1 grid-rows-3 gap-2" : "space-y-3"}>
                  {comprehensionQuestions.map((q: any, i: number) => (
                    <GuideQuestionCard
                      key={i}
                      label={`Q${i + 1}`}
                      question={q.question}
                      onSpeak={() => playClipUrl(getQuestionAudioUrl(q.question, q), q.question)}
                      dataTourTarget={i === 0 ? "phase-5-first-question" : undefined}
                      className={isFullscreen ? "h-full" : ""}
                      large={isFullscreen}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-fg-muted">
                  {t("lesson.interactive.comprehensionFallback")}
                </p>
              )}
            </div>

            <div className={`rounded-xl border border-hairline bg-surface ${isFullscreen ? "p-4" : "p-4"}`}>
              <h4 className="mb-2 flex items-center gap-2 text-base font-semibold text-fg">
                <Lightbulb aria-hidden="true" className="size-5 text-icon-amber" />
                {t("lesson.live.tutorActions")}
              </h4>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted marker:text-fg-subtle">
                <li>{t("lesson.interactive.tutorActionReadAloud")}</li>
                <li>{t("lesson.interactive.tutorActionExplainContext")}</li>
                <li>{t("lesson.interactive.tutorActionUnderline")}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 6: Key Sentences ─────────────────────────────── */
  if (phase === LESSON_PHASE.KEY_SENTENCES) {
    const sentenceColors = ["border-l-brand-vivid bg-surface"];
    const dotColors = ["bg-brand-solid"];

    const getSentenceText = (item: any) =>
      String(typeof item === "object" ? item.sentences || "" : item || "");

    const escapeRegExp = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const getWordCount = (text: string) =>
      text.trim().split(/\s+/).filter(Boolean).length;

    // Extract vocab word list and prefer meaningful terms over tiny substrings.
    const vocabWords: string[] = Array.from(
      new Set(
        words
          .map((w: any) =>
            (typeof w === "object"
              ? w.vocabulary || w.word || w.text || ""
              : String(w)
            )
              .toLowerCase()
              .trim(),
          )
          .filter((word: string) => word.length >= 3),
      ),
    );

    const vocabPatterns = vocabWords.map((word) => ({
      word,
      pattern: new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"),
    }));

    const keySentenceLimit = Math.min(
      5,
      Math.max(2, Math.ceil(sentences.length * 0.35)),
    );

    // Score sentences by vocab coverage and teachability, then keep a compact set.
    const scoredKeySentences: Array<{
      item: any;
      index: number;
      score: number;
    }> = sentences.map((item: any, index: number) => {
      const sentenceText = getSentenceText(item);
      const matchedVocab = vocabPatterns.filter(({ pattern }) =>
        pattern.test(sentenceText),
      );
      const wordCount = getWordCount(sentenceText);
      const readableLengthBonus =
        wordCount >= 8 && wordCount <= 28 ? 1 : wordCount < 5 ? -1 : 0;

      return {
        item,
        index,
        score:
          matchedVocab.length * 3 +
          matchedVocab.length / Math.max(wordCount, 1) +
          readableLengthBonus,
      };
    });

    const selectedKeySentences = scoredKeySentences
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, keySentenceLimit)
      .sort((a, b) => a.index - b.index)
      .map(({ item, index }) => ({ item, index }));
    const keySentences = selectedKeySentences.length > 0
      ? selectedKeySentences
      : scoredKeySentences
          .filter(({ item }) => Boolean(getSentenceText(item).trim()))
          .slice(0, keySentenceLimit)
          .map(({ item, index }) => ({ item, index }));

    // Helper: highlight vocab words inside a sentence
    const highlightVocab = (text: string) => {
      const parts = text.split(/(\s+)/);
      return parts.map((part, i) => {
        const clean = part.replace(/[.,!?;:"'()]/g, "").toLowerCase();
        if (vocabPatterns.some(({ word }) => word === clean)) {
          return (
            <mark
              key={i}
              className="bg-[var(--highlight-bg)] text-[var(--highlight-text)] font-bold rounded px-0.5 not-italic"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      });
    };

    return (
      <div
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center ${
          isFullscreen ? "px-5 py-4 pb-32" : "px-2 py-4 sm:px-3"
        }`}
      >
        {isPrimaryContent && readingAdvantageAudioUrl && (
          <audio
            ref={primaryArticleAudioRef}
            src={readingAdvantageAudioUrl}
            preload="auto"
            onEnded={() => setIsPlaying(false)}
          />
        )}

        <div className="grid w-full min-h-0 flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <div data-tour-target="phase-6-sentences" className={`min-h-0 min-w-0 ${isFullscreen ? "flex h-full flex-col" : ""}`}>
            <h3 className={`flex items-center gap-2 text-base font-semibold text-fg ${isFullscreen ? "mb-2" : "mb-3"}`}>
              <ListChecks aria-hidden="true" className="size-5 text-brand-fg" />
              {t("lesson.interactive.keySentences")}
              <span className="font-normal text-fg-muted">
                · {keySentences.length} {t("lesson.interactive.keySentenceCountSuffix")}
              </span>
            </h3>
            <div className={`relative min-h-0 ${isFullscreen ? "flex-1 overflow-hidden" : "lg:max-h-[68vh] lg:overflow-y-auto lg:pr-2"}`}>
              <div
                className={isFullscreen ? "grid h-full gap-3" : "space-y-4"}
                style={isFullscreen ? { gridTemplateRows: `repeat(${Math.max(keySentences.length, 1)}, minmax(0, 1fr))` } : undefined}
              >
                {keySentences.map(
                  ({ item, index: sentenceIndex }: any, index: number) => {
                    const sentenceText =
                      typeof item === "object" ? item.sentences : item;
                    const thaiText = thaiSentences[sentenceIndex];
                    const c = sentenceColors[index % sentenceColors.length];
                    const d = dotColors[index % dotColors.length];
                    return (
                      <div
                        key={index}
                        className={`relative flex gap-4 ${isFullscreen ? "min-h-0 items-stretch" : "items-start"}`}
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        {index < keySentences.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-[-0.75rem] w-0.5 bg-hairline-strong" />
                        )}
                        <div
                          className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${d} text-sm font-semibold text-on-brand`}
                        >
                          {index + 1}
                        </div>
                        <div
                          className={`flex-1 rounded-lg border border-hairline border-l-4 p-4 shadow-xs ${c} ${isFullscreen ? "min-h-0" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <p className={`min-w-0 flex-1 font-semibold text-fg ${isFullscreen ? "text-[clamp(15px,1vw,19px)] leading-snug" : "text-lg leading-relaxed"}`}>
                            {highlightVocab(String(sentenceText))}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playSentence(sentenceIndex);
                              }}
                              title={t("lesson.interactive.speakTitle")}
                              data-tour-target={index === 0 ? "phase-6-first-audio" : undefined}
                              aria-label={t("lesson.interactive.speakTitle")}
                              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg transition-colors hover:bg-brand-soft/70"
                            >
                              <Volume2 size={15} />
                            </button>
                          </div>
                          {thaiText && (
                            <p className={`mt-1.5 text-fg-muted ${isFullscreen ? "text-[clamp(13px,0.84vw,16px)] leading-snug" : "text-base leading-relaxed"}`}>
                              {thaiText}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
                {keySentences.length === 0 && (
                  <p className="pl-10 text-base text-fg-muted">
                    {t("lesson.interactive.noKeySentences")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Passage with context */}
          <div data-tour-target="phase-6-article" className={`min-h-0 min-w-0 ${isFullscreen ? "flex h-full flex-col" : ""}`}>
            <h3 className={`flex items-center gap-2 text-base font-semibold text-fg ${isFullscreen ? "mb-2" : "mb-3"}`}>
              <BookOpen aria-hidden="true" className="size-5 text-brand-fg" />
              {t("lesson.live.passageReference")}
            </h3>
            <div className={`rounded-xl border border-hairline bg-surface shadow-card ${isFullscreen ? "flex min-h-0 flex-1 flex-col overflow-hidden p-5" : "p-5 sm:p-6 lg:max-h-[62vh] lg:overflow-y-auto"}`}>
              <p className={isFullscreen ? "flex-1 text-[clamp(15px,1vw,19px)] leading-[1.8] text-fg" : "text-lg leading-[1.9] text-fg"}>
                {articleData.passage}
              </p>
              {renderThaiPassageCard(
                isFullscreen ? "mt-3 p-3" : "mt-5",
                isFullscreen
                  ? "text-[clamp(12px,0.78vw,15px)] leading-[1.65] text-fg"
                  : undefined,
              )}
            </div>
            <div className={`mt-3 flex gap-2.5 rounded-lg border border-hairline bg-surface-muted ${isFullscreen ? "p-3" : "p-4"}`}>
              <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-amber" />
              <p className="text-sm text-fg-muted">
                {t("lesson.interactive.keySentenceTip")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 3: Read the Article + Audio Player + Sentence Flag ──────────────── */
  if (phase === LESSON_PHASE.READ_ARTICLE) {
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const phase4AudioUrl = hasGranularSentenceAudio
      ? granularSentenceUrls.find(Boolean) || null
      : readingAdvantageAudioUrl;
    const fmtTime = (s: number) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const cycleSpeechRate = () => {
      const currentIndex = AUDIO_RATES.findIndex((rate) => rate === speechRate);
      const nextRate =
        AUDIO_RATES[(currentIndex + 1) % AUDIO_RATES.length] ?? AUDIO_RATES[0];
      setSpeechRate(nextRate);
      if (audioRef.current) audioRef.current.playbackRate = nextRate;
    };

    // Build paragraphs: split passage by newlines, then map each sentence to inline spans
    const rawParagraphs: string[] = (articleData.passage || "")
      .split(/\n+/)
      .map((p: string) => p.trim())
      .filter(Boolean);

    // Assign sentences to paragraphs by matching text content
    let sentIdx = 0;
    const paragraphGroups: { idx: number; text: string; ts: number }[][] =
      rawParagraphs.map((para) => {
        const group: { idx: number; text: string; ts: number }[] = [];
        while (sentIdx < sentences.length) {
          const item = sentences[sentIdx];
          const text = getSentenceText(item);
          const ts = getSentenceTime(item);
          const cleanText = text.replace(/^[""]|[""]$/g, "").trim();
          if (para.includes(cleanText) || para.includes(text.trim())) {
            group.push({ idx: sentIdx, text, ts });
            sentIdx++;
          } else {
            break;
          }
        }
        return group;
      });
    const mappedSentenceCount = paragraphGroups.reduce(
      (total, group) => total + group.length,
      0,
    );
    const readableParagraphGroups: { idx: number; text: string; ts: number }[][] =
      mappedSentenceCount === sentences.length
        ? paragraphGroups
        : [
            sentences.map((item: any, idx: number) => ({
              idx,
              text: getSentenceText(item),
              ts: getSentenceTime(item),
            })),
          ];

    const activeSentence = activeIdx >= 0 ? sentences[activeIdx] : null;
    const activeThText = activeIdx >= 0 ? thaiSentences[activeIdx] : null;
    const activeEnText = activeSentence ? getSentenceText(activeSentence) : null;
    const renderReadAlongText = (sentenceIndex: number, text: string) => {
      if (!isPrimaryContent) return text;

      let displayWordIndex = 0;
      return splitIntoDisplayParts(text).map((part, partIndex) => {
        const isWord = isDisplayWord(part);
        const wordIndex = isWord ? displayWordIndex++ : -1;
        const isCurrentWord =
          isWord &&
          sentenceIndex === activeIdx &&
          wordIndex ===
            (primaryWordMapsRef.current
              .get(sentenceIndex)
              ?.audioToDisplay.get(activeWordIdx) ?? activeWordIdx);

        // The outer sentence owns the click. Keeping these word spans visual-only
        // prevents a sentence click from becoming continuous word-level playback.
        return (
          <span
            key={partIndex}
            className={
              isWord
                ? `rounded transition-colors duration-150 ${
                    isCurrentWord && isPlaying
                      ? "bg-brand-solid text-on-brand px-0.5"
                      : ""
                  }`
                : undefined
            }
          >
            {part}
          </span>
        );
      });
    };
    const renderSentence = (idx: number, text: string) => {
      const canSelectSentence = hasGranularSentenceAudio || !isPrimaryContent || idx === 0;
      const isActive = idx === activeIdx;
      const flagCount = flagCounts?.[idx] || 0;
      const isFlagged = flagCount > 0;

      return (
        <span
          id={`read-sentence-${idx}`}
          key={idx}
          data-tour-target={idx === 0 ? "phase-3-first-sentence" : undefined}
          onClick={canSelectSentence ? () => seekToSentence(idx) : undefined}
          className={`${canSelectSentence ? "cursor-pointer" : "cursor-default"} rounded-lg px-0.5 transition-all duration-200 ${
            isActive
              ? "bg-[var(--highlight-bg)] text-[var(--highlight-text)] font-semibold px-1.5 py-0.5 rounded-md ring-2 ring-brand-vivid"
              : isFlagged
                ? "bg-danger-bg text-danger-fg font-semibold rounded-md px-1 ring-1 ring-danger-border"
                : canSelectSentence
                  ? "text-fg hover:bg-brand-soft"
                  : "text-fg"
          }`}
        >
          {renderReadAlongText(idx, text)}
          {isFlagged && (
            <sup className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-danger-solid px-1.5 py-0.5 align-super text-xs font-semibold text-white not-italic">
              🚩{flagCount}
            </sup>
          )}{" "}
        </span>
      );
    };
    // Primary stores most passages as one text block even though each article
    // has three illustrations. Preserve an existing three-paragraph layout;
    // otherwise divide the timed sentences into three reading pages.
    const primaryReadingGroups = (() => {
      if (readableParagraphGroups.length === 3) return readableParagraphGroups;
      if (readableParagraphGroups.length > 3) {
        return [
          ...readableParagraphGroups.slice(0, 2),
          readableParagraphGroups.slice(2).flat(),
        ];
      }

      const allSentences = readableParagraphGroups.flat();
      if (allSentences.length < 3) return readableParagraphGroups;
      return Array.from({ length: 3 }, (_, pageIndex) =>
        allSentences.slice(
          Math.floor((pageIndex * allSentences.length) / 3),
          Math.floor(((pageIndex + 1) * allSentences.length) / 3),
        ),
      );
    })();
    const activePrimaryPageIndex = primaryReadingGroups.findIndex((group) =>
      group.some(({ idx }) => idx === activeIdx),
    );
    const primaryReadingPageIndex = Math.max(0, activePrimaryPageIndex);
    const primaryReadingGroup =
      primaryReadingGroups[primaryReadingPageIndex] ?? primaryReadingGroups[0] ?? [];
    const primaryReadingImageUrl =
      primaryImageUrls[primaryReadingPageIndex] ?? articleImageUrl;
    const goToPrimaryPart = (direction: -1 | 1) => {
      const nextPart = Math.max(
        0,
        Math.min(primaryReadingGroups.length - 1, primaryReadingPageIndex + direction),
      );
      const firstSentence = primaryReadingGroups[nextPart]?.[0]?.idx;
      // Invalidate any pending play() promise before changing the visible
      // article part. A browser may resolve the old promise after pause(),
      // which would otherwise turn the new part's Play button back on.
      audioRequestRef.current++;
      primarySentencePlaybackTokenRef.current++;
      clearSentenceStopMonitor();
      clearClipStopMonitor();
      clipAudioRef.current?.pause();
      audioRef.current?.pause();
      granularAutoAdvanceRef.current = false;
      setIsPlaying(false);
      setActiveWordIdx(-1);
      if (typeof firstSentence === "number") {
        setActiveIdx(firstSentence);
        activeSentenceRef.current = firstSentence;
        activeWordRef.current = -1;
      }
    };

    return (
      <div className="relative flex w-full flex-1 flex-col">
        {/* Hidden audio */}
        {phase4AudioUrl && (
          <audio
            ref={audioRef}
            src={hasGranularSentenceAudio ? undefined : (readingAdvantageAudioUrl || undefined)}
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onSeeked={() => {
              isSeekingRef.current = false;
            }}
            onLoadedMetadata={() =>
              setDuration(audioRef.current?.duration || 0)
            }
            onEnded={() => {
              // The ended event invalidates any promise belonging to the
              // previous source before auto-advance starts another one.
              audioRequestRef.current++;
              primarySentencePlaybackTokenRef.current++;
              const completedSentenceIndex = activeSentenceRef.current;
              const nextPlayableSentenceIndex = findNextPlayableSentence(
                completedSentenceIndex + 1,
              );
              if (
                hasGranularSentenceAudio &&
                granularAutoAdvanceRef.current &&
                nextPlayableSentenceIndex >= 0
              ) {
                // Keep Play-all running across sentence and Part boundaries.
                // Defer to the next event loop tick so the media engine cleanly exits 'ended' state.
                clearSentenceStopMonitor();
                autoAdvanceTimerRef.current = setTimeout(() => {
                  autoAdvanceTimerRef.current = null;
                  if (granularAutoAdvanceRef.current) {
                    playGranularArticleSentence(nextPlayableSentenceIndex, true);
                  }
                }, 20);
              } else if (hasGranularSentenceAudio) {
                // Keep the completed sentence selected so its highlight and
                // translation remain visible after single-sentence playback.
                clearSentenceStopMonitor();
                granularAutoAdvanceRef.current = false;
                setIsPlaying(false);
                setActiveWordIdx(-1);
                activeWordRef.current = -1;
              } else {
                clearSentenceStopMonitor();
                granularAutoAdvanceRef.current = false;
                setIsPlaying(false);
                activeSentenceRef.current = -1;
                activeWordRef.current = -1;
                setActiveIdx(-1);
                setActiveWordIdx(-1);
              }
            }}
          />
        )}

        {/* Scrollable article area */}
        <div data-tour-target="phase-3-reading-passage" className={isFullscreen ? "flex-1 overflow-y-auto pb-36" : "flex-1"}>
          {/* Header */}
          <div className="mx-auto mb-4 w-full max-w-[1500px]">
            <h2 className="mb-1 text-3xl font-bold text-fg">
              {articleData.title}
            </h2>
            {articleData.genre && articleData?.content_provider !== "PRIMARY_ADVANTAGE" && (
              <p className="text-base text-fg-muted">
                {articleData.genre} · CEFR {displayCefr}
              </p>
            )}
          </div>

          {isPrimaryContent ? (
            <div
              key={`primary-reading-page-${primaryReadingPageIndex}`}
              className="mx-auto flex w-full max-w-5xl flex-col items-center"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {primaryReadingImageUrl && (
                <img
                  src={primaryReadingImageUrl}
                  alt={`${articleData.title} — part ${primaryReadingPageIndex + 1}`}
                  className="h-[clamp(240px,44vh,520px)] w-full rounded-xl border border-hairline bg-surface object-cover"
                />
              )}
              <div className="mt-4 w-full rounded-xl border border-hairline bg-surface p-6 shadow-card sm:p-8">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-fg-muted" style={{ fontFamily: "var(--font-sans, inherit)" }}>
                  <button
                    type="button"
                    onClick={() => goToPrimaryPart(-1)}
                    disabled={primaryReadingPageIndex <= 0}
                    data-tour-target="phase-3-previous-part"
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-fg transition-colors hover:bg-press disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    {t("lesson.live.previousPart")}
                  </button>
                  <span className="h-px flex-1 bg-hairline" />
                  <span className="whitespace-nowrap">{t("lesson.live.partLabel")} {primaryReadingPageIndex + 1} / {primaryReadingGroups.length}</span>
                  <span className="h-px flex-1 bg-hairline" />
                  <button
                    type="button"
                    onClick={() => goToPrimaryPart(1)}
                    disabled={primaryReadingPageIndex >= primaryReadingGroups.length - 1}
                    data-tour-target="phase-3-next-part"
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-fg transition-colors hover:bg-press disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("lesson.live.nextPart")}
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <p className="text-xl leading-[1.9] xl:text-2xl xl:leading-[1.85]">
                  {primaryReadingGroup.length > 0
                    ? primaryReadingGroup.map(({ idx, text }) => renderSentence(idx, text))
                    : rawParagraphs[primaryReadingPageIndex]}
                </p>
              </div>
            </div>
          ) : (
            <div
            className="mx-auto w-full max-w-[1500px] rounded-xl border border-hairline bg-surface p-6 shadow-card sm:p-8"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {readableParagraphGroups.map((group, pIdx) => (
              <p
                key={pIdx}
                className="mb-5 text-xl leading-[1.9] last:mb-0 xl:text-2xl xl:leading-[1.85]"
              >
                {group.length > 0 ? (
                  group.map(({ idx, text, ts }) => {
                    const canSelectSentence = hasGranularSentenceAudio || !isPrimaryContent || idx === 0;
                    const isActive = idx === activeIdx;
                    const flagCount = flagCounts?.[idx] || 0;
                    const isFlagged = flagCount > 0;
                    return (
                      <span
                        id={`read-sentence-${idx}`}
                        key={idx}
                        data-tour-target={idx === 0 ? "phase-3-first-sentence" : undefined}
                        onClick={canSelectSentence ? () => seekToSentence(idx) : undefined}
                        className={`${canSelectSentence ? "cursor-pointer" : "cursor-default"} rounded-lg px-0.5 transition-all duration-200 ${
                          isActive
                            ? "bg-[var(--highlight-bg)] text-[var(--highlight-text)] font-semibold px-1.5 py-0.5 rounded-md ring-2 ring-brand-vivid"
                            : isFlagged
                              ? "bg-danger-bg text-danger-fg font-semibold rounded-md px-1 ring-1 ring-danger-border"
                              : canSelectSentence
                                ? "text-fg hover:bg-brand-soft"
                                : "text-fg"
                        }`}
                      >
                        {renderReadAlongText(idx, text)}
                        {isFlagged && (
                          <sup className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-danger-solid px-1.5 py-0.5 align-super text-xs font-semibold text-white not-italic">
                            🚩{flagCount}
                          </sup>
                        )}{" "}
                      </span>
                    );
                  })
                ) : (
                  // Fallback for unmatched paragraph text
                  <span className="text-fg">
                    {rawParagraphs[pIdx]}{" "}
                  </span>
                )}
              </p>
            ))}
          </div>
          )}
        </div>

        {/* Floating mini audio player - bottom-center */}
        {phase4AudioUrl && (
          <div className={`${isFullscreen ? "absolute bottom-28 left-1/2 -translate-x-1/2" : "sticky bottom-[calc(var(--lesson-dock-h,76px)+12px)] mx-auto mt-4"} z-[var(--z-sticky)] flex w-fit max-w-full flex-col items-center gap-2`}>
            {/* Translation tooltip above player */}
            {activeEnText && (
              <div
                className="max-w-md rounded-xl border border-hairline bg-surface-elevated px-4 py-3 shadow-popover"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <p className="text-base font-semibold leading-snug text-fg">
                  {activeEnText}
                </p>
                {activeThText ? (
                  <p className="mt-1 text-sm leading-snug text-brand-fg">
                    {activeThText}
                  </p>
                ) : (
                  <p className="mt-1 text-sm italic text-fg-subtle">
                    {t("lesson.interactive.translateSentencePrompt")}
                  </p>
                )}
              </div>
            )}

            {/* Player pill */}
            <div data-tour-target="phase-3-audio-player" className="flex w-[min(560px,calc(100vw-48px))] items-center gap-3 rounded-xl border border-hairline bg-surface-elevated px-4 py-3 shadow-popover">
              {/* Skip prev */}
              <button
                onClick={() => {
                  if (activeIdx > 0) seekToSentence(activeIdx - 1);
                }}
                disabled={activeIdx <= 0}
                data-tour-target="phase-3-previous-sentence"
                aria-label={t("lesson.live.previousSentence")}
                title={t("lesson.live.previousSentence")}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill-muted text-fg transition-colors hover:bg-press disabled:opacity-35"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                data-tour-target="phase-3-play-button"
                aria-label={isPlaying ? t("lesson.live.pauseAudio") : t("lesson.live.playAudio")}
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-solid text-on-brand transition-colors hover:bg-brand-solid/90"
              >
                {isPlaying ? <Pause aria-hidden="true" className="size-6" fill="currentColor" /> : <Play aria-hidden="true" className="ml-0.5 size-6" fill="currentColor" />}
              </button>

              {/* Reading speed */}
              <button
                onClick={cycleSpeechRate}
                title={t("lesson.live.readingSpeed")}
                aria-label={`${t("lesson.live.readingSpeed")} ${speechRate}x`}
                data-tour-target="phase-3-speed"
                className="flex h-11 w-14 shrink-0 items-center justify-center rounded-full bg-fill-muted text-sm font-semibold tabular-nums text-fg transition-colors hover:bg-press"
              >
                {speechRate}x
              </button>

              {/* Skip next */}
              <button
                onClick={() => {
                  if (activeIdx < sentences.length - 1)
                    seekToSentence(activeIdx + 1);
                }}
                disabled={activeIdx >= sentences.length - 1}
                data-tour-target="phase-3-next-sentence"
                aria-label={t("lesson.live.nextSentence")}
                title={t("lesson.live.nextSentence")}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill-muted text-fg transition-colors hover:bg-press disabled:opacity-35"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>

              {/* Progress + time */}
              <div className="flex-1 min-w-0">
                <div
                  className="mb-1.5 h-2.5 w-full cursor-pointer rounded-full bg-fill-muted"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current) {
                      const requestId = ++audioRequestRef.current;
                      primarySentencePlaybackTokenRef.current++;
                      clearSentenceStopMonitor();
                      stopAtRef.current = Infinity;
                      clipAudioRef.current?.pause();
                      audioRef.current.playbackRate = speechRate;
                      audioRef.current.currentTime = ratio * duration;
                      audioRef.current
                        .play()
                        .then(() => {
                          if (requestId === audioRequestRef.current) setIsPlaying(true);
                        })
                        .catch(() => {
                          if (requestId === audioRequestRef.current) setIsPlaying(false);
                        });
                    }
                  }}
                >
                  <div
                    className="h-2.5 rounded-full bg-brand-vivid transition-[width] duration-100"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm tabular-nums text-fg-muted">
                  <span>{fmtTime(currentTime)}</span>
                  <span className="mx-1 truncate font-semibold text-fg">
                    {activeIdx >= 0
                      ? `${t("lesson.interactive.sentencePrefix")} ${activeIdx + 1} / ${sentences.length}`
                      : "-"}
                  </span>
                  <span>{fmtTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── Default Fallback ───────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col items-center py-8 px-6 w-full">
      {articleData.passage && (
        <div className="w-full max-w-4xl rounded-xl border border-hairline bg-surface p-8 shadow-card">
          <p className="text-xl font-medium leading-[2] text-fg">
            {articleData.passage}
          </p>
          {renderThaiPassageCard("mt-6")}
        </div>
      )}
      {audioToastText && (
        <div role="status" className="fixed bottom-24 right-6 z-[200] flex max-w-sm items-start gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-warning-fg shadow-popover">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{t("lesson.live.speechFallbackTitle")}</p>
            <p className="mt-0.5 text-fg-muted">&ldquo;{audioToastText}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
};
