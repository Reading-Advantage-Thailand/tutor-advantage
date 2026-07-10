import React, { useRef, useState, useEffect, useMemo } from "react";
import { t } from "@/lib/i18n";
import { BookOpen, Volume2 } from "lucide-react";
import { useThaiTranslations } from "@/hooks/useThaiTranslations";

import { ArticleData } from "@/lib/lesson-types";

interface ArticleDisplayProps {
  articleData?: ArticleData;
  phase: number;
  flagCounts?: Record<number, number>;
  onActiveIdxChange?: (idx: number) => void;
}

function speakEnglish(text: string) {
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    !text.trim()
  ) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

const TTS_RATES = [0.75, 0.85, 1, 1.15] as const;

function speakEnglishWithRate(
  text: string,
  rate: number,
  onDone?: () => void,
) {
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    !text.trim()
  ) {
    onDone?.();
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.onend = () => onDone?.();
  utterance.onerror = () => onDone?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

function GuideQuestionCard({
  label,
  question,
}: {
  label: string;
  question: string;
}) {
  const { translations, loading } = useThaiTranslations([question], {
    enabled: Boolean(question),
  });
  const thaiQuestion = translations[0];

  return (
    <div className="bg-card rounded-xl p-3 border border-border">
      <div className="flex items-start gap-2">
        <p className="text-foreground text-xs font-semibold leading-relaxed flex-1">
          {label}. {question}
        </p>
        <button
          type="button"
          onClick={() => speakEnglish(question)}
          title={t("lesson.interactive.speakTitle")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300 transition-all hover:bg-teal-500/20 active:scale-95"
        >
          <Volume2 size={14} />
        </button>
      </div>
      {(thaiQuestion || loading) && (
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-teal-700 dark:text-teal-300">
          {thaiQuestion || "Translating question..."}
        </p>
      )}
    </div>
  );
}

export const ArticleDisplay: React.FC<ArticleDisplayProps> = ({
  articleData,
  phase,
  flagCounts,
  onActiveIdxChange,
}) => {
  const words = useMemo(() => articleData?.words || [], [articleData?.words]);
  const sentences = useMemo(
    () => articleData?.sentences || [],
    [articleData?.sentences],
  );

  // "A0" is a placeholder beginner level from the article source; display it as A1 to match the rest of the app.
  const displayCefr =
    articleData?.cefr_level === "A0" ? "A1" : articleData?.cefr_level;

  // Article image URL from GCS
  const articleImageUrl = articleData?.id
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleData.id}.png`
    : null;

  // ── Audio state for Phase 9 ─────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const phase4PassageRef = useRef<HTMLDivElement>(null);
  const phase4VocabRef = useRef<HTMLDivElement>(null);
  const stopAtRef = useRef<number>(Infinity); // for single-sentence mode
  const isSeekingRef = useRef(false); // prevent highlight flickering during seek
  const ttsRequestRef = useRef(0);
  const sentenceTtsActiveRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speechRate, setSpeechRate] = useState(0.75);
  const [autoVocabTh, setAutoVocabTh] = useState<Record<number, string>>({});
  const [autoVocabEnTh, setAutoVocabEnTh] = useState<Record<number, string>>(
    {},
  );

  const sentenceTexts = useMemo(
    () =>
      sentences.map((sentence: any) =>
        typeof sentence === "object"
          ? String(sentence.sentences || "")
          : String(sentence || ""),
      ),
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

  useEffect(() => {
    if (phase !== 4) return;

    const passage = phase4PassageRef.current;
    const vocab = phase4VocabRef.current;
    if (!passage || !vocab) return;

    const syncPanelHeight = () => {
      if (window.innerWidth < 1024) {
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
  }, [phase, thaiPassage, words.length]);

  const audioUrl = articleData?.id
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/tts/${articleData.id}.mp3`
    : null;

  const getSentenceText = (sentenceIdx: number) => {
    const item = sentences[sentenceIdx];
    return typeof item === "object"
      ? String(item?.sentences || "")
      : String(item || "");
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speechRate;
  }, [speechRate]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    // Stop at boundary (single-sentence mode)
    if (t >= stopAtRef.current) {
      audioRef.current.pause();
      stopAtRef.current = Infinity;
      setIsPlaying(false);
      return;
    }
    if (sentenceTtsActiveRef.current && audioRef.current.paused) return;
    if (isSeekingRef.current) return;
    // Find the last sentence whose timeSeconds <= current time
    let idx = -1;
    for (let i = 0; i < sentences.length; i++) {
      const ts =
        typeof sentences[i] === "object" ? sentences[i].timeSeconds : 0;
      if (ts <= t) idx = i;
      else break;
    }
    setActiveIdx(idx);
  };

  // Read a single sentence with browser TTS. This avoids relying on imperfect audio timestamps.
  const seekToSentence = (sentenceIdx: number) => {
    const sentenceText = getSentenceText(sentenceIdx);
    if (!sentenceText) return;
    const requestId = ++ttsRequestRef.current;
    const item = sentences[sentenceIdx];
    const ts: number = typeof item === "object" ? (item.timeSeconds ?? 0) : 0;
    sentenceTtsActiveRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = ts;
    }
    setCurrentTime(ts);
    stopAtRef.current = Infinity;
    isSeekingRef.current = false;
    setActiveIdx(sentenceIdx);
    setIsPlaying(false);
    speakEnglishWithRate(sentenceText, speechRate, () => {
      if (requestId === ttsRequestRef.current) setIsPlaying(false);
    });
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      ttsRequestRef.current++;
      audioRef.current.pause();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      sentenceTtsActiveRef.current = false;
      setIsPlaying(false);
    } else {
      ttsRequestRef.current++;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      sentenceTtsActiveRef.current = false;
      stopAtRef.current = Infinity; // always continuous when pressing Play
      audioRef.current.playbackRate = speechRate;
      audioRef.current.play();
      setIsPlaying(true);
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
    textClassName = "text-foreground/90",
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
          <p className={`${textClassName} text-sm leading-relaxed`}>
            {thaiPassage}
          </p>
        ) : (
          <p className={`${textClassName} text-sm italic opacity-80`}>
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
            {displayCefr && (
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
              if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utt = new SpeechSynthesisUtterance(String(wordText));
                utt.lang = "en-US";
                utt.rate = 0.85;
                window.speechSynthesis.speak(utt);
              }
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
      <div className="flex-1 flex w-full flex-col items-center px-2 py-4 sm:px-3 animate-in fade-in duration-500">
        <div className="mb-4 flex w-full flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Phase 4
          </span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
            Vocabulary Focus
          </span>
          <p className="text-sm text-muted-foreground sm:ml-1">
            {t("lesson.interactive.wordPrefix")}{" "}
            <span className="font-semibold text-foreground">highlight</span>{" "}
            {t("lesson.interactive.vocabInLessonSuffix")}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.12fr_1fr]">
          {/* Passage with highlights */}
          <div
            ref={phase4PassageRef}
            className="flex self-start flex-col rounded-2xl border border-border border-t-2 border-t-amber-400 bg-card p-5 shadow-lg shadow-slate-900/5 sm:p-6"
          >
            <h3 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-amber-600">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-amber-500 text-white">
                <BookOpen size={18} />
              </span>
              Reading Passage
            </h3>
            <p
              className="text-[15px] font-medium leading-[2] text-foreground sm:text-base sm:leading-[2.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {highlightPassage(articleData.passage)}
            </p>
            <div className="pt-5">
              {renderThaiPassageCard("bg-emerald-50/80 dark:bg-emerald-950/25")}
            </div>
          </div>

          {/* Vocab sidebar */}
          <div
            ref={phase4VocabRef}
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 shadow-lg shadow-purple-900/5 sm:p-5"
          >
            <h3 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                <BookOpen size={17} />
              </span>
              Vocabulary List
            </h3>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
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
                    className="grid min-h-[72px] flex-1 grid-cols-[auto_1fr_auto] gap-x-3 rounded-xl border border-purple-500/15 bg-card px-3 py-3 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_minmax(180px,.9fr)_auto] sm:items-center sm:px-4"
                  >
                    <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white sm:mt-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 sm:pr-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-black text-purple-700 dark:text-purple-200">
                          {String(wordText)}
                        </p>
                        {partOfSpeech && (
                          <span className="text-xs text-muted-foreground">
                            ({String(partOfSpeech)})
                          </span>
                        )}
                      </div>
                      {defEn && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                          {defEn}
                        </p>
                      )}
                    </div>
                    <div className="col-start-2 mt-2 min-w-0 border-t border-purple-500/10 pt-2 sm:col-start-auto sm:mt-0 sm:border-l sm:border-t-0 sm:py-1 sm:pl-5">
                      {defTh && (
                        <p className="text-sm font-bold text-purple-600 dark:text-purple-300">
                          {defTh}
                        </p>
                      )}
                      {autoVocabEnTh[i] && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                          {autoVocabEnTh[i]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => speakEnglish(String(wordText))}
                      title={t("lesson.interactive.speakTitle")}
                      className="col-start-3 row-start-1 inline-flex size-9 items-center justify-center self-center rounded-full bg-purple-500/10 text-purple-600 transition-all hover:bg-purple-500/20 active:scale-95 sm:col-start-auto sm:row-start-auto"
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
      <div className="flex-1 flex w-full flex-col items-center px-2 py-4 sm:px-3 animate-in fade-in duration-500">
        <div className="mb-4 flex w-full flex-wrap items-center gap-3">
          <span className="rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Phase 5
          </span>
          <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
            Deep Reading
          </span>
          <span className="rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Analytical Mode
          </span>
        </div>

        <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,.8fr)]">
          {/* Passage - high contrast indigo-950 deep */}
          <div className="min-w-0">
            <div className="rounded-2xl border-t-4 border-teal-400 bg-indigo-950 p-5 shadow-2xl sm:p-7">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-teal-400">
                {articleData.title}
              </h3>
              <p
                className="text-base font-medium leading-[2] text-indigo-100 sm:text-lg sm:leading-[2.05]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {articleData.passage}
              </p>
              {renderThaiPassageCard(
                "mt-5 bg-teal-500/10 border-teal-400/30",
                "text-teal-50",
                "text-teal-400",
              )}
            </div>
          </div>

          {/* Comprehension Guide */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border-2 border-border bg-muted p-5">
              <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                <span>Guide</span> Comprehension Guide
              </h4>
              <p className="text-muted-foreground text-xs mb-4">
                {t("lesson.interactive.comprehensionGuideHelp")}
              </p>
              {comprehensionQuestions.length > 0 ? (
                <div className="space-y-3">
                  {comprehensionQuestions.map((q: any, i: number) => (
                    <GuideQuestionCard
                      key={i}
                      label={`Q${i + 1}`}
                      question={q.question}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  {t("lesson.interactive.comprehensionFallback")}
                </p>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h4 className="font-bold text-foreground text-sm mb-2">
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
      <div className="flex-1 flex w-full flex-col items-center px-2 py-4 sm:px-3 animate-in fade-in duration-500">
        <div className="mb-4 flex w-full flex-wrap items-center gap-3">
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

        <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          {/* Timeline */}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>List</span> Key Sentences Timeline
            </h3>
            <div className="relative lg:max-h-[68vh] lg:overflow-y-auto lg:pr-2">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-green-500/30" />
              <div className="space-y-4">
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
                        className="flex gap-4 items-start animate-in slide-in-from-left duration-500"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <div
                          className={`relative z-10 w-8 h-8 rounded-full ${d} flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md`}
                        >
                          {index + 1}
                        </div>
                        <div
                          className={`flex-1 border-l-4 rounded-xl p-4 shadow-sm ${c}`}
                        >
                          <p className="text-foreground font-semibold text-base leading-relaxed">
                            {highlightVocab(String(sentenceText))}
                          </p>
                          {thaiText && (
                            <p className="mt-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium leading-relaxed">
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
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>Article</span> Passage Reference
            </h3>
            <div className="rounded-2xl border-t-4 border-green-400 bg-card p-5 shadow-xl sm:p-6 lg:max-h-[62vh] lg:overflow-y-auto">
              <p className="text-base leading-[2] text-foreground sm:text-lg sm:leading-[2.05]">
                {articleData.passage}
              </p>
              {renderThaiPassageCard("mt-5")}
            </div>
            <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
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
    const fmtTime = (s: number) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const cycleSpeechRate = () => {
      const currentIndex = TTS_RATES.findIndex((rate) => rate === speechRate);
      const nextRate =
        TTS_RATES[(currentIndex + 1) % TTS_RATES.length] ?? TTS_RATES[0];
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
          const text: string = typeof item === "object" ? item.sentences : item;
          const ts: number =
            typeof item === "object" ? (item.timeSeconds ?? 0) : 0;
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

    const activeSentence = activeIdx >= 0 ? sentences[activeIdx] : null;
    const activeThText = activeIdx >= 0 ? thaiSentences[activeIdx] : null;
    const activeEnText = activeSentence
      ? typeof activeSentence === "object"
        ? activeSentence.sentences
        : activeSentence
      : null;

    return (
      <div className="flex-1 flex flex-col w-full bg-muted relative">
        {/* Hidden audio */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={() => {
              isSeekingRef.current = false;
            }}
            onLoadedMetadata={() =>
              setDuration(audioRef.current?.duration || 0)
            }
            onEnded={() => setIsPlaying(false)}
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
            {articleData.genre && (
              <p className="text-muted-foreground text-sm">
                {articleData.genre} / CEFR {displayCefr}
              </p>
            )}
          </div>

          {/* Article body - flowing paragraphs with inline highlights */}
          <div
            className="mx-auto w-full max-w-[1500px] rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {paragraphGroups.map((group, pIdx) => (
              <p
                key={pIdx}
                className="mb-5 text-base leading-[2] last:mb-0 sm:text-lg sm:leading-[2.05]"
              >
                {group.length > 0 ? (
                  group.map(({ idx, text, ts }) => {
                    const isActive = idx === activeIdx;
                    const flagCount = flagCounts?.[idx] || 0;
                    const isFlagged = flagCount > 0;
                    return (
                      <span
                        id={`read-sentence-${idx}`}
                        key={idx}
                        onClick={() => seekToSentence(idx)}
                        className={`cursor-pointer rounded-lg px-0.5 transition-all duration-200 ${
                          isActive
                            ? "bg-orange-400 text-white font-bold px-2 py-0.5 rounded-xl shadow-md"
                            : isFlagged
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold rounded-lg px-1 ring-1 ring-rose-400/50"
                              : "text-foreground hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
                        }`}
                      >
                        {text}
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
        </div>

        {/* Floating mini audio player - bottom-center */}
        {audioUrl && (
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
                      ttsRequestRef.current++;
                      if (
                        typeof window !== "undefined" &&
                        window.speechSynthesis
                      ) {
                        window.speechSynthesis.cancel();
                      }
                      sentenceTtsActiveRef.current = false;
                      audioRef.current.playbackRate = speechRate;
                      audioRef.current.currentTime = ratio * duration;
                      audioRef.current.play();
                      setIsPlaying(true);
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
