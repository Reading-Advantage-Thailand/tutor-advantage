"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';
import { playSound } from '@/lib/sounds';
import { studentApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import Image from 'next/image';
import { MobileLeaderboard } from '@/components/lesson/MobileLeaderboard';
import { LessonReflectionPhase } from '@/components/lesson/phases/LessonReflectionPhase';
import { LessonPairPhase } from '@/components/lesson/phases/LessonPairPhase';
import { LessonWrapUpPhase } from '@/components/lesson/phases/LessonWrapUpPhase';
import { AdvantageArcadeRuntime } from '@/components/lesson/AdvantageArcadeRuntime';
import { toast } from 'sonner';
import { getGameById, getGamesByCategory } from '@/lib/liveLessonGames';
import { preloadGameAssets } from '@/lib/games/gameAssetPreloader';
import { Lock } from 'lucide-react';

const VOCAB_GAME_PHASE = 10;
const SENTENCE_GAME_PHASE = 14;
const FINAL_LEADERBOARD_PHASE = 18;

// ── Phase Config (Look at Screen) ────────────────────────────────────────────
const PHASE_CONFIG: Record<number, {
  emoji: string; label: string;
  color: string; bg: string; border: string;
  gradientFrom: string; gradientTo: string; tip: string
}> = {
  1: { emoji: '📖', label: 'แนะนำบทเรียน',   color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  gradientFrom: 'from-indigo-500',  gradientTo: 'to-violet-600',  tip: 'คุณครูกำลังแนะนำบทเรียนวันนี้' },
  2: { emoji: '📝', label: 'คำศัพท์ใหม่',    color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  gradientFrom: 'from-violet-500',  gradientTo: 'to-purple-600',  tip: 'ดูคำศัพท์สำคัญบนจอของครู' },
  3: { emoji: '👀', label: 'อ่านบทความ',      color: 'text-sky-600 dark:text-sky-400',       bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     gradientFrom: 'from-sky-500',     gradientTo: 'to-blue-600',    tip: 'อ่านบทความพร้อมคุณครู' },
  4: { emoji: '🔍', label: 'โฟกัสคำศัพท์',   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   gradientFrom: 'from-amber-400',   gradientTo: 'to-orange-500',  tip: 'สังเกตคำศัพท์ที่ไฮไลต์บนจอ' },
  5: { emoji: '🧠', label: 'อ่านเชิงลึก',     color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', gradientFrom: 'from-emerald-500', gradientTo: 'to-teal-600',    tip: 'ฟังคุณครูอธิบายความหมาย' },
  6: { emoji: '⭐', label: 'ประโยคสำคัญ',     color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    gradientFrom: 'from-rose-500',    gradientTo: 'to-pink-600',    tip: 'จดจำประโยคสำคัญเหล่านี้' },
};



// ── Main Component ────────────────────────────────────────────────────────────
function PlayLessonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const { profile, isReady: liffReady } = useLiff();

  const studentId = profile?.userId || "anonymous";
  const name = profile?.displayName || "Student";

  const {
    sessionData,
    articleData,
    participants,
    error,
    paymentRequired,
    hasAnswered,
    isEveryoneReady,
    aiFeedback,
    languageAnswer,
    missedQuestion,
    submitAnswer,
    kicked,
    flagCounts,
    flagSentence,
    submitGameVote,
    submitGameResult
  } = useLessonSocket(classId || undefined, studentId, name, profile?.pictureUrl);

  const [typedAnswer, setTypedAnswer] = useState('');
  const [myFlags, setMyFlags] = useState<Set<number>>(new Set());
  const [showEveryoneReady, setShowEveryoneReady] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [prevPhase, setPrevPhase] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoaded, setReviewLoaded] = useState(false);
  // Step 11 Guided Writing
  const [writingPlan, setWritingPlan] = useState('');
  const [writingDraft, setWritingDraft] = useState('');
  // Step 12 Language Questions
  const [languageQuestion, setLanguageQuestion] = useState('');
  const [languageSkipped, setLanguageSkipped] = useState(false);
  // Step 13 Reflection
  const [understanding, setUnderstanding] = useState('');
  const [effort, setEffort] = useState('');
  // Dev-only: preview the Step 14 pair view without a real session.
  // 0 = off, 1 = pair (1 partner), 2 = group of three (2 partners)
  const [devPairPreview, setDevPairPreview] = useState<0 | 1 | 2>(0);
  const currentPhase = devPairPreview ? 17 : (sessionData?.currentPhase ?? 0);
  const gameState = sessionData?.gameState ?? null;
  const gameActorId = sessionData?.currentStudentId || studentId;
  const gameVoteForPreload = gameState?.votes?.[gameActorId] || gameState?.votes?.[studentId];
  const gameIdForPreload = gameState?.selectedGameId || gameVoteForPreload;
  const gameStatusForPreload = gameState?.status || "";
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [gameSelections, setGameSelections] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isEveryoneReady) {
      const timer = setTimeout(() => setShowEveryoneReady(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowEveryoneReady(false);
    }
  }, [isEveryoneReady]);

  useEffect(() => {
    if (sessionData && prevPhase !== null && sessionData.currentPhase !== prevPhase) {
      playSound('phaseChange');
    }
    if (sessionData && prevPhase !== null && sessionData.currentPhase !== prevPhase) {
      // Clear per-step inputs when moving between Period-4 steps
      setWritingPlan('');
      setWritingDraft('');
      setLanguageQuestion('');
      setLanguageSkipped(false);
      setUnderstanding('');
      setEffort('');
    }
    if (sessionData) setPrevPhase(sessionData.currentPhase);
    setIsSubmitting(false);
  }, [sessionData, prevPhase]);

  useEffect(() => { if (hasAnswered) setIsSubmitting(false); }, [hasAnswered]);

  // Reset my sentence flags at the start of a fresh instructional cycle
  useEffect(() => { if (currentPhase === 1) setMyFlags(new Set()); }, [currentPhase]);

  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (gameState?.status !== "countdown") return;
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 250);
    return () => window.clearInterval(timer);
  }, [gameState?.status, gameState?.countdownEndsAt]);

  useEffect(() => {
    if (!gameIdForPreload) return;
    if (!["voting", "countdown", "playing", "results"].includes(gameStatusForPreload)) return;
    void preloadGameAssets(gameIdForPreload);
  }, [gameIdForPreload, gameStatusForPreload]);

  useEffect(() => {
    if (gameState?.status === "playing" && !gameStartedAt) {
      setGameStartedAt(Date.now());
    }
    if (!gameState || gameState.phase !== currentPhase) {
      setGameStartedAt(null);
      setGameSelections({});
    }
  }, [gameState, currentPhase, gameStartedAt]);

  useEffect(() => {
    if (sessionData && sessionData.currentPhase === 0 && classId) {
      router.push(`/lesson/${classId}`);
    }
  }, [sessionData, classId, router]);

  useEffect(() => {
    if (!classId || currentPhase !== 16 || reviewLoaded) return;

    studentApi.getClassReview(classId)
      .then((data) => {
        if (data.review) {
          setReviewRating(data.review.rating || 0);
          setReviewComment(data.review.comment || '');
        }
      })
      .catch(() => {
        // No existing review is a normal state after a lesson.
      })
      .finally(() => setReviewLoaded(true));
  }, [classId, currentPhase, reviewLoaded]);

  const submitTutorReview = async () => {
    if (!classId || reviewRating === 0) {
      toast.error('กรุณาเลือกจำนวนดาวก่อนส่งรีวิว');
      return;
    }

    try {
      await studentApi.submitClassReview(classId, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      toast.success('บันทึกรีวิวเรียบร้อยแล้ว');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกรีวิวไม่สำเร็จ');
    } finally {
    }
  };

  useEffect(() => {
    if (!hasAnswered && !isSubmitting) setSelectedChoice(null);
  }, [hasAnswered, isSubmitting]);

  const paymentAmountText =
    paymentRequired?.packagePriceSatang != null
      ? new Intl.NumberFormat("th-TH", {
          style: "currency",
          currency: "THB",
          maximumFractionDigits: 0,
        }).format(paymentRequired.packagePriceSatang / 100)
      : null;
  const paymentUrl =
    paymentRequired?.paymentUrl ||
    (classId ? `/payment?classId=${classId}${paymentRequired?.cycleId ? `&cycleId=${paymentRequired.cycleId}` : ""}` : "/payment");

  // ─── Loading / Error States ────────────────────────────────────────────────

  if (!liffReady) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-3xl border border-border shadow-xl p-8 text-center max-w-[280px] w-full">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">📚</span>
          </div>
          <div className="flex gap-1.5 justify-center mt-2">
            {[0, 1, 2].map(i => <div key={i} className="size-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
          <p className="font-black text-foreground text-sm mt-3">{t("interactivePlay.openingLesson")}</p>
        </div>
      </div>
    );
  }

  if (kicked) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">😢</div>
        <h2 className="text-xl font-black text-foreground mb-2">{kicked}</h2>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">{t("interactivePlay.lessonEnded")}</p>
        <button onClick={() => router.push('/dashboard')} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black py-4 px-10 rounded-2xl shadow-lg active:scale-95 transition-all">
          {t("interactivePlay.backHome")}
        </button>
      </div>
    );
  }

  if (paymentRequired) {
    const bookLabel = [paymentRequired.bookCode, paymentRequired.bookTitle].filter(Boolean).join(": ") || "เล่มนี้";

    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-5">
        <div className="fixed inset-0 bg-black/45" aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          className="relative z-10 w-full max-w-sm rounded-3xl border border-amber-400/40 bg-card p-6 text-center shadow-2xl"
        >
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-3xl">
            ฿
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Payment required
          </p>
          <h2 className="mt-2 text-xl font-black text-foreground">
            ต้องชำระเงินก่อนเข้าเล่มนี้
          </h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-muted-foreground">
            คุณครูเปิดสอน {bookLabel} แล้ว แต่บัญชีของคุณยังไม่มีสิทธิ์เข้าเล่มนี้
          </p>
          {paymentAmountText && (
            <div className="mt-4 rounded-2xl border border-border bg-muted/50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ยอดชำระ</p>
              <p className="mt-1 text-2xl font-black text-foreground">{paymentAmountText}</p>
            </div>
          )}
          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={() => router.push(paymentUrl)}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-4 text-sm font-black text-white shadow-lg active:scale-95 transition-all"
            >
              ไปชำระเงิน
            </button>
            <button
              type="button"
              onClick={() => router.push(classId ? `/classes/${classId}` : "/dashboard")}
              className="w-full rounded-2xl border border-border bg-background py-3.5 text-sm font-black text-foreground active:scale-95 transition-all"
            >
              กลับไปดูเล่มที่เรียนได้
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-3xl border border-rose-500/20 shadow-xl p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-black text-rose-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Dev-only toggle: off -> pair -> group of three -> off
  const devPairButton = process.env.NODE_ENV === 'development' && (
    <button
      onClick={() => setDevPairPreview((v) => ((v + 1) % 3) as 0 | 1 | 2)}
      className={`fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg border transition-colors ${
        devPairPreview
          ? 'bg-orange-500 text-white border-orange-600'
          : 'bg-card text-muted-foreground border-border'
      }`}
    >
      {devPairPreview === 0 ? 'DEV: Mock Pair' : devPairPreview === 1 ? 'DEV Pair: คู่' : 'DEV Pair: กลุ่ม 3'}
    </button>
  );

  if (!sessionData && !devPairPreview) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-3xl border border-border shadow-xl p-8 text-center max-w-[280px] w-full">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">📚</span>
          </div>
          <p className="font-black text-foreground text-sm">{t("interactivePlay.connectingLesson")}</p>
          <div className="flex gap-1.5 justify-center mt-3">
            {[0, 1, 2].map(i => <div key={i} className="size-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
        </div>
        {devPairButton}
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleMcqClick = (answer: string) => {
    playSound('select');
    setIsSubmitting(true);
    setSelectedChoice(answer);
    const currentPhase = sessionData?.currentPhase;
    let questionText = t("interactivePlay.defaultQuestion");
    let expected = "";
    if (currentPhase === 7) {
      const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
      const q = articleData?.multipleChoiceQuestions?.[idx];
      questionText = q?.question || questionText;
      expected = q?.answer || expected;
    } else if (currentPhase === 9) {
      const idx = sessionData?.phaseSelectedIndices?.[9] || 0;
      const w = articleData?.words?.[idx];
      questionText = `${t("interactivePlay.vocabMeaningPrefix")} "${w?.vocabulary || w?.word || w?.text}" ${t("interactivePlay.vocabMeaningSuffix")}`;
      expected = w?.definition?.th || w?.translation || "";
    } else if (currentPhase === 11) {
      const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
      const s = articleData?.sentences?.[idx];
      const targetStr = typeof s === 'object' ? s.sentences : s;
      const words = String(targetStr).split(' ');
      questionText = words.slice(0, words.length - 1).join(' ') + ' _____';
      expected = words[words.length - 1].replace(/[.,!?]/g, '');
    } else if (currentPhase === 12) {
      const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
      const s = articleData?.sentences?.[idx];
      const targetStr = typeof s === 'object' ? s.sentences : s;
      questionText = `${t("interactivePlay.orderSentencePrefix")} ${idx + 1}`;
      expected = String(targetStr);
    }
    submitAnswer(answer, questionText, expected);
  };

  const handleTextSubmit = () => {
    if (typedAnswer.trim()) {
      playSound('submit');
      setIsSubmitting(true);
      setSelectedChoice(typedAnswer);
      const currentPhase = sessionData?.currentPhase ?? 0;
      const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
      const saqQuestion = articleData?.shortAnswerQuestions?.[idx];
      submitAnswer(typedAnswer, saqQuestion?.question, saqQuestion?.answer);
      setTypedAnswer('');
    }
  };

  const handleFlagToggle = (sentenceIndex: number) => {
    playSound('select');
    setMyFlags(prev => {
      const next = new Set(prev);
      if (next.has(sentenceIndex)) next.delete(sentenceIndex);
      else next.add(sentenceIndex);
      return next;
    });
    flagSentence(sentenceIndex);
  };

  // Step 11 Guided Writing — submit draft for AI feedback
  const handleWritingSubmit = () => {
    if (!writingDraft.trim() || hasAnswered || isSubmitting) return;
    playSound('submit');
    setIsSubmitting(true);
    setSelectedChoice(writingDraft);
    const idx = sessionData?.phaseSelectedIndices?.[13] || 0;
    const prompt = articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.writingTitle");
    submitAnswer(writingDraft, prompt, '');
  };

  // Step 12 Language Questions — submit question for teacher-mediated AI answer
  const handleLanguageSubmit = () => {
    if (!languageQuestion.trim() || hasAnswered || isSubmitting) return;
    playSound('submit');
    setIsSubmitting(true);
    submitAnswer(languageQuestion, 'Language question', '');
  };

  // Step 12 — skip when the student has no question (counts as answered, no AI)
  const handleLanguageSkip = () => {
    if (hasAnswered || isSubmitting) return;
    playSound('select');
    setLanguageSkipped(true);
    setIsSubmitting(true);
    submitAnswer('', 'Language question', '');
  };

  // Step 13 Reflection — submit understanding + effort ratings (and tutor star review if given)
  const handleReflectionSubmit = async () => {
    if (!understanding || !effort || hasAnswered || isSubmitting) return;
    playSound('submit');
    setIsSubmitting(true);
    if (reviewRating > 0) {
      await submitTutorReview();
    }
    submitAnswer(`ความเข้าใจ: ${understanding} · ความพยายาม: ${effort}`, 'Lesson reflection', '');
  };

  // Step 3 (Read the Article) has its own tap-to-flag UI, so it is not a passive look-at-screen phase
  const isLookAtScreenPhase = [1, 2, 4, 5, 6].includes(currentPhase);
  const articleId = articleData?.id;
  const articleTitle = articleData?.title;
  const articleImageUrl = articleId
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleId}`
    : null;

  // MCQ option configs (EduPop colors)
  const mcqOptions = [
    { label: 'A', bg: 'bg-rose-500',    shadow: 'shadow-[0_6px_0_rgb(190,18,60)]',  activeShadow: 'active:shadow-[0_0px_0_rgb(190,18,60)]' },
    { label: 'B', bg: 'bg-sky-500',     shadow: 'shadow-[0_6px_0_rgb(3,105,161)]',  activeShadow: 'active:shadow-[0_0px_0_rgb(3,105,161)]' },
    { label: 'C', bg: 'bg-amber-400',   shadow: 'shadow-[0_6px_0_rgb(161,98,7)]',   activeShadow: 'active:shadow-[0_0px_0_rgb(161,98,7)]' },
    { label: 'D', bg: 'bg-emerald-500', shadow: 'shadow-[0_6px_0_rgb(4,120,87)]',   activeShadow: 'active:shadow-[0_0px_0_rgb(4,120,87)]' },
  ];

  const getScoreColor = (s: number) => s >= 4 ? 'text-emerald-500' : s >= 2 ? 'text-amber-500' : 'text-rose-500';
  const getScoreStroke = (s: number) => s >= 4 ? '#10b981' : s >= 2 ? '#f59e0b' : '#f43f5e';
  const getScoreStars = (s: number) => '⭐'.repeat(Math.max(0, Math.round(s)));

  // Shared "waiting for AI" skeleton — matches the Short Answer loading state across steps
  const renderAiSkeleton = (accent: 'sky' | 'violet') => {
    const ping = accent === 'sky' ? 'bg-sky-400' : 'bg-violet-400';
    const dot = accent === 'sky' ? 'bg-sky-500' : 'bg-violet-500';
    const label = accent === 'sky' ? 'text-sky-600 dark:text-sky-400' : 'text-violet-600 dark:text-violet-400';
    const avatar = accent === 'sky' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-violet-500/10 border-violet-500/20';
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex size-2">
            <span className={`animate-ping absolute size-full rounded-full opacity-75 ${ping}`} />
            <span className={`relative size-2 rounded-full ${dot}`} />
          </span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${label}`}>{t("interactivePlay.sendingAi")}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`size-12 rounded-xl border overflow-hidden relative shrink-0 ${avatar}`}>
            <div className="absolute inset-0 skeleton opacity-40" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded-full skeleton opacity-40" />
            <div className="h-2.5 w-5/6 rounded-full skeleton opacity-40" />
            <div className="h-2.5 w-2/3 rounded-full skeleton opacity-40" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-bold animate-pulse mt-3">{t("interactivePlay.aiChecking")}</p>
      </div>
    );
  };

  const renderMissedQuestionSummary = () => (
    <div className="flex flex-col items-stretch gap-3 w-full h-full overflow-y-auto pb-2">
      <div className="bg-card rounded-3xl border-2 border-amber-400/40 shadow-xl overflow-hidden shrink-0">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-center">
          <span className="text-white text-xs font-black uppercase tracking-wider">
            จบคำถามแล้ว
          </span>
        </div>
        <div className="p-6 text-center">
          <div className="text-4xl mb-2">⏰</div>
          <h2 className="text-xl font-black text-foreground">
            แย่จัง กดตอบคำถามไม่ทัน
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
            คุณครูจบการถามแล้ว รอบนี้ระบบจะรอไปคำถามหรือกิจกรรมถัดไปนะ
          </p>
        </div>
      </div>
      <MobileLeaderboard participants={participants} studentId={studentId} />
    </div>
  );

  // ─── Compact lesson content shown on the student's phone per phase (static, follows phase only) ──
  const renderLessonContentMobile = () => {
    const ad = articleData as {
      passage?: string;
      translated_summary?: { th?: string[] };
      summary?: string | { th?: string[] };
    } | null;
    const words = articleData?.words || [];
    const sentences = articleData?.sentences || [];
    const passage: string = ad?.passage || '';
    const vocabWords = words
      .map((w) => (typeof w === 'object' ? (w.vocabulary || w.word || w.text) : w))
      .filter(Boolean) as string[];

    const renderPassage = (highlight: boolean) => {
      if (!passage) return null;
      let body: React.ReactNode = passage;
      if (highlight && vocabWords.length) {
        const parts = passage.split(/(\s+)/);
        body = parts.map((part, i) => {
          const clean = part.replace(/[.,!?;:"'()]/g, '').toLowerCase();
          if (vocabWords.some((v) => v.toLowerCase() === clean)) {
            return (
              <mark key={i} className="bg-amber-300/60 dark:bg-amber-500/30 text-foreground rounded px-0.5 font-semibold not-italic">
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        });
      }
      return (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
          <p className="text-foreground text-sm leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>{body}</p>
        </div>
      );
    };

    switch (currentPhase) {
      case 1: {
        const summary = ad?.translated_summary?.th?.[0] || (typeof ad?.summary === 'string' ? ad.summary : ad?.summary?.th?.[0]);
        if (!summary) return null;
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
            <p className="text-foreground text-sm leading-relaxed">{summary}</p>
          </div>
        );
      }
      case 2:
        if (!words.length) return null;
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">คำศัพท์ ({words.length})</p>
            <div className="space-y-2">
              {words.map((item, i) => {
                const wt = typeof item === 'object' ? (item.vocabulary || item.word || item.text) : item;
                const th = typeof item === 'object' ? (item.definition?.th || item.translation) : undefined;
                return (
                  <div key={i} className="flex items-baseline justify-between gap-3 border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
                    <span className="font-bold text-foreground text-sm">{wt}</span>
                    {th && <span className="text-muted-foreground text-xs text-right">{th}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 3:
      case 5:
        return renderPassage(false);
      case 4:
        return renderPassage(true);
      case 6: {
        if (!sentences.length) return null;
        // Mirror the tutor's key-sentence selection (ArticleDisplay phase 6) so both screens show the same subset.
        const getText = (item: string | { sentences?: string }) => String(typeof item === 'object' ? item.sentences || '' : item || '');
        const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const getWordCount = (txt: string) => txt.trim().split(/\s+/).filter(Boolean).length;
        const kvWords = Array.from(new Set(
          words
            .map((w) => (typeof w === 'object' ? (w.vocabulary || w.word || w.text || '') : String(w)).toLowerCase().trim())
            .filter((w) => w.length >= 3)
        ));
        const kvPatterns = kvWords.map((w) => ({ pattern: new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i') }));
        const limit = Math.min(5, Math.max(2, Math.ceil(sentences.length * 0.35)));
        const keySentences = sentences
          .map((item, index) => {
            const txt = getText(item);
            const matched = kvPatterns.filter(({ pattern }) => pattern.test(txt));
            const wc = getWordCount(txt);
            const bonus = wc >= 8 && wc <= 28 ? 1 : wc < 5 ? -1 : 0;
            return { item, index, score: matched.length * 3 + matched.length / Math.max(wc, 1) + bonus };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .slice(0, limit)
          .sort((a, b) => a.index - b.index)
          .map(({ item }) => item);
        const display = keySentences.length ? keySentences : sentences.slice(0, limit);
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">ประโยคสำคัญ</p>
            {display.map((s, i) => {
              const text = typeof s === 'object' ? s.sentences : s;
              return (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-emerald-500 font-black text-xs shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-foreground text-sm leading-relaxed">{text}</span>
                </div>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const buildGameQuestions = () => {
    const words = articleData?.words || [];
    const sentences = articleData?.sentences || [];
    const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
    if (gameState?.category === "vocabulary") {
      return words.slice(0, 5).map((word, index) => {
        const label = word.vocabulary || word.word || word.text || `Word ${index + 1}`;
        const answer = word.definition?.th || word.translation || label;
        const distractors = words
          .map((item) => item.definition?.th || item.translation || item.vocabulary || item.word || item.text || "")
          .filter((item) => item && item !== answer)
          .slice(0, 6);
        return { prompt: label, answer, options: shuffle([answer, ...distractors]).slice(0, 4) };
      });
    }
    return sentences.slice(0, 5).map((sentence, index) => {
      const text = typeof sentence === "object" ? sentence.sentences : sentence;
      const parts = String(text).split(" ").filter(Boolean);
      const rotated = parts.length > 1 ? [...parts.slice(1), parts[0]].join(" ") : String(text);
      const reversed = parts.length > 1 ? [...parts].reverse().join(" ") : String(text);
      const otherSentence = sentences
        .map((item) => String(typeof item === "object" ? item.sentences : item))
        .find((item) => item && item !== String(text));
      return {
        prompt: parts.length > 1 ? [...parts].reverse().join(" / ") : `Sentence ${index + 1}`,
        answer: String(text),
        options: shuffle([String(text), rotated, reversed, otherSentence || `${String(text)}.`]).slice(0, 4),
      };
    });
  };

  const handleQuickGameComplete = () => {
    const questions = buildGameQuestions();
    const total = Math.max(questions.length, 1);
    const correct = questions.filter((question, index) => gameSelections[index] === question.answer).length;
    submitGameResult({
      gameId: gameState?.selectedGameId || "",
      score: correct * 2,
      correct,
      total,
      durationMs: gameStartedAt ? Date.now() - gameStartedAt : undefined,
    });
  };

  const getArcadeTheme = (gameId?: string | null, category?: "vocabulary" | "sentence") => {
    if (gameId?.includes("dragon")) {
        return { arena: "from-sky-500 via-indigo-600 to-violet-700", panel: "bg-sky-500/15 border-sky-300/40", target: "bg-sky-500", shadow: "shadow-[0_8px_0_rgb(3,105,161)]", avatar: "DR", action: t("interactivePlay.chooseCorrectAnswer") };
    }
    if (gameId?.includes("castle") || gameId?.includes("tower")) {
        return { arena: "from-slate-800 via-rose-800 to-amber-700", panel: "bg-amber-500/15 border-amber-300/40", target: "bg-amber-500", shadow: "shadow-[0_8px_0_rgb(146,64,14)]", avatar: "CT", action: t("interactivePlay.chooseCorrectAnswer") };
    }
    if (gameId?.includes("potion") || gameId?.includes("alchemist")) {
        return { arena: "from-emerald-700 via-teal-700 to-cyan-700", panel: "bg-emerald-500/15 border-emerald-300/40", target: "bg-emerald-500", shadow: "shadow-[0_8px_0_rgb(4,120,87)]", avatar: "PX", action: t("interactivePlay.brewCorrectAnswer") };
    }
    if (gameId?.includes("rune") || gameId?.includes("spell")) {
        return { arena: "from-violet-800 via-fuchsia-700 to-indigo-800", panel: "bg-violet-500/15 border-violet-300/40", target: "bg-violet-600", shadow: "shadow-[0_8px_0_rgb(91,33,182)]", avatar: "RN", action: t("interactivePlay.activateCorrectRune") };
    }
    if (gameId?.includes("shadow") || gameId?.includes("dungeon") || gameId?.includes("abyssal")) {
        return { arena: "from-zinc-950 via-indigo-950 to-slate-900", panel: "bg-indigo-500/15 border-indigo-300/30", target: "bg-indigo-600", shadow: "shadow-[0_8px_0_rgb(49,46,129)]", avatar: "DG", action: t("interactivePlay.escapeCorrectAnswer") };
    }
    return {
      arena: category === "vocabulary" ? "from-indigo-600 via-violet-700 to-fuchsia-700" : "from-rose-600 via-orange-600 to-amber-600",
      panel: "bg-white/15 border-white/25",
      target: category === "vocabulary" ? "bg-indigo-600" : "bg-rose-600",
      shadow: category === "vocabulary" ? "shadow-[0_8px_0_rgb(67,56,202)]" : "shadow-[0_8px_0_rgb(190,18,60)]",
      avatar: category === "vocabulary" ? "VX" : "SX",
      action: category === "vocabulary" ? t("interactivePlay.matchVocabulary") : t("interactivePlay.buildSentence"),
    };
  };

  const renderGamePhaseMobile = () => {
    if (!gameState) {
      return <div className="phase-enter w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl"><p className="text-sm font-bold text-muted-foreground">{t("interactivePlay.gamePreparing")}</p></div>;
    }
    const games = getGamesByCategory(gameState.category);
    const selected = getGameById(gameState.selectedGameId);
    const myVote = gameState.votes?.[gameActorId] || gameState.votes?.[studentId];
    const myResult = gameState.results?.[gameActorId] || gameState.results?.[studentId];
    const countdownLeft = gameState.countdownEndsAt ? Math.max(0, Math.ceil((gameState.countdownEndsAt - Date.now()) / 1000)) : 0;

    if (myResult) {
      return (
        <div className="phase-enter flex w-full max-w-sm flex-1 min-h-0 flex-col gap-4 overflow-hidden">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center shadow-xl">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t("interactivePlay.gameComplete")}</p>
            <p className="mt-3 text-6xl font-black text-emerald-600 dark:text-emerald-400">{myResult.score}</p>
            <p className="mt-2 text-sm font-bold text-muted-foreground">{t("interactivePlay.gameWaitTeacher")}</p>
          </div>
          <MobileLeaderboard participants={participants} studentId={studentId} />
        </div>
      );
    }

    if (gameState.status === "voting") {
      return (
        <div className="phase-enter flex w-full max-w-sm flex-1 min-h-0 flex-col gap-4 overflow-hidden">
          <div className="shrink-0 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{gameState.category === "vocabulary" ? t("interactivePlay.vocabularyGame") : t("interactivePlay.sentenceGame")}</p>
            <h2 className="mt-1 text-2xl font-black text-foreground">{t("interactivePlay.gameVoteTitle")}</h2>
          </div>
          <div className="mobile-game-deck -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-5 pt-1">
          {games.map((game, index) => {
            const isLocked = game.enabled === false;
            return (
            <button
              key={game.id}
              onClick={() => {
                if (!isLocked) submitGameVote(game.id);
              }}
              disabled={isLocked}
              aria-disabled={isLocked}
              className={`mobile-game-card group relative flex h-[430px] w-[282px] shrink-0 snap-center flex-col overflow-hidden rounded-[30px] border text-left shadow-2xl transition-all duration-300 ${
                isLocked
                  ? "cursor-not-allowed border-white/20 opacity-65 grayscale"
                  : `active:scale-[0.98] ${myVote === game.id ? "border-indigo-300 ring-4 ring-indigo-400/35" : "border-white/40"}`
              }`}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <Image src={game.cover} alt={game.title} fill sizes="282px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
              {isLocked && (
                <div className="absolute inset-0 z-10 bg-black/58 text-white backdrop-blur-[2px]">
                  <div className="absolute left-1/2 top-[28%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                  <div className="flex size-16 items-center justify-center rounded-full border border-white/25 bg-white/15">
                    <Lock size={30} />
                  </div>
                  <p className="text-lg font-black">{t("interactivePlay.comingSoon")}</p>
                  </div>
                </div>
              )}
              <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                {gameState.category === "vocabulary" ? t("interactivePlay.gameCategoryVocab") : t("interactivePlay.gameCategorySentence")}
              </div>
              {myVote === game.id && (
                <div className="absolute right-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase text-emerald-950 shadow-lg">
                  {t("interactivePlay.selected")}
                </div>
              )}
              <div className="relative z-10 mt-auto p-5 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                  {t("interactivePlay.gameCard")}
                </p>
                <h3 className="mt-2 text-2xl font-black leading-tight text-white">
                  {game.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm font-semibold leading-relaxed text-white/75">
                  {game.description}
                </p>
                <div className={`mt-5 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black shadow-lg transition-colors ${
                  isLocked
                    ? "bg-white/15 text-white"
                    : myVote === game.id
                      ? "bg-emerald-400 text-emerald-950"
                      : "bg-white text-slate-950 group-active:bg-indigo-100"
                }`}>
                  {isLocked && <Lock size={16} />}
                  {isLocked
                    ? t("interactivePlay.comingSoon")
                    : myVote === game.id
                      ? t("interactivePlay.voteDone")
                      : t("interactivePlay.chooseThisGame")}
                </div>
              </div>
            </button>
            );
          })}
          </div>
          <div className="shrink-0 rounded-3xl border border-border bg-card p-4 text-center shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t("interactivePlay.yourVote")}
            </p>
            <p className="mt-1 text-sm font-black text-foreground">
              {myVote ? getGameById(myVote)?.title || myVote : t("interactivePlay.noGameSelected")}
            </p>
          </div>
        </div>
      );
    }

    if (gameState.status === "countdown") {
      return (
        <div className="phase-enter fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-center text-white">
          {selected?.cover && (
            <Image
              src={selected.cover}
              alt={selected.title}
              fill
              sizes="100vw"
              className="absolute inset-0 size-full object-cover opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-slate-950/70 to-slate-950/50" />
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
            <p className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/70 backdrop-blur">
              {t("interactivePlay.getReady")}
            </p>
            <p className="mt-8 text-[clamp(6rem,34vw,12rem)] font-black leading-none text-white drop-shadow-2xl">
              {countdownLeft}
            </p>
            <p className="mt-5 text-2xl font-black leading-tight text-white">
              {selected?.title || "Game"}
            </p>
            <p className="mt-2 text-sm font-bold text-white/60">
              {t("interactivePlay.gameStartsAutomatically")}
            </p>
          </div>
        </div>
      );
    }

    if (gameState.status === "playing") {
      return (
        <div className="phase-enter fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-background">
          <AdvantageArcadeRuntime
            key={`${gameState.phase}-${gameState.selectedGameId}`}
            gameId={gameState.selectedGameId || ""}
            category={gameState.category}
            articleData={articleData}
            onComplete={(result) => {
              submitGameResult({
                gameId: gameState.selectedGameId || "",
                score: result.score,
                correct: result.correct,
                total: result.total,
                durationMs: result.durationMs,
              });
            }}
          />
        </div>
      );
    }

    const questions = buildGameQuestions();
    const answeredCount = questions.filter((_question, index) => gameSelections[index]).length;
    const liveCorrect = questions.filter((question, index) => gameSelections[index] === question.answer).length;
    const activeIndex = Math.min(answeredCount, Math.max(questions.length - 1, 0));
    const activeQuestion = questions[activeIndex];
    const theme = getArcadeTheme(gameState.selectedGameId, gameState.category);
    const progressPct = questions.length ? (answeredCount / questions.length) * 100 : 0;
    return (
      <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto py-2">
        <div className={`relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br ${theme.arena} p-5 text-white shadow-2xl`}>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 18% 24%, white 2px, transparent 2px)", backgroundSize: "28px 28px" }} />
          <div className="absolute -right-10 top-8 size-32 rounded-full bg-white/10 blur-sm" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/70">{selected?.title || t("interactivePlay.lessonGame")}</p>
              <h2 className="mt-1 text-xl font-black leading-tight text-white">{theme.action}</h2>
            </div>
            <div className="rounded-2xl bg-black/25 px-3 py-2 text-right">
              <p className="text-[9px] font-black uppercase text-white/60">{t("interactivePlay.score")}</p>
              <p className="text-2xl font-black tabular-nums">{liveCorrect * 2}</p>
            </div>
          </div>
          <div className="relative z-10 mt-5 flex items-center gap-4">
            <div className="relative flex size-20 shrink-0 items-center justify-center rounded-3xl border border-white/25 bg-white/20 shadow-xl arcade-float">
              <span className="text-2xl font-black tracking-tight text-white">{theme.avatar}</span>
              <span className="absolute -right-1 -top-1 size-4 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
            </div>
            <div className={`min-w-0 flex-1 rounded-3xl border p-4 backdrop-blur ${theme.panel}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Target {activeIndex + 1} / {Math.max(questions.length, 1)}</p>
              <p className="mt-1 break-words text-base font-black leading-snug text-white">{activeQuestion?.prompt || t("interactivePlay.ready")}</p>
            </div>
          </div>
          <div className="relative z-10 mt-5">
            <div className="h-3 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/70">
              <span>Combo {liveCorrect}</span>
              <span>{answeredCount}/{questions.length}</span>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{selected?.title || t("interactivePlay.lessonGame")}</p>
          <h2 className="mt-2 text-xl font-black text-foreground">ตอบให้ครบแล้วส่งคะแนน</h2>
        </div>
        <div className="space-y-2">
          {questions.map((question, index) => (
            <div key={`${question.prompt}-${index}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ข้อ {index + 1}</p>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stage {index + 1}</p>
                {gameSelections[index] && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${gameSelections[index] === question.answer ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                    {gameSelections[index] === question.answer ? "HIT" : "MISS"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-black text-foreground">{question.prompt}</p>
              <div className="mt-3 grid gap-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => setGameSelections((prev) => ({ ...prev, [index]: option }))}
                    className={`btn-3d rounded-xl px-3 py-3 text-left text-xs font-black text-white transition-all ${theme.target} ${theme.shadow} ${
                      gameSelections[index] === option
                        ? "ring-4 ring-white/70 brightness-110"
                        : "opacity-95"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleQuickGameComplete}
          disabled={questions.some((_question, index) => !gameSelections[index])}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-4 text-base font-black text-white shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ส่งคะแนนเกม
        </button>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white text-xs font-black">✦</span>
          </div>
          <span className="font-black text-sm text-foreground">{t("interactivePlay.title")}</span>
        </div>
        {currentPhase > 0 && (
          <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1">
            <div className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Phase {currentPhase}</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col p-4 items-center justify-center relative overflow-hidden">

        {/* ─── Phase 0: Waiting Room ─── */}
        {currentPhase === 0 && (
          <div className="phase-enter w-full max-w-sm flex flex-col gap-4">
            {/* Article hero / gradient banner */}
            {articleImageUrl ? (
              <div className="w-full h-40 rounded-3xl overflow-hidden shadow-xl relative">
                <Image src={articleImageUrl} alt="article" fill sizes="(max-width: 640px) 100vw, 384px" className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">บทเรียนวันนี้</p>
                  <p className="text-white font-black text-sm leading-snug mt-0.5">{articleTitle || ''}</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-40 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 flex flex-col items-center justify-center shadow-xl gap-2 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                <span className="text-5xl relative z-10">📚</span>
                <p className="text-white font-black text-base relative z-10">บทเรียนวันนี้</p>
              </div>
            )}

            {/* Profile card */}
            <div className="bg-card rounded-3xl border border-border shadow-lg p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-500/30 shrink-0 shadow-sm bg-indigo-500/10">
                <Image
                  src={profile?.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
                  alt={name}
                  width={56} height={56}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-foreground truncate text-base">{name}</p>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full inline-block mt-1.5 border border-indigo-500/20">
                  {t("interactivePlay.studentRole")}
                </span>
              </div>
            </div>

            {/* Waiting status + classmates */}
            <div className="bg-card rounded-3xl border border-border shadow-lg p-5 text-center">
              <div className="flex justify-center gap-1.5 mb-3">
                {[0, 1, 2].map(i => <div key={i} className="size-2.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.25}s` }} />)}
              </div>
              <p className="font-bold text-muted-foreground text-sm">{t("interactivePlay.waitingTeacher")}</p>

              {participants.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">เพื่อนในห้อง ({participants.length})</p>
                  <div className="flex justify-center flex-wrap gap-2">
                    {participants.slice(0, 9).map((p, i) => (
                      <div key={i} className="flex flex-col items-center gap-1" title={p.name}>
                        <div className="size-9 rounded-xl overflow-hidden border-2 border-border shadow-md bg-muted flex items-center justify-center">
                          {p.pictureUrl
                            ? <Image src={p.pictureUrl} alt={p.name} width={36} height={36} className="size-full object-cover" unoptimized />
                            : <span className="text-[9px] font-bold text-muted-foreground">{p.name.slice(0, 2)}</span>
                          }
                        </div>
                        <span className="text-[8px] font-bold text-muted-foreground truncate max-w-[36px]">{p.name.split(' ')[0]}</span>
                      </div>
                    ))}
                    {participants.length > 9 && (
                      <div className="size-9 rounded-xl bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        +{participants.length - 9}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3.5 rounded-2xl border-2 border-border text-muted-foreground font-bold text-sm bg-card active:scale-95 transition-all"
            >
              {t("interactivePlay.backToHome")}
            </button>
          </div>
        )}

        {/* ─── Phase 1–6, 9: Look at Screen ─── */}
        {isLookAtScreenPhase && (() => {
          const cfg = PHASE_CONFIG[currentPhase];
          if (!cfg) return null;
          return (
            <div className="phase-enter w-full max-w-sm flex flex-col gap-4 overflow-y-auto max-h-[calc(100dvh-80px)] pb-4">
              {/* Big phase card */}
              <div className={`${cfg.bg} border-2 ${cfg.border} rounded-3xl p-8 text-center shadow-xl shrink-0`}>
                <div className="text-7xl mb-4" style={{ animation: 'bounce 2s infinite' }}>{cfg.emoji}</div>
                <div className={`inline-flex items-center gap-1.5 bg-white/10 dark:bg-white/5 border ${cfg.border} rounded-full px-3 py-1 mb-3`}>
                  <span className={`size-1.5 rounded-full animate-pulse ${cfg.color.replace('text-', 'bg-').split(' ')[0]}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>Phase {currentPhase}</span>
                </div>
                <h2 className={`text-2xl font-black ${cfg.color} mb-2`}>{cfg.label}</h2>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed">{cfg.tip}</p>
              </div>

              {/* Look at screen instruction */}
              <div className="bg-card rounded-2xl border border-border shadow-md p-4 flex items-center gap-3 shrink-0">
                <div className={`size-11 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center text-xl shrink-0`}>👆</div>
                <div>
                  <p className="font-black text-foreground text-sm">{t("interactivePlay.lookAtScreen")}</p>
                  <p className={`${cfg.color} text-xs font-bold mt-0.5`}>{cfg.label}</p>
                </div>
              </div>

              {/* Article title pill */}
              {articleTitle && (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-3 flex items-center gap-2.5 shrink-0">
                  <span className="text-base shrink-0">📄</span>
                  <p className="text-xs font-semibold text-muted-foreground truncate">{articleTitle}</p>
                </div>
              )}

              {/* Compact lesson content (static, per phase) */}
              {renderLessonContentMobile()}
            </div>
          );
        })()}

        {[VOCAB_GAME_PHASE, SENTENCE_GAME_PHASE].includes(currentPhase) && renderGamePhaseMobile()}

        {/* ─── Step 3: Read the Article + Sentence Flag ─── */}
        {currentPhase === 3 && (
          <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto py-2">
            <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-3xl p-5 text-center shrink-0">
              <div className="text-4xl mb-2">🎧</div>
              <h2 className="text-lg font-black text-teal-600 dark:text-teal-400">อ่านบทความ · ออกเสียง</h2>
              <p className="text-muted-foreground text-xs font-medium mt-1">แตะประโยคที่อยากให้คุณครูช่วยออกเสียง 🚩</p>
            </div>
            <div className="bg-card rounded-2xl border border-border shadow-md p-4 flex items-center gap-3 shrink-0">
              <div className="size-11 rounded-xl bg-teal-500/10 border-teal-500/30 border flex items-center justify-center text-xl shrink-0">👆</div>
              <div>
                <p className="font-black text-foreground text-sm">{t("interactivePlay.lookAtScreen")}</p>
                <p className="text-teal-600 dark:text-teal-400 text-xs font-bold mt-0.5">อ่านบทความ</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-3 min-h-[120px] flex flex-col items-center justify-center">
              {(() => {
                const activeIdx = sessionData?.activeSentenceIndex ?? -1;
                if (activeIdx < 0) {
                   return (
                     <div className="text-center">
                       <p className="text-muted-foreground text-sm font-bold animate-pulse">รอคุณครูเล่นเสียงบทความ...</p>
                     </div>
                   );
                }
                const s = articleData?.sentences?.[activeIdx];
                if (!s) return null;
                const text = typeof s === 'object' ? s.sentences : s;
                const isFlagged = myFlags.has(activeIdx);
                const count = flagCounts?.[activeIdx] || 0;
                return (
                  <button
                    onClick={() => handleFlagToggle(activeIdx)}
                    className={`w-full text-left rounded-xl px-4 py-6 transition-all flex items-start gap-3 shadow-md ${
                      isFlagged
                        ? 'bg-rose-500/15 border border-rose-400/50'
                        : 'bg-teal-50/50 dark:bg-teal-900/20 border border-teal-500/20 active:scale-95'
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-1">{isFlagged ? '🚩' : '🔖'}</span>
                    <span className={`flex-1 text-lg leading-relaxed ${isFlagged ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-foreground font-semibold'}`}>
                      {text}
                    </span>
                    {count > 0 && (
                      <span className="text-xs font-black text-rose-500 bg-rose-500/10 rounded-full px-2 py-1 shrink-0">{count}</span>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* ─── Step 11: Guided Writing (phase 12) ─── */}
        {currentPhase === 13 && (() => {
          const idx = sessionData?.phaseSelectedIndices?.[13] || 0;
          const prompt = articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.writingTitle");
          const frames = ['I think that…', 'One reason is…', 'For example,…', 'In conclusion,…'];
          return (
            <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto py-2">
              {missedQuestion ? (
                renderMissedQuestionSummary()
              ) : aiFeedback ? (
                <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                  <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 flex items-center gap-2">
                    <span className="text-white text-xs font-black uppercase tracking-wider">🤖 {t("interactivePlay.aiEvaluation")}</span>
                  </div>
                  <div className="p-5 flex flex-col items-center gap-3">
                    <span className={`text-4xl font-black ${getScoreColor(aiFeedback.score)}`}>{aiFeedback.score}<span className="text-base text-muted-foreground"> / 5</span></span>
                    <div className="w-full rounded-2xl p-4 border-l-4 bg-sky-500/10 border-sky-400">
                      <p className="text-sm font-semibold text-foreground leading-relaxed">{aiFeedback.feedback}</p>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground animate-pulse">{t("interactivePlay.waitingNextPage")}</p>
                  </div>
                </div>
              ) : (hasAnswered || isSubmitting) ? (
                renderAiSkeleton('sky')
              ) : (
                <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                  <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3">
                    <span className="text-white text-xs font-black uppercase tracking-wider">✍️ {t("interactivePlay.writingTitle")}</span>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-bold text-foreground leading-relaxed">{prompt}</p>
                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-3">
                      <p className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">{t("interactivePlay.framesTitle")}</p>
                      <p className="text-[11px] text-muted-foreground mb-2 mt-0.5">{t("interactivePlay.framesHint")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {frames.map((f) => (
                          <button
                            type="button"
                            key={f}
                            onClick={() => setWritingDraft((prev) => (prev ? prev.replace(/\s*$/, ' ') : '') + f.replace('…', '') + ' ')}
                            className="text-xs bg-card border border-sky-500/30 rounded-full px-2.5 py-1 text-foreground active:scale-95 active:bg-sky-500/10 transition-all"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground">{t("interactivePlay.writingPlanLabel")}</label>
                      <textarea
                        value={writingPlan}
                        onChange={(e) => setWritingPlan(e.target.value)}
                        className="mt-1 w-full border-2 border-border bg-muted text-foreground rounded-2xl p-3 min-h-[60px] text-sm focus:border-sky-500 focus:outline-none resize-y"
                        placeholder={t("interactivePlay.writingPlanPlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground">{t("interactivePlay.writingDraftLabel")}</label>
                      <textarea
                        value={writingDraft}
                        onChange={(e) => setWritingDraft(e.target.value)}
                        className="mt-1 w-full border-2 border-border bg-muted text-foreground rounded-2xl p-3 min-h-[110px] text-sm focus:border-sky-500 focus:outline-none resize-y"
                        placeholder={t("interactivePlay.writingDraftPlaceholder")}
                      />
                    </div>
                    <button
                      onClick={handleWritingSubmit}
                      disabled={!writingDraft.trim()}
                      className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-base py-4 rounded-2xl shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {t("interactivePlay.writingSubmit")}
                    </button>
                  </div>
                </div>
              )}
              <MobileLeaderboard participants={participants} studentId={studentId} />
            </div>
          );
        })()}

        {/* ─── Step 12: Language Questions (phase 13) ─── */}
        {currentPhase === 15 && (
          <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto py-2">
            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : languageSkipped ? (
              <div className="bg-card rounded-2xl border border-border shadow-sm p-5 text-center">
                <div className="text-2xl mb-1">👌</div>
                <h2 className="font-black text-foreground">{t("interactivePlay.languageSkipped")}</h2>
                <p className="text-muted-foreground text-sm mt-0.5">{t("interactivePlay.waitingFriends")}</p>
              </div>
            ) : languageAnswer ? (
              <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3">
                  <span className="text-white text-xs font-black uppercase tracking-wider">🤖 {t("interactivePlay.languageAiTitle")}</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="bg-muted/50 rounded-2xl p-3">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-sm font-semibold text-foreground">{languageAnswer.question}</p>
                  </div>
                  <div className="rounded-2xl p-4 border-l-4 bg-violet-500/10 border-violet-400">
                    <p className="text-sm font-semibold text-foreground leading-relaxed">{languageAnswer.answer}</p>
                  </div>
                  <p className="text-xs font-bold text-muted-foreground animate-pulse">{t("interactivePlay.waitingNextPage")}</p>
                </div>
              </div>
            ) : (hasAnswered || isSubmitting) ? (
              renderAiSkeleton('violet')
            ) : (
              <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3">
                  <span className="text-white text-xs font-black uppercase tracking-wider">❓ {t("interactivePlay.languageTitle")}</span>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-sm font-bold text-foreground">{t("interactivePlay.languagePrompt")}</p>
                  <textarea
                    value={languageQuestion}
                    onChange={(e) => setLanguageQuestion(e.target.value)}
                    className="w-full border-2 border-border bg-muted text-foreground rounded-2xl p-3 min-h-[100px] text-sm focus:border-violet-500 focus:outline-none resize-y"
                    placeholder={t("interactivePlay.languagePlaceholder")}
                  />
                  <button
                    onClick={handleLanguageSubmit}
                    disabled={!languageQuestion.trim()}
                    className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-black text-base py-4 rounded-2xl shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {t("interactivePlay.languageSubmit")}
                  </button>
                  <button
                    onClick={handleLanguageSkip}
                    className="w-full border-2 border-border text-muted-foreground font-bold text-sm py-3 rounded-2xl bg-card active:scale-95 transition-all"
                  >
                    {t("interactivePlay.languageSkip")}
                  </button>
                </div>
              </div>
            )}
            <MobileLeaderboard participants={participants} studentId={studentId} />
          </div>
        )}

        {/* ─── Step 13: Lesson Reflection (phase 14) ─── */}
        {currentPhase === 16 && (
          <LessonReflectionPhase
            hasAnswered={hasAnswered}
            reviewRating={reviewRating}
            setReviewRating={setReviewRating}
            reviewComment={reviewComment}
            setReviewComment={setReviewComment}
            understanding={understanding}
            setUnderstanding={setUnderstanding}
            effort={effort}
            setEffort={setEffort}
            isSubmitting={isSubmitting}
            handleReflectionSubmit={handleReflectionSubmit}
            participants={participants}
            studentId={studentId}
          />
        )}

        {currentPhase === 17 && (
          <LessonPairPhase
            devPairPreview={devPairPreview}
            sessionData={sessionData}
            studentId={studentId}
            name={name}
          />
        )}

        {currentPhase === FINAL_LEADERBOARD_PHASE && (
          <LessonWrapUpPhase
            participants={participants}
            studentId={studentId}
          />
        )}

        {/* ─── MCQ-style Phases: Comprehension(7), Vocab(9), Sentence fill(10), Sentence order(11) ─── */}
        {[7, 9, 11, 12].includes(currentPhase) && (
          <div className="phase-enter w-full max-w-md flex-1 flex flex-col gap-3 min-h-0">
            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : hasAnswered ? (
              /* After answering: show result + leaderboard */
              <div className="flex flex-col items-stretch gap-3 w-full h-full overflow-y-auto pb-2">
                {selectedChoice && (
                  <div className="bg-card rounded-2xl border-2 border-indigo-500/30 shadow-md p-4 text-center shrink-0">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-6xl font-black text-indigo-600 dark:text-indigo-400">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-5 text-center shrink-0">
                    <div className="text-3xl mb-2">🎉</div>
                    <h2 className="font-black text-emerald-600 dark:text-emerald-400 text-lg">{t("interactivePlay.everyoneAnswered")}</h2>
                    <p className="text-emerald-600/70 dark:text-emerald-400/70 text-sm mt-1">{t("interactivePlay.watchTeacherAnswer")}</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-2xl p-4 text-center shrink-0 shadow-sm">
                    <div className="text-2xl mb-1">✅</div>
                    <h2 className="font-black text-foreground text-base">{t("interactivePlay.answerSubmitted")}</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">{t("interactivePlay.waitingFriends")}</p>
                  </div>
                )}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </div>
            ) : (
              /* Before answering: show question + MCQ buttons */
              <>
                {/* Question card */}
                <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden shrink-0">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5">
                    <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">❓ คำถาม</span>
                  </div>
                  <div className="px-4 py-4 text-center font-bold text-foreground text-sm leading-relaxed">
                    {(() => {
                      if (currentPhase === 7) {
                        const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
                        return articleData?.multipleChoiceQuestions?.[idx]?.question || t("interactivePlay.defaultQuestion");
                      } else if (currentPhase === 9) {
                        const idx = sessionData?.phaseSelectedIndices?.[9] || 0;
                        const w = articleData?.words?.[idx];
                        return `${t("interactivePlay.vocabMeaningPrefix")} "${w?.vocabulary || w?.word || w?.text}" ${t("interactivePlay.vocabMeaningSuffix")}`;
                      } else if (currentPhase === 11) {
                        const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
                        const s = articleData?.sentences?.[idx];
                        const targetStr = typeof s === 'object' ? s.sentences : s;
                        const words = String(targetStr).split(' ');
                        return `${t("interactivePlay.fillBlankPrefix")} ${words.slice(0, words.length - 1).join(' ')} _____`;
                      } else if (currentPhase === 12) {
                        const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
                        return `${t("interactivePlay.orderSentencePrefix")} ${idx + 1}`;
                      }
                      return t("interactivePlay.defaultQuestion");
                    })()}
                  </div>
                </div>

                {/* 2×2 MCQ grid */}
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {mcqOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleMcqClick(opt.label)}
                      className={`btn-3d ${opt.bg} ${opt.shadow} ${opt.activeShadow} active:translate-y-1.5 rounded-2xl flex flex-col items-center justify-center text-white font-black min-h-[100px] gap-1 transition-transform select-none`}
                    >
                      <span className="text-5xl">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Guided Response / Short Answer (Step 8) ─── */}
        {currentPhase === 8 && (
          <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto py-2">

            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : aiFeedback ? (
              /* AI Feedback result */
              <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-black uppercase tracking-wider">🤖 {t("interactivePlay.aiEvaluation")}</span>
                </div>
                <div className="p-5 flex flex-col items-center gap-4">
                  {/* Score ring */}
                  <div className="relative size-28">
                    <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={getScoreStroke(aiFeedback.score)}
                        strokeWidth="10" strokeLinecap="round"
                        strokeDasharray="264"
                        strokeDashoffset={264 - (264 * aiFeedback.score / 5)}
                        style={{ animation: 'score-ring-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-black ${getScoreColor(aiFeedback.score)}`}>{aiFeedback.score}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">{t("interactivePlay.fullScore")}</span>
                    </div>
                  </div>
                  {/* Stars */}
                  <p className="text-xl">{getScoreStars(aiFeedback.score) || '—'}</p>
                  {/* Feedback card */}
                  <div className={`w-full rounded-2xl p-4 border-l-4 ${
                    aiFeedback.score >= 4
                      ? 'bg-emerald-500/10 border-emerald-400'
                      : aiFeedback.score >= 2
                      ? 'bg-amber-500/10 border-amber-400'
                      : 'bg-rose-500/10 border-rose-400'
                  }`}>
                    <p className="text-sm font-semibold text-foreground leading-relaxed">{aiFeedback.feedback}</p>
                  </div>
                  {/* Waiting */}
                  <p className="text-xs font-bold text-muted-foreground flex items-center gap-2 animate-pulse">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute size-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative size-2 rounded-full bg-indigo-500" />
                    </span>
                    {t("interactivePlay.waitingNextPage")}
                  </p>
                </div>
              </div>

            ) : (hasAnswered || isSubmitting) ? (
              /* Submitted — waiting for AI */
              <>
                {selectedChoice && (
                  <div className="bg-card rounded-2xl border-2 border-violet-500/30 shadow-md p-4 shrink-0">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-sm font-semibold text-foreground leading-relaxed break-words">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-5 text-center shrink-0">
                    <div className="text-2xl mb-2">🎉</div>
                    <h2 className="font-black text-emerald-600 dark:text-emerald-400">{t("interactivePlay.submittedDone")}</h2>
                    <p className="text-emerald-600/70 dark:text-emerald-400/70 text-xs mt-1">{t("interactivePlay.waitingAiScore")}</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-4 shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex size-2">
                        <span className="animate-ping absolute size-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative size-2 rounded-full bg-violet-500" />
                      </span>
                      <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">{t("interactivePlay.sendingAi")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-violet-500/10 border border-violet-500/20 overflow-hidden relative shrink-0">
                        <div className="absolute inset-0 skeleton opacity-40" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 rounded-full skeleton opacity-40" />
                        <div className="h-2.5 w-5/6 rounded-full skeleton opacity-40" />
                        <div className="h-2.5 w-2/3 rounded-full skeleton opacity-40" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold animate-pulse mt-3">{t("interactivePlay.aiChecking")}</p>
                  </div>
                )}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </>

            ) : (
              /* Input form */
              <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 flex items-center gap-2">
                  <span className="text-white text-sm">✏️</span>
                  <span className="text-white text-xs font-black uppercase tracking-wider">Short Answer</span>
                </div>
                <div className="p-5">
                  <p className="text-sm font-bold text-foreground leading-relaxed mb-4">
                    {(() => {
                      const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
                      return articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.textAnswerFallback");
                    })()}
                  </p>
                  <textarea
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    className="w-full border-2 border-border bg-muted text-foreground rounded-2xl p-4 min-h-[120px] max-h-[35dvh] text-sm leading-relaxed focus:border-violet-500 focus:outline-none mb-3 resize-y transition-colors placeholder:text-muted-foreground"
                    placeholder={t("interactivePlay.textAnswerPlaceholder")}
                  />
                  {/* Progress bars */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-muted-foreground">{typedAnswer.length} {t("interactivePlay.characterUnit")}</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-1.5 w-6 rounded-full transition-all duration-300 ${typedAnswer.length > i * 40 ? 'bg-violet-500' : 'bg-muted'}`} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!typedAnswer.trim()}
                    className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-black text-base py-4 rounded-2xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {t("interactivePlay.submitAnswer")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
      {devPairButton}
    </div>
  );
}

export default function PlayLessonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card rounded-3xl border border-border shadow-xl p-8 text-center max-w-[280px] w-full">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">📚</span>
          </div>
          <p className="text-muted-foreground text-sm">{t("interactivePlay.preparingData")}</p>
        </div>
      </div>
    }>
      <PlayLessonContent />
    </Suspense>
  );
}
