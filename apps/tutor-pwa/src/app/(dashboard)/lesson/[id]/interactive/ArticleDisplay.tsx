import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { t } from "@/lib/i18n";
import { BookOpen, Volume2 } from "lucide-react";
import { useThaiTranslations } from "@/hooks/useThaiTranslations";

import { ArticleData } from "@/lib/lesson-types";

interface ArticleDisplayProps {
  articleData?: ArticleData;
  phase: number;
  isFullscreen?: boolean;
  flagCounts?: Record<number, number>;
  onActiveIdxChange?: (idx: number) => void;
}

const AUDIO_RATES = [0.75, 0.85, 1, 1.15] as const;
const READING_ADVANTAGE_BUCKET = "artifacts.reading-advantage.appspot.com";
const SENTENCE_STOP_MARGIN_SECONDS = 0.06;

const readingAdvantageTtsUrl = (fileName: string, cacheKey: string) => {
  const objectPath = fileName.startsWith("tts/") ? fileName : `tts/${fileName}`;
  return `https://storage.googleapis.com/${READING_ADVANTAGE_BUCKET}/${objectPath}?v=${cacheKey}`;
};

const readingAdvantageWordAudioUrl = (fileName: string) => {
  const objectPath = fileName.startsWith("audios-words/")
    ? fileName
    : `audios-words/${fileName}`;
  return `https://storage.googleapis.com/${READING_ADVANTAGE_BUCKET}/${objectPath}`;
};

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
  className = "",
  large = false,
}: {
  label: string;
  question: string;
  className?: string;
  large?: boolean;
}) {
  const { translations, loading } = useThaiTranslations([question], {
    enabled: Boolean(question),
  });
  const thaiQuestion = translations[0];

  return (
    <div className={`bg-card rounded-xl border border-border p-3 ${className}`}>
      <div className="flex items-start gap-2">
        <p className={`flex-1 font-semibold text-foreground ${large ? "text-[clamp(16px,1.12vw,21px)] leading-snug" : "text-xs leading-relaxed"}`}>
          {label}. {question}
        </p>
      </div>
      {(thaiQuestion || loading) && (
        <p className={`mt-2 font-medium text-teal-700 dark:text-teal-300 ${large ? "text-[clamp(14px,0.92vw,18px)] leading-snug" : "text-[11px] leading-relaxed"}`}>
          {thaiQuestion || "Translating question..."}
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

  // ── Audio state for Phase 9 ─────────────────────────────────
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
  const phase4PassageRef = useRef<HTMLDivElement>(null);
  const phase4VocabRef = useRef<HTMLDivElement>(null);
  const stopAtRef = useRef<number>(Infinity); // for single-sentence mode
  const sentenceStopRafRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false); // prevent highlight flickering during seek
  const audioRequestRef = useRef(0);
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
    articleData && [3, 4, 5, 6].includes(phase),
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
    if (phase !== 4) return;

    const passage = phase4PassageRef.current;
    const vocab = phase4VocabRef.current;
    if (!passage || !vocab) return;

    const syncPanelHeight = () => {
      // In fullscreen the Phase 4 grid owns the available viewport height.
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
  const readingAdvantageAudioUrl = (() => {
    if (!articleId) return null;
    const primarySentenceAudioUrl = String(
      (articleData as any)?.primary_audio?.sentencesUrl || "",
    );
    if (isPrimaryContent && primarySentenceAudioUrl) return primarySentenceAudioUrl;
    const rawAudioUrl = String(
      articleData?.audio_url ||
        articleData?.raAudioUrl ||
        articleData?.readingAdvantageAudioUrl ||
        "",
    );
    if (rawAudioUrl.startsWith("http")) return rawAudioUrl;
    return readingAdvantageTtsUrl(rawAudioUrl || `${articleId}.mp3`, articleId);
  })();
  const readingAdvantageWordsAudioUrl = (() => {
    if (!articleId) return "";
    const rawAudioUrl = String(
      articleData?.audio_word_url ||
        articleData?.audioWordUrl ||
        articleData?.readingAdvantageWordsAudioUrl ||
        "",
    );
    if (rawAudioUrl.startsWith("http")) return rawAudioUrl;
    return readingAdvantageWordAudioUrl(rawAudioUrl || `${articleId}.mp3`);
  })();

  const playClipUrl = (url?: string | null) => {
    if (!url) return;
    audioRequestRef.current++;
    clearClipStopMonitor();
    audioRef.current?.pause();
    clipAudioRef.current?.pause();
    const clip = new Audio(url);
    clipAudioRef.current = clip;
    clip.playbackRate = speechRate;
    setIsPlaying(true);
    clip.onended = () => setIsPlaying(false);
    clip.onerror = () => setIsPlaying(false);
    clip.play().catch(() => setIsPlaying(false));
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

  // Mirrors Primary's student/read/[articleId] useAudioPlayer flow exactly:
  // seek the single, preloaded full-article MP3 to the sentence start, then
  // continue normal article playback. Primary does not create a clip or apply
  // artificial start/end offsets to its article narration.
  const playPrimaryArticleSentence = (sentenceIndex: number) => {
    const audio = primaryArticleAudioRef.current;
    const sentence = sentences[sentenceIndex];
    if (!audio || !sentence) return;

    const seekAndPlay = () => {
      audio.pause();
      audio.currentTime = Math.max(0, getSentenceTime(sentence));
      audio.playbackRate = speechRate;
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekAndPlay();
    } else {
      audio.addEventListener("loadedmetadata", seekAndPlay, { once: true });
      audio.load();
    }
  };

  // Phase 6 uses the article MP3 plus sentence timestamps, not browser TTS.
  const playSentenceFromReadingAdvantage = (sentenceIndex: number) => {
    if (!readingAdvantageAudioUrl || !sentences[sentenceIndex]) return;

    const start = Math.max(0, getSentenceTime(sentences[sentenceIndex]));
    const nextSentence = sentences[sentenceIndex + 1];

    audioRequestRef.current++;
    audioRef.current?.pause();
    clearClipStopMonitor();
    clipAudioRef.current?.pause();

    const clip = isPrimaryContent && primaryArticleAudioRef.current
      ? primaryArticleAudioRef.current
      : new Audio(readingAdvantageAudioUrl);
    clipAudioRef.current = clip;
    clip.playbackRate = speechRate;

    let end = getSentenceEndTime(sentences[sentenceIndex], start, nextSentence);

    const beginPlayback = () => {
      // Primary's full-reading MP3 has its own precise start/end timeline.
      // Seeking before playback avoids an audible burst from 0:00 while the
      // browser is still loading metadata from GCS.
      clip.currentTime = start;
      if (!Number.isFinite(end) && Number.isFinite(clip.duration)) {
        end = Math.max(start + 0.1, clip.duration - sentenceStopMarginSeconds);
      }
      clip
        .play()
        .then(() => {
          setIsPlaying(true);
          clipStopRafRef.current = requestAnimationFrame(tick);
        })
        .catch(() => setIsPlaying(false));
    };
    clip.onloadedmetadata = beginPlayback;
    clip.onended = () => {
      clearClipStopMonitor();
      setIsPlaying(false);
    };
    clip.onerror = () => {
      clearClipStopMonitor();
      setIsPlaying(false);
    };

    const tick = () => {
      if (clip.paused) {
        clipStopRafRef.current = null;
        return;
      }
      if (clip.currentTime >= end) {
        clip.pause();
        clearClipStopMonitor();
        setIsPlaying(false);
        return;
      }
      clipStopRafRef.current = requestAnimationFrame(tick);
    };

    if (clip.readyState >= HTMLMediaElement.HAVE_METADATA) {
      beginPlayback();
    } else {
      clip.load();
    }
  };

  const playWordFromReadingAdvantage = (index: number) => {
    if (!readingAdvantageWordsAudioUrl) return;
    const start = getWordTime(words[index], index);
    const end = getWordEndTime(index, start);

    audioRequestRef.current++;
    audioRef.current?.pause();
    clearClipStopMonitor();
    clipAudioRef.current?.pause();

    const clip = new Audio(readingAdvantageWordsAudioUrl);
    clipAudioRef.current = clip;
    clip.playbackRate = speechRate;
    try {
      clip.currentTime = start;
    } catch {
      // Some browsers only allow seeking after metadata is available.
    }
    clip.onloadedmetadata = () => {
      clip.currentTime = start;
    };
    clip.onended = () => {
      clearClipStopMonitor();
      setIsPlaying(false);
    };
    clip.onerror = () => {
      clearClipStopMonitor();
      setIsPlaying(false);
    };

    const tick = () => {
      if (clip.paused) {
        clipStopRafRef.current = null;
        return;
      }
      if (clip.currentTime >= end) {
        clip.pause();
        clearClipStopMonitor();
        setIsPlaying(false);
        return;
      }
      clipStopRafRef.current = requestAnimationFrame(tick);
    };

    setIsPlaying(true);
    clip
      .play()
      .then(() => {
        if (clip.readyState >= 1) clip.currentTime = start;
        clipStopRafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => setIsPlaying(false));
  };

  const clearSentenceStopMonitor = () => {
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
    if (!isPrimaryContent || phase !== 3 || !isPlaying) return;

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
  }, [isPrimaryContent, phase, isPlaying, findPrimaryAudioPosition]);

  const playAudioSentenceFallback = (sentenceIdx: number) => {
    const audio = audioRef.current;
    const item = sentences[sentenceIdx];
    if (!audio || !item) {
      setIsPlaying(false);
      return;
    }

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
          if (playbackToken !== primarySentencePlaybackTokenRef.current) return;
          setIsPlaying(true);
          startPrimarySentenceStopMonitor(playbackToken, end);
        })
        .catch(() => {
          if (playbackToken !== primarySentencePlaybackTokenRef.current) return;
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
      .then(startSentenceStopMonitor)
      .catch(() => {
        stopAtRef.current = Infinity;
        clearSentenceStopMonitor();
        setIsPlaying(false);
      });
  };

  const seekToSentence = (sentenceIdx: number) => {
    // Temporarily allow sentence selection only for the first Primary sentence.
    // Full-article playback remains available through the audio controls.
    if (isPrimaryContent && sentenceIdx !== 0) return;

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
      audioRequestRef.current++;
      primarySentencePlaybackTokenRef.current++;
      clipAudioRef.current?.pause();
      stopAtRef.current = Infinity; // always continuous when pressing Play
      clearSentenceStopMonitor();
      audioRef.current.playbackRate = speechRate;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Auto-scroll active sentence into view in Step 3 (Read the Article)
  useEffect(() => {
    if (phase !== 3 || activeIdx < 0) return;
    const el = document.getElementById(`read-sentence-${activeIdx}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx, phase]);

  const lastReportedIdxRef = useRef(-2);
  useEffect(() => {
    if (
      phase === 3 &&
      onActiveIdxChange &&
      activeIdx !== lastReportedIdxRef.current
    ) {
      lastReportedIdxRef.current = activeIdx;
      onActiveIdxChange(activeIdx);
    }
  }, [activeIdx, phase, onActiveIdxChange]);

  // Auto-translate vocab words and English definitions
  useEffect(() => {
    if (phase !== 2 && phase !== 4) return;

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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t("lesson.interactive.articleLoading")}
      </div>
    );
  }

  const renderThaiPassageCard = (
    className = "",
    textClassName = "text-foreground/90 text-sm leading-relaxed",
    titleClassName = "text-emerald-700 dark:text-emerald-300",
  ) => {
    if (!thaiPassage && !translatingArticle) return null;

    return (
      <div
        className={`rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 ${className}`}
      >
        <p
          className={`text-[11px] font-black uppercase tracking-widest mb-2 ${titleClassName}`}
        >
          Thai Translation
        </p>
        {thaiPassage ? (
          <p className={textClassName}>
            {thaiPassage}
          </p>
        ) : (
          <p className={`${textClassName} italic opacity-80`}>
            Translating article...
          </p>
        )}
      </div>
    );
  };

  /* ─── Phase 1: Introduction ──────────────────────────────── */
  if (phase === 1) {
    return (
      <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch py-6 px-4 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
        {/* Left: Article Image Panel */}
        <div className="w-full lg:w-[45%] shrink-0 rounded-3xl overflow-hidden shadow-2xl relative">
          {articleImageUrl ? (
            <img
              src={articleImageUrl}
              alt={articleData.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (
                  (e.target as HTMLImageElement).parentElement as HTMLElement
                ).classList.add(
                  "bg-gradient-to-br",
                  "from-indigo-600",
                  "via-purple-600",
                  "to-fuchsia-600",
                );
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 flex items-center justify-center">
              <span className="text-8xl">📖</span>
            </div>
          )}
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {/* Genre / CEFR badge overlaid */}
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
            {articleData.genre && (
              <span className="bg-white/20 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full">
                {articleData.genre}
              </span>
            )}
            {articleData?.content_provider !== "PRIMARY_ADVANTAGE" && displayCefr && (
              <span className="bg-indigo-500/80 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full">
                CEFR {displayCefr}
              </span>
            )}
          </div>
          {/* Stat chips at bottom of image */}
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3">
            <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">
                {t("lesson.interactive.vocabulary")}
              </p>
              <p className="text-white font-black text-xl">{words.length}</p>
            </div>
            <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">
                {t("lesson.interactive.keySentences")}
              </p>
              <p className="text-white font-black text-xl">
                {sentences.length}
              </p>
            </div>
            <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">
                Step
              </p>
              <p className="text-white font-black text-xl">1 / 13</p>
            </div>
          </div>
        </div>

        {/* Right 55%: Title + Checklist */}
        <div className="flex-1 flex flex-col justify-center gap-5">
          {/* Badge row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-500 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {t("lesson.interactive.step1")}
            </span>
            <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/20">
              {t("lesson.interactive.period1")}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-black text-foreground leading-tight">
            {articleData.title}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed line-clamp-3">
            {articleData.translated_summary?.th?.[0] ||
              articleData.summary ||
              t("lesson.interactive.articleFallbackSummary")}
          </p>

          {/* Tutor Checklist */}
          <div className="space-y-3 mt-2">
            {[
              {
                num: "1",
                emoji: "💬",
                title: t("lesson.interactive.introChecklistIntroduceTitle"),
                desc: t("lesson.interactive.introChecklistIntroduceDesc"),
              },
              {
                num: "2",
                emoji: "🎯",
                title: t("lesson.interactive.introChecklistGoalTitle"),
                desc: t("lesson.interactive.introChecklistGoalDesc"),
              },
              {
                num: "3",
                emoji: "✨",
                title: t("lesson.interactive.introChecklistSparkTitle"),
                desc: t("lesson.interactive.introChecklistSparkDesc"),
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 hover:border-indigo-400/40 hover:bg-indigo-500/10 transition-all"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md">
                  {item.emoji}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">
                    {item.title}
                  </p>
                  <p className="text-indigo-600 dark:text-indigo-400 text-xs mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 2: Vocabulary Preview ───────────────────────── */
  if (phase === 2) {
    const cardColors = [
      {
        bg: "bg-purple-500",
        light: "bg-purple-500/10",
        border: "border-purple-500/30",
        text: "text-purple-700 dark:text-purple-300",
      },
      {
        bg: "bg-fuchsia-500",
        light: "bg-fuchsia-500/10",
        border: "border-fuchsia-500/30",
        text: "text-fuchsia-700 dark:text-fuchsia-300",
      },
      {
        bg: "bg-violet-500",
        light: "bg-violet-500/10",
        border: "border-violet-500/30",
        text: "text-violet-700 dark:text-violet-300",
      },
      {
        bg: "bg-pink-500",
        light: "bg-pink-500/10",
        border: "border-pink-500/30",
        text: "text-pink-700 dark:text-pink-300",
      },
      {
        bg: "bg-indigo-500",
        light: "bg-indigo-500/10",
        border: "border-indigo-500/30",
        text: "text-indigo-700 dark:text-indigo-300",
      },
      {
        bg: "bg-rose-500",
        light: "bg-rose-500/10",
        border: "border-rose-500/30",
        text: "text-rose-700 dark:text-rose-300",
      },
    ];

    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-4 mb-8 w-full max-w-5xl">
          <div className="flex-1">
            <h2 className="text-3xl font-black text-purple-900 dark:text-purple-100">
              Vocabulary Preview
            </h2>
            <p className="text-purple-500 dark:text-purple-400 text-sm mt-1">
              {t("lesson.interactive.phase2Subtitle")}
            </p>
          </div>
          <div className="bg-purple-600 text-white rounded-2xl px-5 py-3 text-center">
            <p className="text-3xl font-black">{words.length}</p>
            <p className="text-xs opacity-80 uppercase tracking-wider">
              {t("lesson.interactive.vocabulary")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-5xl">
          {words.map((item: any, index: number) => {
            const wordText =
              typeof item === "object"
                ? item.vocabulary || item.word || item.text
                : item;
            const defTh =
              typeof item === "object" && item.definition
                ? item.definition.th || autoVocabTh[index] || null
                : autoVocabTh[index] || null;
            const defEn =
              typeof item === "object" && item.definition
                ? item.definition.en
                : null;
            const c = cardColors[index % cardColors.length];

            const speak = () => {
              playWordFromReadingAdvantage(index);
            };

            return (
              <div
                key={index}
                className={`group relative rounded-2xl border-2 ${c.border} ${c.light} overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
                style={{ minHeight: "160px" }}
              >
                <div className="p-5 flex flex-col h-full gap-2">
                  {/* Top row: number badge + speak button */}
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className={`${c.bg} text-white text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full`}
                    >
                      #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={speak}
                      title={t("lesson.interactive.speakTitle")}
                      className={`w-8 h-8 rounded-full ${c.bg} text-white flex items-center justify-center shadow hover:opacity-80 active:scale-90 transition-all`}
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>

                  {/* Word */}
                  <p className={`font-black text-2xl ${c.text}`}>
                    {String(wordText)}
                  </p>

                  {/* Thai translation - always visible */}
                  {defTh && (
                    <p className="text-foreground font-semibold text-sm leading-snug">
                      {defTh}
                    </p>
                  )}

                  {/* English definition + Thai explanation translation */}
                  {defEn && (
                    <div className="mt-auto space-y-1">
                      <p className="text-muted-foreground text-xs italic leading-snug">
                        {defEn}
                      </p>
                      {autoVocabEnTh[index] && (
                        <p className="text-purple-600 dark:text-purple-400 font-semibold text-xs leading-snug border-t border-purple-500/20 pt-1">
                          {autoVocabEnTh[index]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 ${c.bg} opacity-40`}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-muted border border-border rounded-xl px-6 py-3 text-purple-700 dark:text-purple-400 text-sm font-medium">
          {t("lesson.interactive.pronunciationHint")}
        </div>
      </div>
    );
  }

  /* ─── Step 3 (Read the Article) is rendered by the audio reader block below ─── */

  /* ─── Phase 4: Vocabulary Focus ──────────────────────────── */
  if (phase === 4) {
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
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center animate-in fade-in duration-500 ${
          isFullscreen ? "px-5 py-4 pb-32" : "px-2 py-4 sm:px-3"
        }`}
      >
        <div className={`flex w-full flex-wrap items-center gap-3 ${isFullscreen ? "mb-2" : "mb-4"}`}>
          <span className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Phase 4
          </span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
            Vocabulary Focus
          </span>
          <p className={`text-sm text-muted-foreground sm:ml-1 ${isFullscreen ? "hidden xl:block" : ""}`}>
            {t("lesson.interactive.wordPrefix")}{" "}
            <span className="font-semibold text-foreground">highlight</span>{" "}
            {t("lesson.interactive.vocabInLessonSuffix")}
          </p>
        </div>

        <div
          className={`grid w-full min-h-0 flex-1 grid-cols-1 items-stretch gap-4 ${
            isFullscreen
              ? "lg:grid-cols-[1.08fr_1fr]"
              : "lg:grid-cols-[1.12fr_1fr]"
          }`}
        >
          {/* Passage with highlights */}
          <div
            ref={phase4PassageRef}
            className={`flex min-h-0 flex-col rounded-2xl border border-border border-t-2 border-t-amber-400 bg-card shadow-lg shadow-slate-900/5 ${
              isFullscreen ? "h-full overflow-hidden p-4" : "overflow-y-auto p-5 sm:p-6"
            }`}
          >
            <h3 className={`flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-amber-600 ${isFullscreen ? "mb-2" : "mb-4"}`}>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-amber-500 text-white">
                <BookOpen size={18} />
              </span>
              Reading Passage
            </h3>
            <p
              className={isFullscreen
                ? "flex-1 text-[clamp(15px,1.15vw,21px)] font-medium leading-[1.82] text-foreground"
                : "text-[15px] font-medium leading-[2] text-foreground sm:text-base sm:leading-[2.05]"}
              style={{ fontFamily: "Georgia, serif" }}
            >
              {highlightPassage(articleData.passage)}
            </p>
            <div className={isFullscreen ? "pt-3" : "pt-5"}>
              {renderThaiPassageCard(
                isFullscreen
                  ? "bg-emerald-50/80 p-3 dark:bg-emerald-950/25"
                  : "bg-emerald-50/80 dark:bg-emerald-950/25",
                isFullscreen
                  ? "text-[clamp(12px,0.85vw,15px)] leading-[1.72] text-foreground/90"
                  : undefined,
              )}
            </div>
          </div>

          {/* Vocab sidebar */}
          <div
            ref={phase4VocabRef}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 shadow-lg shadow-purple-900/5 sm:p-5"
          >
            <h3 className={`flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 ${isFullscreen ? "mb-2" : "mb-4"}`}>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                <BookOpen size={17} />
              </span>
              Vocabulary List
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
                    className={`relative grid min-h-[96px] gap-x-3 rounded-xl border border-purple-500/15 bg-card px-3 py-3 shadow-sm ${
                      isFullscreen
                        ? "h-full min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] content-center"
                        : "shrink-0 grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_minmax(0,1fr)_minmax(180px,.9fr)_auto] sm:items-center sm:px-4"
                    }`}
                  >
                    <span
                      className={isFullscreen
                        ? "absolute left-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white"
                        : "mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white sm:mt-0"}
                    >
                      {i + 1}
                    </span>
                    <div className={`min-w-0 ${isFullscreen ? "col-span-2 col-start-1 pl-8 pr-2" : "sm:pr-4"}`}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="break-words font-black text-purple-700 dark:text-purple-200">
                          {String(wordText)}
                        </p>
                        {partOfSpeech && (
                          <span className="text-xs text-muted-foreground">
                            ({String(partOfSpeech)})
                          </span>
                        )}
                      </div>
                      {defEn && (
                        <p className={`mt-1 break-words text-xs text-muted-foreground ${isFullscreen ? "leading-snug" : "leading-relaxed sm:text-[13px]"}`}>
                          {defEn}
                        </p>
                      )}
                    </div>
                    <div
                      className={isFullscreen
                        ? "col-span-2 col-start-1 mt-1 min-w-0 border-t border-purple-500/10 pl-8 pt-1.5 pr-2"
                        : "col-start-2 mt-2 min-w-0 border-t border-purple-500/10 pt-2 sm:col-start-auto sm:mt-0 sm:border-l sm:border-t-0 sm:py-1 sm:pl-5"}
                    >
                      {defTh && (
                        <p className="break-words text-sm font-bold text-purple-600 dark:text-purple-300">
                          {defTh}
                        </p>
                      )}
                      {autoVocabEnTh[i] && (
                        <p className={`mt-1 break-words text-xs text-muted-foreground ${isFullscreen ? "leading-snug" : "leading-relaxed sm:text-[13px]"}`}>
                          {autoVocabEnTh[i]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => playWordFromReadingAdvantage(i)}
                      title={t("lesson.interactive.speakTitle")}
                      className={isFullscreen
                        ? "absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 transition-all hover:bg-purple-500/20 active:scale-95"
                        : "col-start-3 row-start-1 inline-flex size-9 items-center justify-center self-center rounded-full bg-purple-500/10 text-purple-600 transition-all hover:bg-purple-500/20 active:scale-95 sm:col-start-auto sm:row-start-auto"}
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
  if (phase === 5) {
    const comprehensionQuestions =
      articleData.shortAnswerQuestions?.slice(0, 3) || [];

    return (
      <div
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center animate-in fade-in duration-500 ${
          isFullscreen ? "px-5 py-4 pb-32" : "px-2 py-4 sm:px-3"
        }`}
      >
        <div className={`flex w-full flex-wrap items-center gap-3 ${isFullscreen ? "mb-2" : "mb-4"}`}>
          <span className="rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Phase 5
          </span>
          <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
            Deep Reading
          </span>
          <span className={`rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground ${isFullscreen ? "hidden xl:inline-flex" : ""}`}>
            Analytical Mode
          </span>
        </div>

        <div className="grid w-full min-h-0 flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(390px,.85fr)]">
          {/* Passage - high contrast indigo-950 deep */}
          <div className="min-h-0 min-w-0">
            <div className={`flex h-full min-h-0 flex-col rounded-2xl border-t-4 border-teal-400 bg-indigo-950 shadow-2xl ${isFullscreen ? "overflow-hidden p-5" : "p-5 sm:p-7"}`}>
              <h3 className={`text-xs font-bold uppercase tracking-widest text-teal-400 ${isFullscreen ? "mb-2" : "mb-4"}`}>
                {articleData.title}
              </h3>
              <p
                className={isFullscreen
                  ? "flex-1 text-[clamp(15px,1.06vw,20px)] font-medium leading-[1.82] text-indigo-100"
                  : "text-base font-medium leading-[2] text-indigo-100 sm:text-lg sm:leading-[2.05]"}
                style={{ fontFamily: "Georgia, serif" }}
              >
                {articleData.passage}
              </p>
              {renderThaiPassageCard(
                isFullscreen
                  ? "mt-3 border-teal-400/30 bg-teal-500/10 p-3"
                  : "mt-5 bg-teal-500/10 border-teal-400/30",
                isFullscreen
                  ? "text-[clamp(12px,0.82vw,15px)] leading-[1.7] text-teal-50"
                  : "text-teal-50 text-sm leading-relaxed",
                "text-teal-400",
              )}
            </div>
          </div>

          {/* Comprehension Guide */}
          <div className={`flex min-h-0 min-w-0 flex-col ${isFullscreen ? "gap-3" : "space-y-4"}`}>
            <div className={`flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-border bg-muted ${isFullscreen ? "p-4" : "p-5"}`}>
              <h4 className={`mb-2 flex items-center gap-2 font-bold text-foreground ${isFullscreen ? "text-lg" : "text-sm"}`}>
                <span>Guide</span> Comprehension Guide
              </h4>
              <p className={`text-muted-foreground ${isFullscreen ? "mb-3 text-sm" : "mb-4 text-xs"}`}>
                {t("lesson.interactive.comprehensionGuideHelp")}
              </p>
              {comprehensionQuestions.length > 0 ? (
                <div className={isFullscreen ? "grid min-h-0 flex-1 grid-rows-3 gap-2" : "space-y-3"}>
                  {comprehensionQuestions.map((q: any, i: number) => (
                    <GuideQuestionCard
                      key={i}
                      label={`Q${i + 1}`}
                      question={q.question}
                      className={isFullscreen ? "h-full" : ""}
                      large={isFullscreen}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  {t("lesson.interactive.comprehensionFallback")}
                </p>
              )}
            </div>

            <div className={`rounded-2xl border border-border bg-card ${isFullscreen ? "p-4" : "p-5"}`}>
              <h4 className="mb-2 text-sm font-bold text-foreground">
                Tutor Actions
              </h4>
              <ul className="text-muted-foreground text-xs space-y-2">
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
  if (phase === 6) {
    const sentenceColors = [
      "border-green-500/40 bg-green-500/10",
      "border-emerald-500/40 bg-emerald-500/10",
      "border-teal-500/40 bg-teal-500/10",
      "border-cyan-500/40 bg-cyan-500/10",
      "border-lime-500/40 bg-lime-500/10",
    ];
    const dotColors = [
      "bg-green-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-lime-500",
    ];

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

    const keySentences = scoredKeySentences
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, keySentenceLimit)
      .sort((a, b) => a.index - b.index)
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
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center animate-in fade-in duration-500 ${
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
        <div className={`flex w-full flex-wrap items-center gap-3 ${isFullscreen ? "mb-2" : "mb-4"}`}>
          <span className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Phase 6
          </span>
          <span className="rounded-full border border-green-500/20 bg-green-500/10 px-4 py-1.5 text-xs font-bold text-green-700 dark:text-green-400">
            Key Sentences
          </span>
          <p className="text-xs text-muted-foreground sm:ml-1">
            {keySentences.length}{" "}
            {t("lesson.interactive.keySentenceCountSuffix")}
          </p>
        </div>

        <div className="grid w-full min-h-0 flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <div className={`min-h-0 min-w-0 ${isFullscreen ? "flex h-full flex-col" : ""}`}>
            <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-green-800 dark:text-green-300 ${isFullscreen ? "mb-2" : "mb-4"}`}>
              <span>List</span> Key Sentences Timeline
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
                        className={`relative flex gap-4 animate-in slide-in-from-left duration-500 ${isFullscreen ? "min-h-0 items-stretch" : "items-start"}`}
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        {index < keySentences.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-[-0.75rem] w-0.5 bg-green-500/30" />
                        )}
                        <div
                          className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${d} text-xs font-black text-white shadow-md`}
                        >
                          {index + 1}
                        </div>
                        <div
                          className={`flex-1 border-l-4 rounded-xl p-4 shadow-sm ${c} ${isFullscreen ? "min-h-0" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <p className={`min-w-0 flex-1 font-semibold text-foreground ${isFullscreen ? "text-[clamp(15px,1vw,19px)] leading-snug" : "text-base leading-relaxed"}`}>
                            {highlightVocab(String(sentenceText))}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                isPrimaryContent
                                  ? playPrimaryArticleSentence(sentenceIndex)
                                  : playSentenceFromReadingAdvantage(sentenceIndex)
                              }
                              title={t("lesson.interactive.speakTitle")}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-700 transition-colors hover:bg-green-500/25 dark:text-green-300"
                            >
                              <Volume2 size={15} />
                            </button>
                          </div>
                          {thaiText && (
                            <p className={`mt-2 font-medium text-emerald-700 dark:text-emerald-300 ${isFullscreen ? "text-[clamp(13px,0.84vw,16px)] leading-snug" : "text-sm leading-relaxed"}`}>
                              {thaiText}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
                {keySentences.length === 0 && (
                  <p className="text-muted-foreground text-sm pl-10">
                    {t("lesson.interactive.noKeySentences")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Passage with context */}
          <div className={`min-h-0 min-w-0 ${isFullscreen ? "flex h-full flex-col" : ""}`}>
            <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-green-800 dark:text-green-300 ${isFullscreen ? "mb-2" : "mb-4"}`}>
              <span>Article</span> Passage Reference
            </h3>
            <div className={`rounded-2xl border-t-4 border-green-400 bg-card shadow-xl ${isFullscreen ? "flex min-h-0 flex-1 flex-col overflow-hidden p-5" : "p-5 sm:p-6 lg:max-h-[62vh] lg:overflow-y-auto"}`}>
              <p className={isFullscreen ? "flex-1 text-[clamp(15px,1vw,19px)] leading-[1.8] text-foreground" : "text-base leading-[2] text-foreground sm:text-lg sm:leading-[2.05]"}>
                {articleData.passage}
              </p>
              {renderThaiPassageCard(
                isFullscreen ? "mt-3 p-3" : "mt-5",
                isFullscreen
                  ? "text-[clamp(12px,0.78vw,15px)] leading-[1.65] text-foreground/90"
                  : undefined,
              )}
            </div>
            <div className={`mt-3 rounded-xl border border-green-500/20 bg-green-500/10 ${isFullscreen ? "p-3" : "mt-4 p-4"}`}>
              <p className="text-green-800 dark:text-green-300 text-xs font-bold mb-1">
                Tutor Tip
              </p>
              <p className="text-green-700 dark:text-green-400 text-xs">
                {t("lesson.interactive.keySentenceTip")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Step 3: Read the Article + Audio Player + Sentence Flag ───────────────── */
  if (phase === 3) {
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const phase3AudioUrl = readingAdvantageAudioUrl;
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
                      ? "bg-orange-600 text-white px-0.5"
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
      const canSelectSentence = !isPrimaryContent || idx === 0;
      const isActive = idx === activeIdx;
      const flagCount = flagCounts?.[idx] || 0;
      const isFlagged = flagCount > 0;

      return (
        <span
          id={`read-sentence-${idx}`}
          key={idx}
          onClick={canSelectSentence ? () => seekToSentence(idx) : undefined}
          className={`${canSelectSentence ? "cursor-pointer" : "cursor-default"} rounded-lg px-0.5 transition-all duration-200 ${
            isActive
              ? "bg-orange-400 text-white font-bold px-2 py-0.5 rounded-xl shadow-md"
              : isFlagged
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold rounded-lg px-1 ring-1 ring-rose-400/50"
                : canSelectSentence
                  ? "text-foreground hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
                  : "text-foreground"
          }`}
        >
          {renderReadAlongText(idx, text)}
          {isFlagged && (
            <sup className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 align-super not-italic">
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

    return (
      <div className="flex-1 flex flex-col w-full bg-muted relative">
        {/* Hidden audio */}
        {phase3AudioUrl && (
          <audio
            ref={audioRef}
            src={phase3AudioUrl}
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onSeeked={() => {
              isSeekingRef.current = false;
            }}
            onLoadedMetadata={() =>
              setDuration(audioRef.current?.duration || 0)
            }
            onEnded={() => {
              setIsPlaying(false);
              if (isPrimaryContent) {
                activeSentenceRef.current = -1;
                activeWordRef.current = -1;
                setActiveIdx(-1);
                setActiveWordIdx(-1);
              }
            }}
          />
        )}

        {/* Scrollable article area */}
        <div className="flex-1 overflow-y-auto px-2 py-5 pb-40 sm:px-3">
          {/* Header */}
          <div className="mx-auto mb-5 w-full max-w-[1500px]">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-orange-500 text-white text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow">
                {t("lesson.interactive.step3")}
              </span>
              <span className="bg-card text-orange-600 dark:text-orange-400 text-sm font-bold px-4 py-1.5 rounded-full border-2 border-orange-500/30">
                {t("lesson.interactive.period1")}
              </span>
            </div>
            <h2 className="text-3xl font-black text-foreground mb-1">
              {articleData.title}
            </h2>
            {articleData.genre && articleData?.content_provider !== "PRIMARY_ADVANTAGE" && (
              <p className="text-muted-foreground text-sm">
                {articleData.genre} / CEFR {displayCefr}
              </p>
            )}
          </div>

          {isPrimaryContent ? (
            <div
              key={`primary-reading-page-${primaryReadingPageIndex}`}
              className="mx-auto flex w-full max-w-5xl animate-in fade-in slide-in-from-right-8 duration-500 flex-col items-center"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {primaryReadingImageUrl && (
                <img
                  src={primaryReadingImageUrl}
                  alt={`${articleData.title} — part ${primaryReadingPageIndex + 1}`}
                  className="h-[clamp(260px,48vh,560px)] w-full rounded-3xl border border-border bg-card object-cover shadow-xl"
                />
              )}
              <div className="mt-5 w-full rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                  <span>Part {primaryReadingPageIndex + 1}</span>
                  <span className="h-px flex-1 bg-orange-500/20" />
                  <span>{primaryReadingGroups.length} Parts</span>
                </div>
                <p className="text-base leading-[2] sm:text-lg sm:leading-[2.05]">
                  {primaryReadingGroup.length > 0
                    ? primaryReadingGroup.map(({ idx, text }) => renderSentence(idx, text))
                    : rawParagraphs[primaryReadingPageIndex]}
                </p>
              </div>
            </div>
          ) : (
            <div
            className="mx-auto w-full max-w-[1500px] rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {readableParagraphGroups.map((group, pIdx) => (
              <p
                key={pIdx}
                className="mb-5 text-base leading-[2] last:mb-0 sm:text-lg sm:leading-[2.05]"
              >
                {group.length > 0 ? (
                  group.map(({ idx, text, ts }) => {
                    const canSelectSentence = !isPrimaryContent || idx === 0;
                    const isActive = idx === activeIdx;
                    const flagCount = flagCounts?.[idx] || 0;
                    const isFlagged = flagCount > 0;
                    return (
                      <span
                        id={`read-sentence-${idx}`}
                        key={idx}
                        onClick={canSelectSentence ? () => seekToSentence(idx) : undefined}
                        className={`${canSelectSentence ? "cursor-pointer" : "cursor-default"} rounded-lg px-0.5 transition-all duration-200 ${
                          isActive
                            ? "bg-orange-400 text-white font-bold px-2 py-0.5 rounded-xl shadow-md"
                            : isFlagged
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold rounded-lg px-1 ring-1 ring-rose-400/50"
                              : canSelectSentence
                                ? "text-foreground hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
                                : "text-foreground"
                        }`}
                      >
                        {renderReadAlongText(idx, text)}
                        {isFlagged && (
                          <sup className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 align-super not-italic">
                            🚩{flagCount}
                          </sup>
                        )}{" "}
                      </span>
                    );
                  })
                ) : (
                  // Fallback for unmatched paragraph text
                  <span className="text-foreground">
                    {rawParagraphs[pIdx]}{" "}
                  </span>
                )}
              </p>
            ))}
          </div>
          )}
        </div>

        {/* Floating mini audio player - bottom-center */}
        {phase3AudioUrl && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
            {/* Translation tooltip above player */}
            {activeEnText && (
              <div
                className="bg-card border border-orange-200 rounded-2xl shadow-xl px-4 py-3 max-w-xs animate-in slide-in-from-bottom duration-200"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <p className="text-foreground font-semibold text-sm leading-snug">
                  {activeEnText}
                </p>
                {activeThText ? (
                  <p className="text-orange-600 text-xs mt-1 leading-snug">
                    {activeThText}
                  </p>
                ) : (
                  <p className="text-slate-300 text-xs mt-1 italic">
                    {t("lesson.interactive.translateSentencePrompt")}
                  </p>
                )}
              </div>
            )}

            {/* Player pill */}
            <div className="bg-card border-2 border-orange-500/40 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 w-[560px]">
              {/* Skip prev */}
              <button
                onClick={() => {
                  if (activeIdx > 0) seekToSentence(activeIdx - 1);
                }}
                disabled={activeIdx <= 0}
                className="w-11 h-11 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center hover:bg-orange-500/30 transition-all disabled:opacity-30 text-xl shrink-0"
              >
                ⏮
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center text-2xl shadow-lg hover:bg-orange-600 active:scale-90 transition-all shrink-0"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>

              {/* Reading speed */}
              <button
                onClick={cycleSpeechRate}
                title="Reading speed"
                className="w-14 h-11 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center hover:bg-orange-500/30 transition-all active:scale-95 text-sm font-black shrink-0"
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
                className="w-11 h-11 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center hover:bg-orange-500/30 transition-all disabled:opacity-30 text-xl shrink-0"
              >
                ⏭
              </button>

              {/* Progress + time */}
              <div className="flex-1 min-w-0">
                <div
                  className="w-full bg-orange-500/20 rounded-full h-2.5 cursor-pointer mb-1.5"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current) {
                      audioRequestRef.current++;
                      primarySentencePlaybackTokenRef.current++;
                      clearSentenceStopMonitor();
                      stopAtRef.current = Infinity;
                      clipAudioRef.current?.pause();
                      audioRef.current.playbackRate = speechRate;
                      audioRef.current.currentTime = ratio * duration;
                      audioRef.current
                        .play()
                        .then(() => setIsPlaying(true))
                        .catch(() => setIsPlaying(false));
                    }
                  }}
                >
                  <div
                    className="bg-orange-500 h-2.5 rounded-full transition-all duration-100"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{fmtTime(currentTime)}</span>
                  <span className="text-orange-500 font-bold truncate mx-1">
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
        <div className="bg-card rounded-2xl p-10 max-w-4xl w-full shadow-xl border-t-4 border-slate-300">
          <p className="text-foreground leading-[2.4] text-xl font-medium">
            {articleData.passage}
          </p>
          {renderThaiPassageCard("mt-6")}
        </div>
      )}
    </div>
  );
};
