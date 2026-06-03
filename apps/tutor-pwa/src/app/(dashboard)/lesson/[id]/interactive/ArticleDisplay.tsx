import React, { useRef, useState, useEffect, useMemo } from "react";
import { t } from "@/lib/i18n";
import { Volume2 } from "lucide-react";

interface ArticleDisplayProps {
  articleData: any;
  phase: number;
  flagCounts?: Record<number, number>;
}

export const ArticleDisplay: React.FC<ArticleDisplayProps> = ({
  articleData,
  phase,
  flagCounts,
}) => {
  const words = useMemo(() => articleData?.words || [], [articleData?.words]);
  const sentences = useMemo(() => articleData?.sentences || [], [articleData?.sentences]);

  // Article image URL from GCS
  const articleImageUrl = articleData?.id
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleData.id}.png`
    : null;

  // ── Audio state for Phase 9 ─────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAtRef = useRef<number>(Infinity); // for single-sentence mode
  const isSeekingRef = useRef(false); // prevent highlight flickering during seek
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoThaiSentences, setAutoThaiSentences] = useState<string[]>([]);
  const [autoVocabTh, setAutoVocabTh] = useState<Record<number, string>>({});
  const [autoVocabEnTh, setAutoVocabEnTh] = useState<Record<number, string>>({});

  const audioUrl = articleData?.id
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/tts/${articleData.id}.mp3`
    : null;

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
    if (isSeekingRef.current) return;
    // Find the last sentence whose timeSeconds <= current time
    let idx = -1;
    for (let i = 0; i < sentences.length; i++) {
      const ts = typeof sentences[i] === "object" ? sentences[i].timeSeconds : 0;
      if (ts <= t) idx = i;
      else break;
    }
    setActiveIdx(idx);
  };

  // Seek to a sentence index and play ONLY that sentence (single-sentence mode)
  const seekToSentence = (sentenceIdx: number) => {
    if (!audioRef.current) return;
    isSeekingRef.current = true;
    const item = sentences[sentenceIdx];
    const ts: number = typeof item === "object" ? item.timeSeconds ?? 0 : 0;
    // Stop 0.5s before the NEXT sentence starts (natural pause)
    const nextItem = sentences[sentenceIdx + 1];
    const nextTs = nextItem
      ? (typeof nextItem === "object" ? nextItem.timeSeconds : Infinity)
      : Infinity;
    stopAtRef.current = nextTs === Infinity ? Infinity : nextTs - 0.5;
    audioRef.current.currentTime = ts;
    audioRef.current.play();
    setActiveIdx(sentenceIdx);
    setIsPlaying(true);
  };

  // seekTo used by progress bar / metadata seek (continuous)
  const seekTo = (timeSeconds: number) => {
    if (!audioRef.current) return;
    isSeekingRef.current = true;
    stopAtRef.current = Infinity; // continuous mode
    audioRef.current.currentTime = timeSeconds;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      stopAtRef.current = Infinity; // always continuous when pressing Play
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

  // Auto-translate vocab words and English definitions
  useEffect(() => {
    if (phase !== 2 && phase !== 4) return;

    // 1. Find words missing a short Thai translation (definition.th)
    const missingTh: { index: number; text: string }[] = [];
    words.forEach((item: any, i: number) => {
      const wordText = typeof item === "object" ? item.vocabulary || item.word || item.text : item;
      const hasTh = typeof item === "object" && item.definition?.th;
      if (!hasTh && wordText) {
        missingTh.push({ index: i, text: String(wordText) });
      }
    });

    // 2. Find words with English definitions (definition.en) to translate to Thai explanations
    const missingEnTh: { index: number; text: string }[] = [];
    words.forEach((item: any, i: number) => {
      const enText = typeof item === "object" && item.definition?.en ? item.definition.en : null;
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
          missingTh.forEach((m, j) => { map[m.index] = data.translations[j]; });
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
          missingEnTh.forEach((m, j) => { map[m.index] = data.translations[j]; });
          setAutoVocabEnTh(map);
        })
        .catch(() => {});
    }
  }, [phase, words]);

  // Auto-translate sentences when no Thai translation available
  useEffect(() => {
    if (!articleData || phase !== 3) return;
    const hasThai = (articleData.translated_passage?.th?.length ?? 0) > 0;
    if (hasThai || sentences.length === 0) return;
    const texts = sentences.map((s: any) =>
      typeof s === "object" ? s.sentences : s
    );
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.translations) setAutoThaiSentences(data.translations);
      })
      .catch(() => {}); // silently fail
  }, [phase, articleData, sentences]);

  if (!articleData) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t("lesson.interactive.articleLoading")}
      </div>
    );
  }

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
                (e.target as HTMLImageElement).style.display = 'none';
                ((e.target as HTMLImageElement).parentElement as HTMLElement).classList.add('bg-gradient-to-br', 'from-indigo-600', 'via-purple-600', 'to-fuchsia-600');
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
            {articleData.cefr_level && (
              <span className="bg-indigo-500/80 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full">
                CEFR {articleData.cefr_level}
              </span>
            )}
          </div>
          {/* Stat chips at bottom of image */}
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3">
            <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">{t("lesson.interactive.vocabulary")}</p>
              <p className="text-white font-black text-xl">{words.length}</p>
            </div>
            <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">{t("lesson.interactive.keySentences")}</p>
              <p className="text-white font-black text-xl">{sentences.length}</p>
            </div>
            <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">Step</p>
              <p className="text-white font-black text-xl">1 / 13</p>
            </div>
          </div>
        </div>

        {/* Right 55%: Title + Checklist */}
        <div className="flex-1 flex flex-col justify-center gap-5">
          {/* Badge row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-500 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">{t("lesson.interactive.step1")}</span>
            <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/20">{t("lesson.interactive.period1")}</span>
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
              { num: "1", emoji: "💬", title: t("lesson.interactive.introChecklistIntroduceTitle"), desc: t("lesson.interactive.introChecklistIntroduceDesc") },
              { num: "2", emoji: "🎯", title: t("lesson.interactive.introChecklistGoalTitle"), desc: t("lesson.interactive.introChecklistGoalDesc") },
              { num: "3", emoji: "✨", title: t("lesson.interactive.introChecklistSparkTitle"), desc: t("lesson.interactive.introChecklistSparkDesc") },
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
                  <p className="font-bold text-foreground text-sm">{item.title}</p>
                  <p className="text-indigo-600 dark:text-indigo-400 text-xs mt-0.5">{item.desc}</p>
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
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-5xl">
          <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Phase 4
          </span>
          <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/20">
            Vocabulary Focus
          </span>
          <p className="text-muted-foreground text-sm ml-2">
            {t("lesson.interactive.wordPrefix")}{" "}
            <mark className="bg-[var(--highlight-bg)] text-[var(--highlight-text)] px-1 rounded not-italic">
              highlight
            </mark>{" "}
            {t("lesson.interactive.vocabInLessonSuffix")}
          </p>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          {/* Passage with highlights */}
          <div className="col-span-12 md:col-span-7">
            <div className="bg-card rounded-2xl shadow-xl border-t-4 border-amber-400 p-8">
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-4">
                Reading Passage
              </h3>
              <p
                className="text-foreground text-lg leading-[2.4] font-medium"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {highlightPassage(articleData.passage)}
              </p>
            </div>
          </div>

          {/* Vocab sidebar */}
          <div className="col-span-12 md:col-span-5">
            <div className="bg-purple-500/10 border-2 border-purple-500/20 rounded-2xl p-5 sticky top-4">
              <h3 className="text-sm font-bold text-purple-800 dark:text-purple-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>📚</span> Vocabulary List
              </h3>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
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
                  return (
                    <div
                      key={i}
                      className="bg-card rounded-xl p-3 border border-purple-500/20 shadow-sm"
                    >
                      <p className="font-black text-purple-900 dark:text-purple-100 text-base">
                        {String(wordText)}
                      </p>
                      {defTh && (
                        <p className="text-purple-700 dark:text-purple-300 text-sm font-medium mt-0.5">
                          {defTh}
                        </p>
                      )}
                      {defEn && (
                        <div className="mt-1 space-y-1">
                          <p className="text-muted-foreground text-xs italic">{defEn}</p>
                          {autoVocabEnTh[i] && (
                            <p className="text-purple-600 dark:text-purple-400 font-semibold text-xs border-t border-purple-500/20 pt-1">
                              {autoVocabEnTh[i]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-5xl">
          <span className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Phase 5
          </span>
          <span className="bg-teal-500/10 text-teal-700 dark:text-teal-400 text-xs font-bold px-3 py-1 rounded-full border border-teal-500/20">
            Deep Reading
          </span>
          <span className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
            Analytical Mode
          </span>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          {/* Passage - high contrast indigo-950 deep */}
          <div className="col-span-12 md:col-span-8">
            <div className="bg-indigo-950 rounded-2xl shadow-2xl p-10 border-t-4 border-teal-400">
              <h3 className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-6">
                {articleData.title}
              </h3>
              <p
                className="text-indigo-100 text-xl leading-[2.4] font-medium"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {articleData.passage}
              </p>
            </div>
          </div>

          {/* Comprehension Guide */}
          <div className="col-span-12 md:col-span-4 space-y-4">
            <div className="bg-muted border-2 border-border rounded-2xl p-5">
              <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                <span>Guide</span> Comprehension Guide
              </h4>
              <p className="text-muted-foreground text-xs mb-4">
                {t("lesson.interactive.comprehensionGuideHelp")}
              </p>
              {comprehensionQuestions.length > 0 ? (
                <div className="space-y-3">
                  {comprehensionQuestions.map((q: any, i: number) => (
                    <div
                      key={i}
                      className="bg-card rounded-xl p-3 border border-border"
                    >
                      <p className="text-foreground text-xs font-semibold">
                        Q{i + 1}. {q.question}
                      </p>
                    </div>
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
    const scoredKeySentences: Array<{ item: any; index: number; score: number }> = sentences
      .map((item: any, index: number) => {
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
      .map(({ item }) => item);

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
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-5xl">
          <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Phase 6
          </span>
          <span className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/20">
            Key Sentences
          </span>
          <p className="text-muted-foreground text-xs ml-2">
            {keySentences.length} {t("lesson.interactive.keySentenceCountSuffix")}
          </p>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          {/* Timeline */}
          <div className="col-span-12 md:col-span-6">
            <h3 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>List</span> Key Sentences Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-green-500/30" />
              <div className="space-y-4">
                {keySentences.map((item: any, index: number) => {
                  const sentenceText =
                    typeof item === "object" ? item.sentences : item;
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
                      </div>
                    </div>
                  );
                })}
                {keySentences.length === 0 && (
                  <p className="text-muted-foreground text-sm pl-10">
                    {t("lesson.interactive.noKeySentences")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Passage with context */}
          <div className="col-span-12 md:col-span-6">
            <h3 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>Article</span> Passage Reference
            </h3>
            <div className="bg-card rounded-2xl shadow-xl border-t-4 border-green-400 p-6">
              <p className="text-foreground text-base leading-[2.2]">
                {articleData.passage}
              </p>
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
    const thaiSentences: string[] =
      (articleData.translated_passage?.th?.length ?? 0) > 0
        ? articleData.translated_passage.th
        : autoThaiSentences;
    const fmtTime = (s: number) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

    // Build paragraphs: split passage by newlines, then map each sentence to inline spans
    const rawParagraphs: string[] = (articleData.passage || "")
      .split(/\n+/)
      .map((p: string) => p.trim())
      .filter(Boolean);

    // Assign sentences to paragraphs by matching text content
    let sentIdx = 0;
    const paragraphGroups: { idx: number; text: string; ts: number }[][] = rawParagraphs.map((para) => {
      const group: { idx: number; text: string; ts: number }[] = [];
      while (sentIdx < sentences.length) {
        const item = sentences[sentIdx];
        const text: string = typeof item === "object" ? item.sentences : item;
        const ts: number = typeof item === "object" ? item.timeSeconds ?? 0 : 0;
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
      ? typeof activeSentence === "object" ? activeSentence.sentences : activeSentence
      : null;

    return (
      <div className="flex-1 flex flex-col w-full bg-muted relative">
        {/* Hidden audio */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={() => { isSeekingRef.current = false; }}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {/* Scrollable article area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 pb-48">
          {/* Header */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-orange-500 text-white text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow">
                {t("lesson.interactive.step3")}
              </span>
              <span className="bg-card text-orange-600 dark:text-orange-400 text-sm font-bold px-4 py-1.5 rounded-full border-2 border-orange-500/30">
                {t("lesson.interactive.period1")}
              </span>
            </div>
            <h2 className="text-3xl font-black text-foreground mb-1">{articleData.title}</h2>
            {articleData.genre && (
              <p className="text-muted-foreground text-sm">{articleData.genre} / CEFR {articleData.cefr_level}</p>
            )}
          </div>

          {/* Article body - flowing paragraphs with inline highlights */}
          <div
            className="max-w-3xl mx-auto bg-card rounded-3xl shadow-xl border border-border p-10"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {paragraphGroups.map((group, pIdx) => (
              <p key={pIdx} className="text-xl leading-[2.2] mb-6 last:mb-0">
                {group.length > 0
                  ? group.map(({ idx, text, ts }) => {
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
                          )}
                          {" "}
                        </span>
                      );
                    })
                  : // Fallback for unmatched paragraph text
                    <span className="text-foreground">{rawParagraphs[pIdx]} </span>
                }
              </p>
            ))}
          </div>
        </div>

        {/* Floating mini audio player - bottom-center */}
        {audioUrl && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
            {/* Translation tooltip above player */}
            {activeEnText && (
              <div
                className="bg-card border border-orange-200 rounded-2xl shadow-xl px-4 py-3 max-w-xs animate-in slide-in-from-bottom duration-200"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <p className="text-foreground font-semibold text-sm leading-snug">{activeEnText}</p>
                {activeThText ? (
                  <p className="text-orange-600 text-xs mt-1 leading-snug">{activeThText}</p>
                ) : (
                  <p className="text-slate-300 text-xs mt-1 italic">{t("lesson.interactive.translateSentencePrompt")}</p>
                )}
              </div>
            )}

              {/* Player pill */}
            <div className="bg-card border-2 border-orange-500/40 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 w-[500px]">
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

              {/* Skip next */}
              <button
                onClick={() => {
                  if (activeIdx < sentences.length - 1) seekToSentence(activeIdx + 1);
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
                    {activeIdx >= 0 ? `${t("lesson.interactive.sentencePrefix")} ${activeIdx + 1} / ${sentences.length}` : "-"}
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
        </div>
      )}
    </div>
  );
};
