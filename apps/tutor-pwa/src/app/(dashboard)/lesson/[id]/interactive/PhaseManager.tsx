import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArticleDisplay } from "./ArticleDisplay";
import { ChevronRight, Check, Maximize2, Minimize2 } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { t } from "@/lib/i18n";
import confetti from "canvas-confetti";

function seededShuffle<T>(array: T[], seedInput: string): T[] {
  const result = [...array];
  if (!seedInput) return result;

  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed += seedInput.charCodeAt(i);
  }

  for (let i = result.length - 1; i > 0; i--) {
    // Use a stable sine-based pseudo-random generator
    const x = Math.sin(seed + i) * 10000;
    const rand = x - Math.floor(x);
    const j = Math.floor(rand * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface PhaseManagerProps {
  currentPhase: number;
  participants: any[];
  totalAnswered: number;
  allAnsweredData: any[];
  articleData?: any;
  changePhase: (phase: number) => void;
  sessionData?: any;
  onFinishSession?: () => void;
  flagCounts?: Record<number, number>;
}

// ── Live Leaderboard Sidebar (Desktop) ───────────────────────────────────────
function LiveLeaderboard({ participants }: { participants: any[] }) {
  const sorted = [...participants].sort(
    (a, b) => (b.score || 0) - (a.score || 0),
  );
  const maxScore = Math.max(...sorted.map((p) => p.score || 0), 1);

  return (
    <div className="w-full lg:w-72 shrink-0 flex flex-col rounded-2xl overflow-hidden border border-border/60 bg-card/60 backdrop-blur shadow-xl">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-amber-400/20 flex items-center justify-center">
            <span className="text-base">🏆</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">
              Leaderboard
            </p>
            <p className="text-slate-400 text-[10px] mt-0.5">
              {sorted.length} นักเรียน
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold">Live</span>
        </div>
      </div>

      {/* Rank list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <span className="text-2xl">👥</span>
            <p className="text-muted-foreground text-xs">ยังไม่มีข้อมูลคะแนน</p>
          </div>
        ) : (
          sorted.map((p, i) => {
            const rank = i + 1;
            const scorePct =
              maxScore > 0 ? ((p.score || 0) / maxScore) * 100 : 0;
            const rankEmoji =
              rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            const cardStyle =
              rank === 1
                ? "bg-amber-500/10 border-amber-400/30"
                : rank === 2
                  ? "bg-slate-400/10 border-slate-400/20"
                  : rank === 3
                    ? "bg-orange-400/10 border-orange-400/20"
                    : "bg-muted/40 border-border/40";
            const barStyle =
              rank === 1
                ? "bg-amber-400"
                : rank === 2
                  ? "bg-slate-400"
                  : rank === 3
                    ? "bg-orange-400"
                    : "bg-indigo-400";
            const scoreStyle =
              rank === 1
                ? "text-amber-500"
                : rank === 2
                  ? "text-slate-400"
                  : rank === 3
                    ? "text-orange-400"
                    : "text-foreground";

            return (
              <div
                key={p.studentId || i}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 border transition-all duration-500 ${cardStyle}`}
              >
                {/* Rank */}
                <div className="w-6 text-center shrink-0">
                  {rankEmoji ? (
                    <span className="text-base leading-none">{rankEmoji}</span>
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      #{rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="size-8 rounded-full overflow-hidden border-2 border-border/60 shrink-0 bg-muted flex items-center justify-center">
                  {p.pictureUrl ? (
                    <img
                      src={p.pictureUrl}
                      alt={p.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {(p.name || "?").slice(0, 2)}
                    </span>
                  )}
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate leading-none mb-1.5">
                    {p.name}
                  </p>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barStyle}`}
                      style={{
                        width: `${Math.max(scorePct, (p.score || 0) > 0 ? 3 : 0)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-black tabular-nums ${scoreStyle}`}
                  >
                    {p.score || 0}
                  </p>
                  <p className="text-[9px] text-muted-foreground">pts</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FitToViewport({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = window.requestAnimationFrame(() => {
        const frameEl = frameRef.current;
        const contentEl = contentRef.current;
        if (!frameEl || !contentEl) return;

        const availableWidth = frameEl.clientWidth;
        const availableHeight = frameEl.clientHeight;
        const contentWidth = contentEl.scrollWidth;
        const contentHeight = contentEl.scrollHeight;

        if (
          !availableWidth ||
          !availableHeight ||
          !contentWidth ||
          !contentHeight
        ) {
          setScale(1);
          return;
        }

        setScale(
          Math.min(
            1,
            availableWidth / contentWidth,
            availableHeight / contentHeight,
          ),
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (frameRef.current) observer.observe(frameRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, children]);

  return (
    <div
      ref={frameRef}
      className={`flex-1 min-h-0 ${enabled ? "overflow-hidden" : "overflow-visible"}`}
    >
      <div
        ref={contentRef}
        className="flex h-full min-h-0 w-full flex-col"
        style={{
          transform: enabled ? `scale(${scale})` : undefined,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const PhaseManager: React.FC<PhaseManagerProps> = ({
  currentPhase,
  participants,
  totalAnswered,
  allAnsweredData,
  articleData,
  changePhase,
  sessionData,
  onFinishSession,
  flagCounts,
}) => {
  const [isChangingPhase, setIsChangingPhase] = React.useState(false);
  const [canProceedDelayed, setCanProceedDelayed] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Dev-only: mock participant list to preview the wrap-up leaderboard
  const [mockLeaderboard, setMockLeaderboard] = React.useState<any[] | null>(null);
  // Dev-only: mock pairs to preview the Step 14 pair-conversation layout
  const [mockPairs, setMockPairs] = React.useState<
    { pairNumber: number; members: { studentId: string; name: string; pictureUrl?: string }[] }[] | null
  >(null);
  const fullscreenRef = React.useRef<HTMLDivElement>(null);

  // Reset loading state when phase actually changes
  React.useEffect(() => {
    setIsChangingPhase(false);
  }, [currentPhase]);

  const isInteractivePhase = [7, 8, 9, 10, 11, 12, 13, 14].includes(
    currentPhase,
  );
  const totalParticipants = participants.length;

  // Can proceed if everyone answered OR if results are already showing OR if no participants
  const canProceed =
    !isInteractivePhase ||
    totalParticipants === 0 ||
    totalAnswered >= totalParticipants ||
    (allAnsweredData && allAnsweredData.length > 0);

  React.useEffect(() => {
    if (canProceed) {
      const timer = setTimeout(() => {
        setCanProceedDelayed(true);
      }, 1000); // 1 sec delay before allowing proceeding
      return () => clearTimeout(timer);
    } else {
      setCanProceedDelayed(false);
    }
  }, [canProceed]);

  const handleNextPhase = React.useCallback(() => {
    if (!isChangingPhase && canProceedDelayed) {
      setIsChangingPhase(true);
      playSound("phaseChange");
      if (currentPhase < 16) {
        changePhase(currentPhase + 1);
      } else {
        // Safely loop back to lobby (Phase 0).
        // The Backend is now smart enough to automatically cycle a fresh DB session
        // the moment instruction begins again, providing unbroken continuity!
        changePhase(0);
      }
    }
  }, [currentPhase, isChangingPhase, canProceedDelayed, changePhase]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
        return;
      }

      if (e.key === "ArrowRight" && canProceedDelayed && !isChangingPhase) {
        handleNextPhase();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleNextPhase,
    canProceedDelayed,
    isChangingPhase,
    currentPhase,
    isFullscreen,
  ]);

  React.useEffect(() => {
    const fullscreenElement = fullscreenRef.current;
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (document.fullscreenElement === fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const toggleFullscreen = React.useCallback(async () => {
    const fullscreenElement = fullscreenRef.current;

    if (isFullscreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      setIsFullscreen(false);
      return;
    }

    setIsFullscreen(true);
    if (fullscreenElement?.requestFullscreen) {
      await fullscreenElement.requestFullscreen().catch(() => undefined);
    }
  }, [isFullscreen]);

  // Confetti effect when results are ready
  React.useEffect(() => {
    if ([7, 9, 10, 11].includes(currentPhase) && allAnsweredData.length > 0) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
        disableForReducedMotion: true,
      });
    }
  }, [currentPhase, allAnsweredData.length]);

  const renderLobby = () => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <h2 className="text-3xl font-bold mb-8 text-foreground">
        {t("lesson.interactive.waitingStudents")}
      </h2>
      <div className="flex gap-4 flex-wrap justify-center max-w-2xl">
        {participants.map((p, i) => (
          <div
            key={i}
            className="bg-muted rounded-full px-6 py-3 shadow-sm font-medium text-foreground"
          >
            {p.name}
          </div>
        ))}
      </div>
      {participants.length === 0 && (
        <p className="text-muted-foreground mt-4">
          {t("lesson.interactive.noJoinedYet")}
        </p>
      )}
    </div>
  );

  const renderPresentation = () => (
    <ArticleDisplay
      articleData={articleData}
      phase={currentPhase}
      flagCounts={flagCounts}
    />
  );

  const renderKahootGame = (
    question: string,
    mappedOptions: Record<string, string>,
    correctAnswer: string,
  ) => {
    if (allAnsweredData.length > 0) {
      // Show results chart — EduPop colors
      const optionFills: Record<string, string> = {
        A: "#f43f5e",
        B: "#0ea5e9",
        C: "#f59e0b",
        D: "#10b981",
      };
      const data = ["A", "B", "C", "D"].map((key) => ({
        name: key,
        count: allAnsweredData.filter((a) => a.answer === key).length,
        fill: correctAnswer === key ? "#10b981" : optionFills[key] || "#94a3b8",
      }));

      const correctCount = allAnsweredData.filter(
        (a) => a.answer === correctAnswer,
      ).length;
      const wrongCount = allAnsweredData.length - correctCount;
      const accuracy =
        allAnsweredData.length > 0
          ? Math.round((correctCount / allAnsweredData.length) * 100)
          : 0;

      return (
        <div className="flex-1 flex flex-col items-center gap-5 px-2">
          {/* Correct answer reveal banner */}
          <div className="w-full max-w-3xl bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-5 text-white flex items-center gap-4 shadow-xl shadow-emerald-500/20">
            <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0">
              ✅
            </div>
            <div>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">
                {t("lesson.interactive.correctAnswer")}
              </p>
              <h3 className="text-2xl font-black leading-snug">
                {correctAnswer}: {mappedOptions[correctAnswer]}
              </h3>
            </div>
            <div className="ml-auto text-center shrink-0 bg-white/20 rounded-2xl px-5 py-3">
              <p className="text-5xl font-black">{accuracy}%</p>
              <p className="text-emerald-100 text-xs font-bold">Accuracy</p>
            </div>
          </div>

          <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
            {/* Bar chart */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {t("lesson.interactive.answerSummary")}
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 18, fontWeight: 900 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 13,
                      }}
                      cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={72}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col gap-3 w-44">
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex flex-col items-center text-center">
                <span className="text-2xl mb-1">✅</span>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {correctCount}
                </p>
                <p className="text-xs font-bold text-emerald-500 uppercase">
                  {t("lesson.interactive.correctPrefix")}
                </p>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 flex flex-col items-center text-center">
                <span className="text-2xl mb-1">❌</span>
                <p className="text-3xl font-black text-rose-500">
                  {wrongCount}
                </p>
                <p className="text-xs font-bold text-rose-400 uppercase">
                  {t("lesson.interactive.wrongPrefix")}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const displayKeys = Object.keys(mappedOptions).sort();

    // EduPop color palette per option
    const optionStyles: Record<
      string,
      { bg: string; shadow: string; badge: string }
    > = {
      A: {
        bg: "bg-rose-500",
        shadow: "shadow-[0_6px_0_theme(colors.rose.700)]",
        badge: "bg-rose-700/40",
      },
      B: {
        bg: "bg-sky-500",
        shadow: "shadow-[0_6px_0_theme(colors.sky.700)]",
        badge: "bg-sky-700/40",
      },
      C: {
        bg: "bg-amber-400",
        shadow: "shadow-[0_6px_0_theme(colors.amber.600)]",
        badge: "bg-amber-600/40",
      },
      D: {
        bg: "bg-emerald-500",
        shadow: "shadow-[0_6px_0_theme(colors.emerald.700)]",
        badge: "bg-emerald-700/40",
      },
    };

    return (
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        {/* Left: Question + Options */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 min-w-0 overflow-hidden">
          {/* Question card with indigo gradient header */}
          <div className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-xl border border-indigo-500/20">
            <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-5">
              <div className="flex items-center gap-2 mb-2 opacity-80">
                <span className="size-2 rounded-full bg-white animate-pulse" />
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest">
                  Multiple Choice
                </span>
              </div>
              <h2 className="text-2xl font-black text-white leading-snug">
                {question}
              </h2>
            </div>
          </div>

          {/* 2×2 EduPop option tiles */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
            {displayKeys.map((key) => {
              const style = optionStyles[key] || {
                bg: "bg-slate-500",
                shadow: "shadow-[0_6px_0_theme(colors.slate.700)]",
                badge: "bg-slate-700/40",
              };
              return (
                <div
                  key={key}
                  className={`${style.bg} ${style.shadow} text-white p-5 rounded-2xl font-bold flex items-center gap-3 transition-transform active:translate-y-1 active:shadow-none`}
                >
                  <span
                    className={`${style.badge} text-white text-lg font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}
                  >
                    {key}
                  </span>
                  <span className="text-base leading-snug">
                    {mappedOptions[key]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Submitted counter */}
          <div className="flex items-center gap-2 bg-muted border border-border px-6 py-2.5 rounded-full">
            <span className="size-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-sm font-bold text-foreground">
              {t("lesson.interactive.answersSubmitted")} {totalAnswered} /{" "}
              {totalParticipants} {t("lesson.interactive.peopleUnit")}
            </span>
          </div>
        </div>

        {/* Right: Live Leaderboard */}
        <LiveLeaderboard participants={participants} />
      </div>
    );
  };

  const renderMCQ = () => {
    const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
    const mcqQuestion = articleData?.multipleChoiceQuestions?.[idx];
    const rawAnswer = mcqQuestion?.answer || "";
    const optionsData = mcqQuestion?.options || {};
    const optionKeys = Object.keys(optionsData).sort();

    // 1. Try to match raw answer string against full option text
    let answerIdx = -1;
    optionKeys.forEach((key, i) => {
      if (optionsData[key] === rawAnswer) {
        answerIdx = i;
      }
    });

    // 2. Fallback: Check if it is an index or key like "1"
    if (answerIdx === -1) {
      const i = optionKeys.indexOf(rawAnswer);
      if (i !== -1) {
        answerIdx = i;
      } else {
        // Fallback 3: Is it "A", "B", "C", "D"?
        const labelIdx = String(rawAnswer).charCodeAt(0) - 65;
        if (labelIdx >= 0 && labelIdx < optionKeys.length) {
          answerIdx = labelIdx;
        }
      }
    }

    const rawOptions = optionKeys.map((key) => optionsData[key]);
    const correctOptionText =
      answerIdx !== -1 ? rawOptions[answerIdx] : rawAnswer;

    // Deterministic shuffle tied to session ID so frontend matches backend perfectly
    const shuffledOptions = seededShuffle(
      rawOptions,
      (sessionData?.sessionId || "fallback") +
        "_phase7_" +
        mcqQuestion?.question,
    );

    // Now find the new index of correct text
    const newCorrectIdx = shuffledOptions.indexOf(correctOptionText);
    const correctAnswer =
      newCorrectIdx !== -1
        ? String.fromCharCode(65 + newCorrectIdx)
        : rawAnswer;

    // Map to A, B, C, D for UI
    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    return renderKahootGame(
      mcqQuestion?.question || t("lesson.interactive.genericQuestion"),
      mappedOptions,
      correctAnswer,
    );
  };

  const renderVocabKahoot = () => {
    const words = articleData?.words || [];
    if (words.length < 4)
      return (
        <div className="flex-1 flex items-center justify-center text-xl">
          {t("lesson.interactive.notEnoughVocab")}
        </div>
      );

    const idx = sessionData?.phaseSelectedIndices?.[9] || 0;
    const targetWord = words[idx] || words[0];
    const question = `${t("lesson.interactive.vocabQuestionPrefix")} "${targetWord.vocabulary || targetWord.word || targetWord.text}" ${t("lesson.interactive.vocabQuestionSuffix")}`;

    const correctTranslation =
      targetWord.definition?.th ||
      targetWord.translation ||
      t("lesson.interactive.correctMeaningFallback");
    const distractorWords = words.filter((w: any, i: number) => i !== idx);

    const usedTranslations = new Set<string>([correctTranslation]);
    const optionsArray: string[] = [correctTranslation];

    distractorWords.forEach((w: any) => {
      const trans = w?.definition?.th || w?.translation;
      if (trans && !usedTranslations.has(trans) && optionsArray.length < 4) {
        usedTranslations.add(trans);
        optionsArray.push(trans);
      }
    });

    let fillCounter = 1;
    while (optionsArray.length < 4) {
      const fb = `${t("lesson.interactive.otherMeaningPrefix")} ${String.fromCharCode(65 + fillCounter)}`;
      if (!usedTranslations.has(fb)) {
        usedTranslations.add(fb);
        optionsArray.push(fb);
      }
      fillCounter++;
    }

    const shuffledOptions = seededShuffle(
      optionsArray,
      (sessionData?.sessionId || "fallback") +
        "_phase10_" +
        targetWord?.vocabulary,
    );

    const newCorrectIdx = shuffledOptions.indexOf(correctTranslation);
    const correctLabel = String.fromCharCode(65 + newCorrectIdx);

    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    return renderKahootGame(question, mappedOptions, correctLabel);
  };

  const renderSentenceFlashcardKahoot = () => {
    const sentences = articleData?.sentences || [];
    if (sentences.length < 1)
      return (
        <div className="flex-1 flex items-center justify-center text-xl">
          {t("lesson.interactive.notEnoughSentences")}
        </div>
      );

    const idx = sessionData?.phaseSelectedIndices?.[10] || 0;
    const targetSentence =
      typeof sentences[idx] === "object"
        ? sentences[idx].sentences
        : sentences[idx];
    const words = String(targetSentence).split(" ");
    if (words.length < 3)
      return (
        <div className="flex-1 flex items-center justify-center text-xl">
          {t("lesson.interactive.sentenceTooShort")}
        </div>
      );

    const correctWord = words[words.length - 1].replace(/[.,!?]/g, "");
    const displaySentence =
      words.slice(0, words.length - 1).join(" ") + " _____";

    const question = `${t("lesson.interactive.fillBlankPrefix")} ${displaySentence}`;

    const vocabWords = articleData?.words?.map(
      (w: any) => w.vocabulary || w.word || w.text,
    ) || ["Apple", "Banana", "Cat"];
    const distractors = vocabWords.filter(
      (w: string) => w.toLowerCase() !== correctWord.toLowerCase(),
    );

    const optionsArray = [
      correctWord,
      distractors[0] || "Word A",
      distractors[1] || "Word B",
      distractors[2] || "Word C",
    ];

    const shuffledOptions = seededShuffle(
      optionsArray,
      (sessionData?.sessionId || "fallback") + "_phase11_" + targetSentence,
    );

    const newCorrectIdx = shuffledOptions.indexOf(correctWord);
    const correctLabel = String.fromCharCode(65 + newCorrectIdx);

    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    return renderKahootGame(question, mappedOptions, correctLabel);
  };

  const renderSentenceOrderingKahoot = () => {
    const sentences = articleData?.sentences || [];
    if (sentences.length < 1)
      return (
        <div className="flex-1 flex items-center justify-center text-xl">
          {t("lesson.interactive.notEnoughSentences")}
        </div>
      );

    const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
    const targetSentence =
      typeof sentences[idx] === "object"
        ? sentences[idx].sentences
        : sentences[idx];
    const words = String(targetSentence)
      .split(" ")
      .filter((w: any) => String(w).trim().length > 0);
    // Shuffle the sentence words deterministically based on session
    const shuffleWords = (array: string[]) => {
      const res = seededShuffle(
        array,
        (sessionData?.sessionId || "fallback") +
          "_phase12_words_" +
          targetSentence,
      );
      if (res.join(" ") === array.join(" ")) res.reverse(); // Ensure it is actually different from the original
      return res;
    };
    const scrambled = shuffleWords(words).join(" / ");
    const question = `${t("lesson.interactive.orderSentencePrefix")} ${scrambled}`;

    const optA = [...words];
    optA.push(optA.shift()!);
    const optB = [...words];
    optB.unshift(optB.pop()!);
    const optC = [...words].reverse();

    const optionsArray = [
      targetSentence,
      optA.join(" "),
      optB.join(" "),
      optC.join(" "),
    ];

    const shuffledOptions = seededShuffle(
      optionsArray,
      (sessionData?.sessionId || "fallback") + "_phase12b_" + targetSentence,
    );

    const newCorrectIdx = shuffledOptions.indexOf(targetSentence);
    const correctLabel = String.fromCharCode(65 + newCorrectIdx);

    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    const finalQuestion =
      scrambled === targetSentence
        ? `${t("lesson.interactive.orderSentencePrefix")} ${[...words].reverse().join(" / ")}`
        : question;
    return renderKahootGame(finalQuestion, mappedOptions, correctLabel);
  };

  const renderShortAnswer = () => {
    const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
    const shortAnswerQuestion =
      articleData?.shortAnswerQuestions?.[idx] ||
      articleData?.shortAnswerQuestions?.[0];

    // ── Results view (after all students answered) ──────────────────────────
    if (allAnsweredData.length > 0) {
      const excellentCount = allAnsweredData.filter(
        (a) => (a.answer?.aiScore || 0) >= 4,
      ).length;
      const goodCount = allAnsweredData.filter(
        (a) => (a.answer?.aiScore || 0) >= 2 && (a.answer?.aiScore || 0) < 4,
      ).length;
      const improveCount = allAnsweredData.filter(
        (a) => (a.answer?.aiScore || 0) < 2,
      ).length;
      const sumScores = allAnsweredData.reduce(
        (acc, a) => acc + (a.answer?.aiScore || 0),
        0,
      );
      const averageScore =
        allAnsweredData.length > 0 ? sumScores / allAnsweredData.length : 0;
      const avgPct = (averageScore / 5) * 100;

      const chartData = [
        {
          name: t("lesson.interactive.excellentRange"),
          count: excellentCount,
          fill: "#10b981",
        },
        {
          name: t("lesson.interactive.goodRange"),
          count: goodCount,
          fill: "#f59e0b",
        },
        {
          name: t("lesson.interactive.improveRange"),
          count: improveCount,
          fill: "#f43f5e",
        },
      ];

      const scoreColor =
        averageScore >= 4
          ? "text-emerald-400"
          : averageScore >= 2
            ? "text-amber-400"
            : "text-rose-400";
      const scoreRingColor =
        averageScore >= 4
          ? "#10b981"
          : averageScore >= 2
            ? "#f59e0b"
            : "#f43f5e";
      const circumference = 2 * Math.PI * 40;

      return (
        <div className="flex-1 flex flex-col items-center w-full px-4 py-2">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-violet-500/15 border border-violet-500/30 rounded-full px-4 py-1.5">
              <span className="size-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-violet-300 text-sm font-semibold uppercase tracking-widest">
                AI Analysis
              </span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("lesson.interactive.shortAnswerResults")}
            </h2>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 w-full max-w-5xl items-start">
            {/* Left: Chart */}
            <div className="bg-card/60 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {t("lesson.interactive.scoreDistributionChart")}
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 13,
                      }}
                      cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={64}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Mini breakdown bars */}
              <div className="mt-4 space-y-2">
                {[
                  {
                    label: t("lesson.interactive.excellentRange"),
                    count: excellentCount,
                    color: "bg-emerald-500",
                    total: allAnsweredData.length,
                  },
                  {
                    label: t("lesson.interactive.goodRange"),
                    count: goodCount,
                    color: "bg-amber-400",
                    total: allAnsweredData.length,
                  },
                  {
                    label: t("lesson.interactive.improveRange"),
                    count: improveCount,
                    color: "bg-rose-500",
                    total: allAnsweredData.length,
                  },
                ].map(({ label, count, color, total }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-muted-foreground truncate">
                      {label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{
                          width: total > 0 ? `${(count / total) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <span className="w-4 text-right font-bold text-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Average Score Ring */}
            <div className="flex flex-col items-center justify-center gap-3 px-2">
              <div className="relative">
                <svg
                  width="100"
                  height="100"
                  viewBox="0 0 100 100"
                  className="-rotate-90"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={scoreRingColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - avgPct / 100)}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-black ${scoreColor}`}>
                    {averageScore.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    / 5
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  {t("lesson.interactive.averageScore")}
                </p>
              </div>
            </div>

            {/* Right: KPI cards */}
            <div className="flex flex-col gap-3">
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 flex items-center gap-4">
                <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 text-xl">
                  📨
                </div>
                <div>
                  <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                    {t("lesson.interactive.allSubmitted")}
                  </p>
                  <p className="text-2xl font-black text-blue-300">
                    {allAnsweredData.length}{" "}
                    <span className="text-sm font-normal text-blue-400">
                      {t("lesson.interactive.peopleUnit")}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center gap-4">
                <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">
                  ⭐
                </div>
                <div>
                  <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                    {t("lesson.interactive.excellentRange")}
                  </p>
                  <p className="text-2xl font-black text-emerald-300">
                    {excellentCount}{" "}
                    <span className="text-sm font-normal text-emerald-400">
                      {t("lesson.interactive.peopleUnit")}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-center gap-4">
                <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 text-xl">
                  📝
                </div>
                <div>
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                    {t("lesson.interactive.goodRange")}
                  </p>
                  <p className="text-2xl font-black text-amber-300">
                    {goodCount}{" "}
                    <span className="text-sm font-normal text-amber-400">
                      {t("lesson.interactive.peopleUnit")}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 flex items-center gap-4">
                <div className="size-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 text-xl">
                  💪
                </div>
                <div>
                  <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider">
                    {t("lesson.interactive.improveRange")}
                  </p>
                  <p className="text-2xl font-black text-rose-300">
                    {improveCount}{" "}
                    <span className="text-sm font-normal text-rose-400">
                      {t("lesson.interactive.peopleUnit")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy note */}
          <div className="mt-5 flex items-center gap-2.5 bg-muted/40 border border-border/50 rounded-xl px-5 py-3 max-w-3xl">
            <span className="text-lg">🔒</span>
            <p className="text-muted-foreground text-xs font-medium">
              {t("lesson.interactive.privacyNote")}
            </p>
          </div>
        </div>
      );
    }

    // ── Waiting view (waiting for student answers) ──────────────────────────
    const submittedPct =
      totalParticipants > 0 ? (totalAnswered / totalParticipants) * 100 : 0;

    return (
      <div className="flex-1 flex flex-col lg:flex-row gap-5 overflow-hidden min-h-0">
        {/* Left: Question + Progress */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 min-w-0 overflow-hidden">
          {/* Question card with glow */}
          <div className="relative w-full max-w-2xl text-center">
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-violet-500/10 blur-2xl pointer-events-none" />
            <div className="relative bg-card/60 backdrop-blur border border-border/60 rounded-3xl px-8 py-7 shadow-lg">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="size-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
                  Short Answer
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground leading-snug">
                {shortAnswerQuestion?.question ||
                  t("lesson.interactive.shortAnswerPrompt")}
              </h2>
            </div>
          </div>

          {/* Progress ring + bar */}
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <div className="relative">
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                className="-rotate-90"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="7"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - submittedPct / 100)}`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-foreground">
                  {totalAnswered}
                </span>
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {totalAnswered} / {totalParticipants}{" "}
              <span className="font-normal text-muted-foreground">
                {t("lesson.interactive.answersSubmitted")}
              </span>
            </p>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-700"
                style={{ width: `${submittedPct}%` }}
              />
            </div>

            {/* Submitted avatars */}
            {totalAnswered > 0 && (
              <div className="flex items-center justify-center gap-1 flex-wrap mt-1">
                {allAnsweredData.slice(0, 9).map((a, i) => (
                  <div
                    key={i}
                    className="size-8 rounded-full overflow-hidden border-2 border-emerald-500/60 bg-emerald-500/20 flex items-center justify-center"
                  >
                    {a.pictureUrl ? (
                      <img
                        src={a.pictureUrl}
                        alt={a.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400">
                        {(a.name || "?").slice(0, 2)}
                      </span>
                    )}
                  </div>
                ))}
                {allAnsweredData.length > 9 && (
                  <div className="size-8 rounded-full bg-muted border-2 border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    +{allAnsweredData.length - 9}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Leaderboard */}
        <LiveLeaderboard participants={participants} />
      </div>
    );
  };

  const renderLeaderboard = () => {
    const sortedParticipants = [...(mockLeaderboard ?? participants)].sort(
      (a, b) => (b.score || 0) - (a.score || 0),
    );
    const articleImgId = (articleData as any)?.id as string | undefined;
    const articleImageUrl = articleImgId
      ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleImgId}`
      : null;

    return (
      <div className="flex-1 flex flex-col items-center max-w-4xl mx-auto w-full relative overflow-y-auto pb-4">
        {/* Subtle article image watermark */}
        {articleImageUrl && (
          <div
            className="absolute inset-0 rounded-2xl bg-center bg-cover opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: `url(${articleImageUrl})` }}
          />
        )}

        {/* 🎉 Banner */}
        <div className="relative z-10 text-center mb-6 animate-in fade-in zoom-in">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400/20 to-amber-500/10 border border-amber-400/30 rounded-full px-5 py-2 mb-3">
            <span className="text-xl">🎉</span>
            <span className="text-amber-600 dark:text-amber-400 font-black text-sm uppercase tracking-wider">
              {t("lesson.interactive.leaderboardTitle")}
            </span>
          </div>
          <p className="text-muted-foreground font-medium text-sm">
            {t("lesson.interactive.leaderboardSubtitle")}
          </p>
        </div>

        {/* Podium — 2nd | 1st | 3rd */}
        <div className="relative z-10 grid grid-cols-3 gap-5 w-full items-end mb-8 min-h-[240px]">
          {/* 2nd Place */}
          {sortedParticipants[1] ? (
            <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom duration-500">
              <div className="text-3xl">🥈</div>
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-slate-300 shadow-lg">
                <img
                  src={
                    sortedParticipants[1].pictureUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${sortedParticipants[1].name}`
                  }
                  alt={sortedParticipants[1].name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="font-black text-foreground text-sm truncate max-w-full px-1 text-center">
                {sortedParticipants[1].name}
              </p>
              <p className="font-black text-slate-400 text-xl">
                {sortedParticipants[1].score || 0}
              </p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t-xl h-24 flex items-center justify-center">
                <span className="text-slate-500 dark:text-slate-300 font-black text-4xl">
                  2
                </span>
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* 1st Place */}
          {sortedParticipants[0] ? (
            <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom duration-700">
              <div className="text-4xl animate-bounce">🥇</div>
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-amber-400 shadow-xl shadow-amber-400/30">
                <img
                  src={
                    sortedParticipants[0].pictureUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${sortedParticipants[0].name}`
                  }
                  alt={sortedParticipants[0].name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="font-black text-amber-600 dark:text-amber-400 text-base truncate max-w-full px-1 text-center">
                {sortedParticipants[0].name}
              </p>
              <p className="font-black text-amber-500 text-3xl">
                {sortedParticipants[0].score || 0}
              </p>
              <div className="w-full bg-gradient-to-b from-amber-400 to-amber-500 rounded-t-xl h-36 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <span className="text-white font-black text-5xl">1</span>
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* 3rd Place */}
          {sortedParticipants[2] ? (
            <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom duration-300">
              <div className="text-3xl">🥉</div>
              <div className="w-14 h-14 rounded-full overflow-hidden border-4 border-orange-400 shadow-md">
                <img
                  src={
                    sortedParticipants[2].pictureUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${sortedParticipants[2].name}`
                  }
                  alt={sortedParticipants[2].name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="font-black text-foreground text-sm truncate max-w-full px-1 text-center">
                {sortedParticipants[2].name}
              </p>
              <p className="font-black text-orange-400 text-lg">
                {sortedParticipants[2].score || 0}
              </p>
              <div className="w-full bg-orange-300 dark:bg-orange-700 rounded-t-xl h-16 flex items-center justify-center">
                <span className="text-white font-black text-3xl">3</span>
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>

        {/* All participants (4th onward) — full list in a 3-column grid */}
        {sortedParticipants.length > 3 && (
          <div className="relative z-10 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sortedParticipants.slice(3).map((p, i) => (
              <div
                key={p.studentId || i}
                className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm"
              >
                <span className="font-bold text-muted-foreground w-8 text-center text-sm shrink-0">
                  #{i + 4}
                </span>
                <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0">
                  <img
                    src={
                      p.pictureUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`
                    }
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-semibold text-foreground text-sm truncate flex-1 min-w-0">
                  {p.name}
                </span>
                <span className="font-black text-foreground text-sm tabular-nums shrink-0">
                  {p.score || 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Shared progress strip for the Period-4 facilitation phases
  const renderTutorProgress = (accent: string) => {
    const total = participants.length;
    const pct = total > 0 ? (totalAnswered / total) * 100 : 0;
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-2">
        <p className="text-sm font-semibold text-foreground">
          {totalAnswered} / {total} {t("lesson.interactive.answersSubmitted")}
        </p>
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${accent} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  // ── Step 11: Guided Writing (AI-scored) ──
  const renderWriting = () => {
    const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
    const prompt =
      articleData?.shortAnswerQuestions?.[idx]?.question ||
      t("lesson.interactive.writingPromptLabel");

    if (allAnsweredData.length > 0) {
      const sum = allAnsweredData.reduce(
        (acc, a) => acc + (a.answer?.aiScore || 0),
        0,
      );
      const avg = allAnsweredData.length > 0 ? sum / allAnsweredData.length : 0;
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4">
          <span className="bg-sky-500/10 text-sky-700 dark:text-sky-400 text-xs font-bold px-3 py-1 rounded-full border border-sky-500/20">
            {t("lesson.interactive.writingResults")}
          </span>
          <div className="bg-card border border-border rounded-3xl shadow-xl p-10 text-center">
            <p className="text-6xl font-black text-sky-600 dark:text-sky-400">
              {avg.toFixed(1)}
              <span className="text-2xl text-muted-foreground"> / 5</span>
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              {t("lesson.interactive.averageScore")} · {allAnsweredData.length}{" "}
              {t("lesson.interactive.peopleUnit")}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center gap-5 min-w-0">
          <div className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-xl border border-sky-500/20">
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-5">
              <span className="text-white/80 text-xs font-bold uppercase tracking-widest">
                {t("lesson.interactive.writingTitle")}
              </span>
              <h2 className="text-2xl font-black text-white leading-snug mt-2">
                {prompt}
              </h2>
            </div>
          </div>
          <p className="text-muted-foreground text-sm text-center max-w-xl">
            {t("lesson.interactive.writingPlannerModel")}
          </p>
          {renderTutorProgress("bg-sky-500")}
        </div>
        <LiveLeaderboard participants={participants} />
      </div>
    );
  };

  // ── Step 12: Language Questions (teacher-mediated AI) ──
  const renderLanguageQuestions = () => {
    const questions = allAnsweredData
      .map((a) => (typeof a.answer === "object" ? a.answer?.text : a.answer))
      .filter(Boolean);
    return (
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center gap-5 min-w-0">
          <div className="text-center">
            <span className="bg-violet-500/10 text-violet-700 dark:text-violet-400 text-xs font-bold px-3 py-1 rounded-full border border-violet-500/20">
              {t("lesson.interactive.languageTitle")}
            </span>
            <p className="text-muted-foreground text-sm mt-3 max-w-xl">
              {t("lesson.interactive.languagePrompt")}
            </p>
          </div>
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {t("lesson.interactive.languageQuestionsHeading")}
            </p>
            {questions.length > 0 ? (
              <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
                {questions.map((q, i) => (
                  <li
                    key={i}
                    className="text-foreground text-sm bg-muted/50 rounded-xl px-4 py-2.5"
                  >
                    ❓ {q}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                {t("lesson.interactive.languageNoQuestions")}
              </p>
            )}
          </div>
          {renderTutorProgress("bg-violet-500")}
        </div>
        <LiveLeaderboard participants={participants} />
      </div>
    );
  };

  // ── Step 13: Lesson Reflection ──
  const renderReflection = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
      <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/20">
        {t("lesson.interactive.reflectionTitle")}
      </span>
      <div className="bg-card border-t-4 border-amber-500 rounded-3xl shadow-xl p-12 max-w-2xl w-full text-center">
        <div className="text-5xl mb-4">📝</div>
        <p className="text-xl font-bold text-foreground leading-snug">
          {t("lesson.interactive.reflectionPrompt")}
        </p>
        {allAnsweredData.length > 0 && (
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-4">
            {allAnsweredData.length}{" "}
            {t("lesson.interactive.reflectionSubmitted")}
          </p>
        )}
      </div>
      {renderTutorProgress("bg-amber-500")}
    </div>
  );

  // ── Step 14: Pair Conversation (random pairs talk about the lesson) ──
  const renderPairConversation = () => {
    const pairs: {
      pairNumber: number;
      members: { studentId: string; name: string; pictureUrl?: string }[];
    }[] = mockPairs ?? sessionData?.pairs ?? [];
    // Mock pairs preview the layout without real students in the room
    const showEmptyState = pairs.length === 0 || (!mockPairs && participants.length < 2);
    const hasTriple = pairs.some((pair) => pair.members.length > 2);
    const starters = [
      "What was this story about?",
      "Which new word do you like? Why?",
      "What is the most interesting part?",
      "What did you learn today?",
    ];

    return (
      <div className="flex-1 flex flex-col items-center gap-6 overflow-y-auto pb-4">
        <div className="text-center max-w-2xl">
          <div className="text-5xl mb-4">🗣️</div>
          <p className="text-xl font-bold text-foreground leading-snug">
            {t("lesson.interactive.pairTitle")}
          </p>
          <p className="text-muted-foreground mt-2">
            {t("lesson.interactive.pairSubtitle")}
          </p>
          {hasTriple && (
            <p className="text-amber-600 dark:text-amber-400 text-sm font-semibold mt-2">
              {t("lesson.interactive.pairTripleNote")}
            </p>
          )}
        </div>

        {showEmptyState ? (
          <div className="bg-muted border border-border rounded-2xl px-8 py-6 text-center">
            <span className="text-3xl block mb-2">👥</span>
            <p className="text-muted-foreground font-medium">
              {t("lesson.interactive.pairNeedTwo")}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pairs.map((pair) => (
              <div
                key={pair.pairNumber}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center gap-3"
              >
                <span className="text-xs font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-full px-3 py-1">
                  {t("lesson.interactive.pairGroupLabel")} {pair.pairNumber}
                </span>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {pair.members.map((member, i) => (
                    <React.Fragment key={member.studentId}>
                      {i > 0 && <span className="text-xl">🤝</span>}
                      <div className="flex flex-col items-center gap-1.5 min-w-0">
                        <div className="size-12 rounded-full overflow-hidden border-2 border-rose-300/60 shadow-sm bg-muted">
                          <img
                            src={
                              member.pictureUrl ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`
                            }
                            alt={member.name}
                            className="size-full object-cover"
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground truncate max-w-[88px]">
                          {member.name}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5">
            <h4 className="text-xs font-black uppercase tracking-widest text-rose-500 mb-3">
              {t("lesson.interactive.pairStartersTitle")}
            </h4>
            <ul className="space-y-2">
              {starters.map((starter) => (
                <li
                  key={starter}
                  className="text-foreground text-sm font-medium bg-card border border-border rounded-xl px-3 py-2"
                >
                  💬 {starter}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-muted/60 border border-border rounded-2xl p-5">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
              Tutor Actions
            </h4>
            <ul className="text-muted-foreground text-sm space-y-2">
              <li>{t("lesson.interactive.pairTutorTip1")}</li>
              <li>{t("lesson.interactive.pairTutorTip2")}</li>
              <li>{t("lesson.interactive.pairTutorTip3")}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderPhaseContent = () => {
    if (currentPhase === 0 && participants.length === 0) return renderLobby();
    if (currentPhase === 7) return renderMCQ(); // Comprehension Check
    if (currentPhase === 8) return renderShortAnswer(); // Guided Response
    if (currentPhase === 9) return renderVocabKahoot(); // Vocabulary Practice
    if (currentPhase === 10) return renderSentenceFlashcardKahoot(); // Sentence Practice (fill)
    if (currentPhase === 11) return renderSentenceOrderingKahoot(); // Sentence Practice (order)
    if (currentPhase === 12) return renderWriting(); // Guided Writing
    if (currentPhase === 13) return renderLanguageQuestions(); // Language Questions
    if (currentPhase === 14) return renderReflection(); // Lesson Reflection
    if (currentPhase === 15) return renderPairConversation(); // Pair Conversation
    if (currentPhase === 16) return renderLeaderboard(); // Wrap-up

    // Presentation phases 1-6 (Launch, Vocab, Read+audio, Collect Vocab, Deep Reading, Collect Sentences)
    return renderPresentation();
  };

  const phaseGroups = [
    {
      label: t("lesson.interactive.period1"),
      phases: [1, 2, 3, 4],
      color: "bg-indigo-500",
      lightColor: "bg-indigo-100",
      textColor: "text-indigo-700",
    },
    {
      label: t("lesson.interactive.period2"),
      phases: [5, 6, 7],
      color: "bg-blue-500",
      lightColor: "bg-blue-100",
      textColor: "text-blue-700",
    },
    {
      label: t("lesson.interactive.period3"),
      phases: [8, 9, 10, 11],
      color: "bg-purple-500",
      lightColor: "bg-purple-100",
      textColor: "text-purple-700",
    },
    {
      label: t("lesson.interactive.period4"),
      phases: [12, 13, 14, 15],
      color: "bg-amber-500",
      lightColor: "bg-amber-100",
      textColor: "text-amber-700",
    },
    {
      label: t("lesson.interactive.wrapUp"),
      phases: [16],
      color: "bg-emerald-500",
      lightColor: "bg-emerald-100",
      textColor: "text-emerald-700",
    },
  ];

  // phase 10 & 11 are both Step 10 (Sentence Practice); steps 11/12/13/14 live at phases 12/13/14/15
  const phaseNames: Record<number, string> = {
    0: "Lobby",
    1: t("lesson.interactive.step1"),
    2: t("lesson.interactive.step2"),
    3: t("lesson.interactive.step3"),
    4: t("lesson.interactive.step4"),
    5: t("lesson.interactive.step5"),
    6: t("lesson.interactive.step6"),
    7: t("lesson.interactive.step7"),
    8: t("lesson.interactive.step8"),
    9: t("lesson.interactive.step9"),
    10: t("lesson.interactive.step10"),
    11: t("lesson.interactive.step10"),
    12: t("lesson.interactive.step11"),
    13: t("lesson.interactive.step12"),
    14: t("lesson.interactive.step13"),
    15: t("lesson.interactive.step14"),
    16: t("lesson.interactive.wrapUp"),
  };

  const renderPhaseProgressBar = () => {
    if (currentPhase === 0) return null;
    const currentGroup = phaseGroups.find((g) =>
      g.phases.includes(currentPhase),
    );

    return (
      <div className="mb-6 bg-muted border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${currentGroup?.lightColor || "bg-muted"} ${currentGroup?.textColor || "text-muted-foreground"}`}
            >
              {currentGroup?.label || `Phase ${currentPhase}`}
            </span>
            <span className="font-bold text-foreground text-sm">
              {phaseNames[currentPhase] || `Phase ${currentPhase}`}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {currentPhase} / 16
          </span>
        </div>

        {/* Phase dots */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((p) => {
            const group = phaseGroups.find((g) => g.phases.includes(p));
            const isPast = p < currentPhase;
            const isCurrent = p === currentPhase;
            return (
              <div key={p} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`h-2 w-full rounded-full transition-all duration-500 ${
                    isCurrent
                      ? `${group?.color || "bg-muted-foreground"} shadow-md scale-y-150 phase-active-glow`
                      : isPast
                        ? (group?.color || "bg-muted-foreground") +
                          " opacity-60"
                        : "bg-border"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Group labels */}
        <div className="flex mt-2 text-[10px] text-muted-foreground font-medium">
          {phaseGroups.map((g) => (
            <div
              key={g.label}
              style={{ flex: g.phases.length }}
              className="text-center"
            >
              {g.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={fullscreenRef}
      className={`flex flex-col relative bg-background ${
        isFullscreen
          ? "fixed inset-0 z-[100] h-dvh w-screen overflow-hidden p-3 md:p-5"
          : "flex-1"
      }`}
    >
      {/* Warning Overlay when everyone left */}
      {currentPhase > 0 && participants.length === 0 && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in">
          <div className="bg-card p-8 rounded-2xl shadow-2xl border border-destructive/20 flex flex-col items-center max-w-md text-center">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6 text-3xl">
              !
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">
              {t("lesson.interactive.studentsLeftTitle")}
            </h3>
            <p className="text-muted-foreground mb-8">
              {t("lesson.interactive.studentsLeftDescription")}
            </p>
            <button
              onClick={() => changePhase(0)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 w-full"
            >
              {t("lesson.interactive.returnLobbyNow")}
            </button>
          </div>
        </div>
      )}

      <div
        className={
          isFullscreen
            ? "shrink-0 [&>div]:mb-3 [&>div]:rounded-xl [&>div]:p-3"
            : "shrink-0"
        }
      >
        {renderPhaseProgressBar()}
      </div>
      <FitToViewport enabled={isFullscreen}>
        {renderPhaseContent()}
      </FitToViewport>

      <div
        className={`${isFullscreen ? "mt-3 pt-3" : "mt-auto pt-6"} shrink-0 border-t border-border flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground font-medium">
            {totalParticipants} {t("lesson.interactive.studentsInClass")}
          </div>

          <button
            onClick={toggleFullscreen}
            title={
              isFullscreen
                ? t("lesson.interactive.exitFullscreen")
                : t("lesson.interactive.enterFullscreen")
            }
            className="px-3 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen
              ? t("lesson.interactive.exitFullscreen")
              : t("lesson.interactive.enterFullscreen")}
          </button>

          {/* Always Available Return to Lobby */}
          <button
            onClick={() => changePhase(0)}
            className="px-3 py-1.5 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg hover:bg-destructive/20 transition-colors"
          >
            {t("lesson.interactive.returnLobby")}
          </button>

          {/* Dev Mode Controls */}
          {process.env.NODE_ENV === "development" && (
            <div className="flex items-center gap-2 border-l border-border pl-4 ml-2">
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
                DEV
              </span>
              <button
                onClick={() => changePhase(Math.max(1, currentPhase - 1))}
                className="px-3 py-1.5 bg-muted text-muted-foreground text-sm font-semibold rounded-lg hover:bg-accent transition-colors"
              >
                {t("lesson.interactive.previous")}
              </button>
              <button
                onClick={() => changePhase(Math.min(16, currentPhase + 1))}
                className="px-3 py-1.5 bg-muted text-muted-foreground text-sm font-semibold rounded-lg hover:bg-accent transition-colors"
              >
                {t("lesson.interactive.skipPhase")}
              </button>
              <button
                onClick={() => {
                  if (mockLeaderboard) {
                    setMockLeaderboard(null);
                    return;
                  }
                  const mock = Array.from({ length: 14 }, (_, i) => ({
                    studentId: `mock-${i}`,
                    name: `นักเรียน ${i + 1}`,
                    score: Math.floor(Math.random() * 60),
                  }));
                  setMockLeaderboard(mock);
                  changePhase(16);
                }}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${mockLeaderboard ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                {mockLeaderboard ? "Mock: ON" : "Mock LB"}
              </button>
              <button
                onClick={() => {
                  if (mockPairs) {
                    setMockPairs(null);
                    return;
                  }
                  // 7 mock students -> 2 pairs + 1 triple, so the odd-count
                  // note and the group-of-three card are visible too
                  const students = Array.from({ length: 7 }, (_, i) => ({
                    studentId: `mock-pair-${i}`,
                    name: `นักเรียน ${i + 1}`,
                  }));
                  const mock = [];
                  for (let i = 0; i + 1 < students.length; i += 2) {
                    mock.push({ pairNumber: mock.length + 1, members: [students[i], students[i + 1]] });
                  }
                  if (students.length % 2 === 1) {
                    mock[mock.length - 1].members.push(students[students.length - 1]);
                  }
                  setMockPairs(mock);
                  changePhase(15);
                }}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${mockPairs ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                {mockPairs ? "Pairs: ON" : "Mock Pairs"}
              </button>
            </div>
          )}

          {/* Standard Controls: Exit Session */}
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <button
              onClick={onFinishSession}
              className="px-3 py-1.5 bg-secondary/10 text-secondary-foreground text-xs font-bold rounded-lg hover:bg-secondary/20 transition-colors flex items-center gap-1"
            >
              <Check size={14} />
              {t("lesson.interactive.finishLesson")}
            </button>
          </div>
        </div>
        <button
          onClick={handleNextPhase}
          disabled={!canProceedDelayed || isChangingPhase}
          className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 ${
            !canProceedDelayed || isChangingPhase
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90 shadow-lg active:scale-95"
          }`}
        >
          {isChangingPhase ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
              {t("lesson.interactive.processing")}
            </>
          ) : !canProceedDelayed ? (
            t("lesson.interactive.waitingAnswers")
          ) : currentPhase === 16 ? (
            <>
              <span className="flex items-center gap-1">
                {t("lesson.interactive.startNewRound")}{" "}
                <kbd className="hidden md:inline-flex bg-primary-foreground/20 text-primary-foreground text-xs px-2 py-0.5 rounded ml-2 shadow-sm font-mono">
                  →
                </kbd>
              </span>
              <ChevronRight size={20} />
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                {t("lesson.interactive.nextPhase")}{" "}
                <kbd className="hidden md:inline-flex bg-primary-foreground/20 text-primary-foreground text-xs px-2 py-0.5 rounded ml-2 shadow-sm font-mono">
                  →
                </kbd>
              </span>
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
