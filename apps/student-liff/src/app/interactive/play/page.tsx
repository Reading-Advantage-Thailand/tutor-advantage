"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bot, DoorOpen, Hourglass, MessageCircleQuestion, PenLine, SearchX, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';
import { playSound } from '@/lib/sounds';
import { studentApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { MobileLeaderboard } from '@/components/lesson/MobileLeaderboard';
import { LessonReflectionPhase } from '@/components/lesson/phases/LessonReflectionPhase';
import { LessonPairPhase } from '@/components/lesson/phases/LessonPairPhase';
import { LessonWrapUpPhase } from '@/components/lesson/phases/LessonWrapUpPhase';
// next/dynamic (ssr:false) runtime: the arcade and each game are separate chunks, warmed by preloadGame().
import { LazyArcadeRuntime as AdvantageArcadeRuntime, preloadGame } from '@/components/lesson/gameRegistry';
import { getLessonConnectionState, getLessonErrorKind } from '@/components/lesson/lessonConnection';
import { buildLobbyUrl } from '@/components/lesson/lessonRoutes';
import { PaymentRequiredScreen } from '@/components/lesson/PaymentRequiredScreen';
import { getPhaseMeta } from '@/components/lesson/phaseMeta';
import { getGameById, getGameTutorial } from '@/lib/liveLessonGames';
import { preloadGameAssets } from '@/lib/games/gameAssetPreloader';
import { VocabularyFlashcardPhase } from '@/components/lesson/VocabularyFlashcardPhase';
import { GAME_PHASES, LESSON_PHASE, TOTAL_LESSON_PHASES } from '@/lib/lessonPhases';
import { AppBar, Chip, ErrorState, HScroll, Screen, StatusScreen, TextArea } from '@/components/mobile';
import { Button, buttonVariants } from '@/components/ui/button';
import { LessonTopBar } from './_components/LessonTopBar';
import { PlaySkeleton } from './_components/PlaySkeleton';
import {
  AiFeedbackText,
  AiPendingCard,
  AiScore,
  AnswerEcho,
  LookAtScreenRow,
  PhaseCard,
  PhaseColumn,
  PhaseIntroCard,
  StatusCard,
  WaitingNextLine,
} from '@/components/lesson/PhaseBlocks';
import { getScoreStars } from '@/components/lesson/aiScore';
import { getVotingDeck, isLookAtScreenPhase, MCQ_PHASES } from './_components/playModel';

const FINAL_LEADERBOARD_PHASE = TOTAL_LESSON_PHASES;

const cardClass = 'rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]';

// ── Main Component ────────────────────────────────────────────────────────────
function PlayLessonContent() {
  // "Try again" after a fatal connection error remounts the lesson, which
  // reopens the socket (fresh token + join) exactly like a first visit.
  const [attempt, setAttempt] = useState(0);
  return <PlayLesson key={attempt} onReconnect={() => setAttempt((value) => value + 1)} />;
}

function PlayLesson({ onReconnect }: { onReconnect: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const { profile, isReady: liffReady, error: liffError, errorCode: liffErrorCode, retry: retryLiff } = useLiff();

  // Do not open a lesson socket with the placeholder identity while LIFF is
  // still resolving the real student profile. That creates a second join on
  // profile hydration and can make the tutor see the participant/session
  // state bounce during a phase.
  const studentId = liffReady ? (profile?.userId || "") : "";
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
    submissionError,
    missedQuestion,
    submitAnswer,
    kicked,
    flagCounts,
    flagSentence,
    submitGameVote,
    submitGameResult,
    phaseReadOnly,
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
  // Phase 13 Guided Writing
  const [writingPlan, setWritingPlan] = useState('');
  const [writingDraft, setWritingDraft] = useState('');
  // Phase 15 Language Questions
  const [languageQuestion, setLanguageQuestion] = useState('');
  const [languageSkipped, setLanguageSkipped] = useState(false);
  // Phase 16 Reflection
  const [understanding, setUnderstanding] = useState('');
  const [effort, setEffort] = useState('');
  // Dev-only: preview the Phase 17 pair view without a real session.
  // 0 = off, 1 = pair (1 partner), 2 = group of three (2 partners)
  const [devPairPreview, setDevPairPreview] = useState<0 | 1 | 2>(0);
  const currentPhase = devPairPreview ? LESSON_PHASE.PAIR_CONVERSATION : (sessionData?.currentPhase ?? 0);
  const submittedGameKeyRef = useRef<string | null>(null);
  const [pendingGameResult, setPendingGameResult] = useState<{ key: string; score: number } | null>(null);
  const gameState = sessionData?.gameState ?? null;
  const gamePhaseKey = gameState
    ? `${gameState.phase}:${gameState.selectedGameId || ""}`
    : "";
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
      setMyFlags(new Set());
    }
    if (sessionData) setPrevPhase(sessionData.currentPhase);
    setIsSubmitting(false);
  }, [sessionData, prevPhase]);

  useEffect(() => { if (hasAnswered) setIsSubmitting(false); }, [hasAnswered]);

  useEffect(() => {
    if (!submissionError) return;
    setIsSubmitting(false);
    toast.error(submissionError);
  }, [submissionError]);

  // Reset my sentence flags at the start of a fresh instructional cycle
  useEffect(() => { if (currentPhase === LESSON_PHASE.LAUNCH) setMyFlags(new Set()); }, [currentPhase]);

  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (gameState?.status !== "countdown") return;
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 250);
    return () => window.clearInterval(timer);
  }, [gameState?.status, gameState?.countdownEndsAt]);

  useEffect(() => {
    if (!gameIdForPreload) return;
    if (!["voting", "ready", "teacher_demo", "tutorial", "countdown", "playing", "results"].includes(gameStatusForPreload)) return;
    void preloadGameAssets(gameIdForPreload);
    void preloadGame(gameIdForPreload);
  }, [gameIdForPreload, gameStatusForPreload]);

  useEffect(() => {
    if (!gamePhaseKey || submittedGameKeyRef.current === gamePhaseKey) return;
    submittedGameKeyRef.current = null;
    setPendingGameResult(null);
  }, [gamePhaseKey]);

  useEffect(() => {
    if (gameState?.status === "playing" && !gameStartedAt) {
      setGameStartedAt(Date.now());
    }
    if (!gameState || gameState.phase !== currentPhase) {
      setGameStartedAt(null);
      setGameSelections({});
    }
  }, [gameState, currentPhase, gameStartedAt]);

  // Back to the lobby while the session is in phase 0. replace, not push:
  // otherwise Android back from the lobby re-opens this page (history ping-pong).
  useEffect(() => {
    if (sessionData && sessionData.currentPhase === 0 && classId) {
      router.replace(buildLobbyUrl(classId));
    }
  }, [sessionData, classId, router]);

  useEffect(() => {
    if (!classId || currentPhase !== LESSON_PHASE.REFLECTION || reviewLoaded) return;

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
      toast.error(t("interactivePlay.reviewNeedStars"));
      return;
    }

    try {
      await studentApi.submitClassReview(classId, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      toast.success(t("interactivePlay.reviewSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("interactivePlay.reviewSaveFailed"));
    } finally {
    }
  };

  useEffect(() => {
    if (!hasAnswered && !isSubmitting) setSelectedChoice(null);
  }, [hasAnswered, isSubmitting]);

  // ─── Loading / Error States ────────────────────────────────────────────────

  if (!liffReady) {
    return <PlaySkeleton />;
  }

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("interactivePlay.topBarTitle")} back fallbackHref="/dashboard" />
        <ErrorState
          kind={liffErrorCode === "network" ? "offline" : "error"}
          onRetry={retryLiff}
          className="flex-1 justify-center"
        />
      </Screen>
    );
  }

  const homeLink = (
    <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
      {t("interactivePlay.backHome")}
    </Link>
  );

  if (kicked) {
    return (
      <Screen>
        <AppBar title={t("interactivePlay.topBarTitle")} back fallbackHref="/dashboard" />
        <StatusScreen
          icon={DoorOpen}
          tone="neutral"
          title={kicked}
          description={t("interactivePlay.lessonEnded")}
          primaryAction={homeLink}
        />
      </Screen>
    );
  }

  if (paymentRequired) {
    return <PaymentRequiredScreen data={paymentRequired} classId={classId} title={t("interactivePlay.topBarTitle")} />;
  }

  // A socket error after joining is usually a network blip: socket.io
  // reconnects on its own and `connect` clears the error, so the current phase
  // stays on screen with a sticky "reconnecting" strip. Only an error before
  // the student has joined (e.g. no socket token) or the server's "no open
  // session" reply (reconnecting cannot fix it) blocks the screen.
  const connection = getLessonConnectionState(error, Boolean(sessionData));

  if (connection === "fatal") {
    // "No open session" is not a network problem: say so instead of "check your internet".
    const errorKind = getLessonErrorKind(error);
    return (
      <Screen>
        <AppBar title={t("interactivePlay.topBarTitle")} back fallbackHref="/dashboard" />
        <StatusScreen
          icon={errorKind === "notStarted" ? Hourglass : WifiOff}
          tone={errorKind === "notStarted" ? "brand" : "amber"}
          title={errorKind === "notStarted" ? t("interactivePlay.notStartedTitle") : t("interactivePlay.connectFailedTitle")}
          description={
            errorKind === "notStarted"
              ? t("interactivePlay.notStartedDescription")
              : errorKind === "server" && error
                ? error
                : t("interactivePlay.connectFailedDescription")
          }
          primaryAction={
            <Button variant="brand" size="cta" className="w-full" onClick={onReconnect}>
              {t("common.retry")}
            </Button>
          }
          secondaryAction={
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "cta" }), "w-full text-fg-muted")}>
              {t("interactivePlay.backHome")}
            </Link>
          }
        />
      </Screen>
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

  // Without a classId no socket is ever opened: explain it instead of an endless "connecting".
  if (!classId && !devPairPreview) {
    return (
      <Screen>
        <AppBar title={t("interactivePlay.topBarTitle")} back fallbackHref="/dashboard" />
        <StatusScreen
          icon={SearchX}
          tone="neutral"
          title={t("interactivePlay.missingClassTitle")}
          description={t("interactivePlay.missingClassDescription")}
          primaryAction={homeLink}
        />
        {devPairButton}
      </Screen>
    );
  }

  if (!sessionData && !devPairPreview) {
    return (
      <>
        <PlaySkeleton status={t("interactivePlay.connectingLesson")} />
        {devPairButton}
      </>
    );
  }

  // Phase 0 = the lesson has not started: the effect above sends the student
  // back to the lobby; show a short placeholder meanwhile.
  if (currentPhase === 0) {
    return <PlaySkeleton status={t("interactivePlay.returningToLobby")} />;
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleMcqClick = (answer: string) => {
    if (phaseReadOnly) return;
    playSound('select');
    setIsSubmitting(true);
    setSelectedChoice(answer);
    const currentPhase = sessionData?.currentPhase;
    let questionText = t("interactivePlay.defaultQuestion");
    let expected = "";
    if (currentPhase === LESSON_PHASE.COMPREHENSION) {
      const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.COMPREHENSION] || 0;
      const q = articleData?.multipleChoiceQuestions?.[idx];
      questionText = q?.question || questionText;
      expected = q?.answer || expected;
    } else if (currentPhase === LESSON_PHASE.VOCABULARY_PRACTICE) {
      const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.VOCABULARY_PRACTICE] || 0;
      const w = articleData?.words?.[idx];
      questionText = `${t("interactivePlay.vocabMeaningPrefix")} "${w?.vocabulary || w?.word || w?.text}" ${t("interactivePlay.vocabMeaningSuffix")}`;
      expected = w?.definition?.th || w?.translation || "";
    } else if (currentPhase === LESSON_PHASE.SENTENCE_PRACTICE) {
      const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.SENTENCE_PRACTICE] || 0;
      const s = articleData?.sentences?.[idx];
      const targetStr = typeof s === 'object' ? s.sentences : s;
      const words = String(targetStr).split(' ');
      questionText = words.slice(0, words.length - 1).join(' ') + ' _____';
      expected = words[words.length - 1].replace(/[.,!?]/g, '');
    } else if (currentPhase === LESSON_PHASE.SENTENCE_ORDER) {
      const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.SENTENCE_ORDER] || 0;
      const s = articleData?.sentences?.[idx];
      const targetStr = typeof s === 'object' ? s.sentences : s;
      questionText = `${t("interactivePlay.orderSentencePrefix")} ${idx + 1}`;
      expected = String(targetStr);
    }
    submitAnswer(answer, questionText, expected);
  };

  const handleTextSubmit = () => {
    if (phaseReadOnly) return;
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
    if (phaseReadOnly) return;
    playSound('select');
    setMyFlags(prev => {
      const next = new Set(prev);
      if (next.has(sentenceIndex)) next.delete(sentenceIndex);
      else next.add(sentenceIndex);
      return next;
    });
    flagSentence(sentenceIndex);
  };

  // Guided Writing — submit draft for AI feedback
  const handleWritingSubmit = () => {
    if (phaseReadOnly || !writingDraft.trim() || hasAnswered || isSubmitting) return;
    playSound('submit');
    setIsSubmitting(true);
    setSelectedChoice(writingDraft);
    const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.GUIDED_WRITING] || 0;
    const prompt = articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.writingTitle");
    submitAnswer(writingDraft, prompt, '');
  };

  // Language Questions — submit question for teacher-mediated AI answer
  const handleLanguageSubmit = () => {
    if (phaseReadOnly || !languageQuestion.trim() || hasAnswered || isSubmitting) return;
    playSound('submit');
    setIsSubmitting(true);
    submitAnswer(languageQuestion, 'Language question', '');
  };

  // Skip when the student has no question (counts as answered, no AI)
  const handleLanguageSkip = () => {
    if (phaseReadOnly || hasAnswered || isSubmitting) return;
    playSound('select');
    setLanguageSkipped(true);
    setIsSubmitting(true);
    submitAnswer('', 'Language question', '');
  };

  // Reflection — submit understanding + effort ratings (and tutor star review if given)
  const handleReflectionSubmit = async () => {
    if (phaseReadOnly || !understanding || !effort || hasAnswered || isSubmitting) return;
    playSound('submit');
    setIsSubmitting(true);
    if (reviewRating > 0) {
      await submitTutorReview();
    }
    submitAnswer(`ความเข้าใจ: ${understanding} · ความพยายาม: ${effort}`, 'Lesson reflection', '');
  };

  const phaseMeta = getPhaseMeta(currentPhase);
  const articleTitle = articleData?.title;

  // MCQ option configs (answer colours are part of the game: A red, B blue, C yellow, D green)
  const mcqOptions = [
    { label: 'A', bg: 'bg-rose-500',    shadow: 'shadow-[0_6px_0_rgb(190,18,60)]',  activeShadow: 'active:shadow-[0_0px_0_rgb(190,18,60)]' },
    { label: 'B', bg: 'bg-sky-500',     shadow: 'shadow-[0_6px_0_rgb(3,105,161)]',  activeShadow: 'active:shadow-[0_0px_0_rgb(3,105,161)]' },
    { label: 'C', bg: 'bg-amber-400',   shadow: 'shadow-[0_6px_0_rgb(161,98,7)]',   activeShadow: 'active:shadow-[0_0px_0_rgb(161,98,7)]' },
    { label: 'D', bg: 'bg-emerald-500', shadow: 'shadow-[0_6px_0_rgb(4,120,87)]',   activeShadow: 'active:shadow-[0_0px_0_rgb(4,120,87)]' },
  ];

  const renderMissedQuestionSummary = () => (
    <>
      <StatusCard
        tone="warning"
        eyebrow={t("interactivePlay.missedEyebrow")}
        emoji="⏰"
        title={t("interactivePlay.missedTitle")}
        description={t("interactivePlay.missedDescription")}
      />
      <MobileLeaderboard participants={participants} studentId={studentId} />
    </>
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
              <mark key={i} className="rounded bg-tile-amber px-0.5 font-semibold text-fg not-italic">
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        });
      }
      return (
        <div className={cn(cardClass, 'p-4')}>
          <p lang="en" className="text-base leading-[1.8] whitespace-pre-line text-fg">{body}</p>
        </div>
      );
    };

    switch (currentPhase) {
      case LESSON_PHASE.LAUNCH: {
        const summary = ad?.translated_summary?.th?.[0] || (typeof ad?.summary === 'string' ? ad.summary : ad?.summary?.th?.[0]);
        if (!summary) return null;
        return (
          <div className={cn(cardClass, 'p-4')}>
            <p className="text-[15px] leading-[1.7] text-fg">{summary}</p>
          </div>
        );
      }
      case LESSON_PHASE.VOCABULARY_CONTEXT:
        return renderPassage(true);
      case LESSON_PHASE.DEEP_READING:
        return renderPassage(false);
      case LESSON_PHASE.KEY_SENTENCES: {
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
          <section className={cn(cardClass, 'p-4')}>
            <h3 className="mb-2 text-[13px] leading-[1.5] font-bold text-fg-muted">{t("interactivePlay.phaseName6")}</h3>
            <ol className="flex flex-col gap-2.5">
              {display.map((s, i) => {
                const text = typeof s === 'object' ? s.sentences : s;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-fg tabular-nums">{i + 1}</span>
                    <span lang="en" className="text-[15px] leading-[1.7] text-fg">{text}</span>
                  </li>
                );
              })}
            </ol>
          </section>
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

  const submitCurrentGameResult = (result: { gameId: string; score: number; correct?: number; total?: number; durationMs?: number }) => {
    if (phaseReadOnly || !gameState) return;
    const key = `${gameState.phase}:${gameState.selectedGameId || result.gameId}`;
    if (submittedGameKeyRef.current === key) return;

    submittedGameKeyRef.current = key;
    setPendingGameResult({ key, score: result.score });
    submitGameResult(result);
  };

  const handleQuickGameComplete = () => {
    if (phaseReadOnly) return;
    const questions = buildGameQuestions();
    const total = Math.max(questions.length, 1);
    const correct = questions.filter((question, index) => gameSelections[index] === question.answer).length;
    submitCurrentGameResult({
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
      return (
        <PhaseColumn>
          <StatusCard emoji="🎮" title={t("interactivePlay.gamePreparing")} />
        </PhaseColumn>
      );
    }
    const selected = getGameById(gameState.selectedGameId);
    const selectedTitle = selected?.title || t("interactivePlay.gameFallbackTitle");
    const myVote = gameState.votes?.[gameActorId] || gameState.votes?.[studentId];
    const myResult = gameState.results?.[gameActorId] || gameState.results?.[studentId];
    const currentResultKey = `${gameState.phase}:${gameState.selectedGameId || ""}`;
    const pendingResult = pendingGameResult?.key === currentResultKey ? pendingGameResult : null;
    const countdownLeft = gameState.countdownEndsAt ? Math.max(0, Math.ceil((gameState.countdownEndsAt - Date.now()) / 1000)) : 0;
    const categoryLabel = gameState.category === "vocabulary" ? t("interactivePlay.gameCategoryVocab") : t("interactivePlay.gameCategorySentence");

    if (myResult || pendingResult) {
      const displayedScore = myResult?.score ?? pendingResult?.score ?? 0;
      return (
        <PhaseColumn>
          <section role="status" className="rounded-[var(--radius-card)] border border-success-border bg-success-bg px-5 py-6 text-center">
            <p className="text-[13px] leading-[1.5] font-bold text-success-fg">{t("interactivePlay.gameComplete")}</p>
            <p className="mt-1 text-[56px] leading-[1.15] font-black text-success-fg tabular-nums">{displayedScore}</p>
            <p className="text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.score")}</p>
            <p className="mt-3 text-[15px] leading-[1.5] font-semibold text-fg">{t("interactivePlay.gameWaitTeacher")}</p>
          </section>
          <MobileLeaderboard participants={participants} studentId={studentId} />
        </PhaseColumn>
      );
    }

    // A result phase normally means every participant has submitted. Keep a
    // late/reconnected student in a waiting state instead of rendering the
    // legacy quick-game fallback with no way to submit the selected game.
    if (gameState.status === "results") {
      return (
        <PhaseColumn>
          <StatusCard tone="warning" emoji="🎮" eyebrow={t("interactivePlay.gameComplete")} title={t("interactivePlay.gameWaitTeacher")} />
          <MobileLeaderboard participants={participants} studentId={studentId} />
        </PhaseColumn>
      );
    }

    if (gameState.status === "voting") {
      const deck = getVotingDeck(gameState.category);
      return (
        <PhaseColumn>
          <div className="text-center">
            <p className="text-[13px] leading-[1.5] font-bold text-brand-fg">{gameState.category === "vocabulary" ? t("interactivePlay.vocabularyGame") : t("interactivePlay.sentenceGame")}</p>
            <h2 className="mt-0.5 text-[22px] leading-[1.4] font-extrabold text-fg">{t("interactivePlay.gameVoteTitle")}</h2>
          </div>
          <HScroll snap gap={16} className="pt-1 pb-3" aria-label={t("interactivePlay.gameVoteTitle")}>
            {deck.games.map((game) => {
              const isMine = myVote === game.id;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => submitGameVote(game.id)}
                  aria-pressed={isMine}
                  className={cn(
                    "pressable relative flex h-[400px] w-[272px] shrink-0 flex-col overflow-hidden rounded-[28px] border-2 text-left shadow-[var(--shadow-card)]",
                    isMine ? "border-brand-vivid" : "border-transparent",
                  )}
                >
                  <Image src={game.cover} alt="" fill sizes="272px" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/0" />
                  <div className="relative z-10 mt-auto p-5 text-white">
                    {/* Chips sit on the bottom scrim, not over the cover art's logo at the top. */}
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-xs leading-[1.5] font-semibold text-white ring-1 ring-white/25">
                        {categoryLabel}
                      </span>
                      {isMine ? (
                        <span className="rounded-full bg-brand-solid px-2.5 py-0.5 text-xs leading-[1.5] font-bold text-white">
                          {t("interactivePlay.selected")}
                        </span>
                      ) : null}
                    </div>
                    <h3 lang="en" className="text-[22px] leading-[1.3] font-extrabold text-white">{game.title}</h3>
                    <p className="mt-1.5 line-clamp-3 text-sm leading-[1.6] text-white/85">{game.description}</p>
                    <span
                      className={cn(
                        "mt-4 flex h-12 items-center justify-center rounded-2xl text-[15px] font-bold",
                        isMine ? "bg-brand-solid text-white" : "bg-white text-slate-950",
                      )}
                    >
                      {isMine ? t("interactivePlay.voteDone") : t("interactivePlay.chooseThisGame")}
                    </span>
                  </div>
                </button>
              );
            })}
            {deck.hasMore ? (
              <div className="flex h-[400px] w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-hairline bg-surface px-5 text-center">
                <span aria-hidden="true" className="text-[40px] leading-[1.2]">🎁</span>
                <p className="text-[15px] leading-[1.5] font-bold text-fg">{t("interactivePlay.moreGamesSoonTitle")}</p>
                <p className="text-[13px] leading-[1.6] text-fg-muted">{t("interactivePlay.moreGamesSoonDescription")}</p>
              </div>
            ) : null}
          </HScroll>
          <div role="status" className={cn(cardClass, 'p-4 text-center')}>
            <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("interactivePlay.yourVote")}</p>
            <p className="mt-0.5 text-[15px] leading-[1.5] font-bold text-fg">
              {myVote ? getGameById(myVote)?.title || myVote : t("interactivePlay.noGameSelected")}
            </p>
          </div>
        </PhaseColumn>
      );
    }

    if (gameState.status === "ready") {
      return (
        <PhaseColumn>
          <div className={cn(cardClass, 'overflow-hidden')}>
            {selected?.cover && (
              <div className="relative h-52 w-full">
                <Image src={selected.cover} alt="" fill sizes="448px" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-x-5 bottom-4 text-white">
                  <p className="text-[13px] leading-[1.5] font-semibold text-white/85">{t("interactivePlay.gameReadyEyebrow")}</p>
                  <h2 lang="en" className="text-[26px] leading-[1.3] font-extrabold">{selected.title}</h2>
                </div>
              </div>
            )}
            <div className="p-6 text-center">
              <p aria-hidden="true" className="text-[32px] leading-[1.2]">🎮</p>
              <h3 className="mt-2 text-[19px] leading-[1.45] font-bold text-fg">{t("interactivePlay.gameReadyTitle")}</h3>
              <p className="mt-1 text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.gameReadyDescription")}</p>
            </div>
          </div>
        </PhaseColumn>
      );
    }

    if (gameState.status === "teacher_demo") {
      return (
        <div className="phase-enter fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-center text-white">
          {selected?.cover && <Image src={selected.cover} alt="" fill sizes="100vw" className="absolute inset-0 size-full object-cover opacity-25" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-slate-950/80 to-slate-950/60" />
          <div className="relative z-10 w-full max-w-sm">
            <div aria-hidden="true" className="mx-auto flex size-20 items-center justify-center rounded-[28px] border border-white/20 bg-white/10 text-4xl">👀</div>
            <p className="mt-6 text-sm leading-[1.5] font-bold text-amber-300">{t("interactivePlay.teacherDemoEyebrow")}</p>
            <h2 className="mt-1 text-[28px] leading-[1.3] font-extrabold">{t("interactivePlay.teacherDemoTitle")}</h2>
            <p className="mt-3 text-base leading-[1.6] font-semibold text-white/80">{t("interactivePlay.teacherDemoDescription")} {selected?.title || t("interactivePlay.thisGame")}</p>
            <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-5 text-left">
              <p className="text-[15px] leading-[1.5] font-bold text-white">{t("interactivePlay.teacherDemoWatchTitle")}</p>
              <p className="mt-2 text-sm leading-[1.6] text-white/80">{t("interactivePlay.teacherDemoWatchList")}</p>
            </div>
          </div>
        </div>
      );
    }

    if (gameState.status === "tutorial") {
      const tutorialSteps = getGameTutorial(gameState.selectedGameId, gameState.category);
      return (
        <div className="phase-enter fixed inset-0 z-50 h-dvh w-screen overflow-y-auto overscroll-contain bg-slate-950 p-5 text-white">
          {selected?.cover && <Image src={selected.cover} alt="" fill sizes="100vw" className="fixed inset-0 size-full object-cover opacity-20" />}
          <div className="fixed inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/95 to-black" />
          <div className="relative z-10 mx-auto flex min-h-full w-full max-w-sm flex-col justify-center pt-[var(--safe-top)] pb-[calc(24px+var(--safe-bottom))]">
            <h2 className="text-[28px] leading-[1.3] font-extrabold">{t("interactivePlay.tutorialEyebrow")} {selectedTitle}</h2>
            <p className="mt-2 text-sm leading-[1.6] text-white/75">{t("interactivePlay.tutorialHint")}</p>
            <ol className="mt-7 grid gap-3">
              {tutorialSteps.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-3xl border border-white/15 bg-white/10 p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-300 text-lg font-black text-emerald-950">{index + 1}</span>
                  <p className="self-center text-[15px] leading-[1.6] font-semibold text-white">{step}</p>
                </li>
              ))}
            </ol>
            <p role="status" className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-amber-400/15 px-4 py-3 text-[15px] leading-[1.5] font-bold text-amber-200">
              <span aria-hidden="true" className="size-2 rounded-full bg-amber-300" />
              {t("interactivePlay.tutorialWaiting")}
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
              alt=""
              fill
              sizes="100vw"
              className="absolute inset-0 size-full object-cover opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-slate-950/70 to-slate-950/50" />
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
            <p className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm leading-[1.5] font-bold text-white/85">
              {t("interactivePlay.getReady")}
            </p>
            <p aria-live="assertive" className="mt-8 text-[clamp(6rem,34vw,12rem)] leading-none font-black text-white tabular-nums">
              {countdownLeft}
            </p>
            <p lang="en" className="mt-5 text-2xl leading-[1.3] font-extrabold text-white">
              {selectedTitle}
            </p>
            <p className="mt-2 text-sm leading-[1.5] font-semibold text-white/75">
              {t("interactivePlay.gameStartsAutomatically")}
            </p>
          </div>
        </div>
      );
    }

    if (gameState.status === "playing") {
      return (
        // data-motion="full": game sprites/feedback animations must keep running
        // even when the device asks for reduced motion (global CSS rule).
        <div data-motion="full" className="phase-enter fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-background">
          <AdvantageArcadeRuntime
            key={`${gameState.phase}-${gameState.selectedGameId}`}
            gameId={gameState.selectedGameId || ""}
            category={gameState.category}
            articleData={articleData}
            restartOnComplete={false}
            onComplete={(result) => {
              if (phaseReadOnly) return;
              submitCurrentGameResult({
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

    // Legacy quick-game fallback (only for an unknown game status).
    const questions = buildGameQuestions();
    const answeredCount = questions.filter((_question, index) => gameSelections[index]).length;
    const liveCorrect = questions.filter((question, index) => gameSelections[index] === question.answer).length;
    const activeIndex = Math.min(answeredCount, Math.max(questions.length - 1, 0));
    const activeQuestion = questions[activeIndex];
    const theme = getArcadeTheme(gameState.selectedGameId, gameState.category);
    const progressPct = questions.length ? (answeredCount / questions.length) * 100 : 0;
    return (
      <PhaseColumn>
        <div className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${theme.arena} p-5 text-white shadow-[var(--shadow-card)]`}>
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs leading-[1.5] font-semibold text-white/80">{selected?.title || t("interactivePlay.lessonGame")}</p>
              <h2 className="mt-1 text-xl leading-[1.35] font-extrabold text-white">{theme.action}</h2>
            </div>
            <div className="rounded-2xl bg-black/25 px-3 py-2 text-right">
              <p className="text-xs leading-[1.5] text-white/80">{t("interactivePlay.score")}</p>
              <p className="text-2xl font-black tabular-nums">{liveCorrect * 2}</p>
            </div>
          </div>
          <div className="relative z-10 mt-5 flex items-center gap-4">
            <div className="relative flex size-20 shrink-0 items-center justify-center rounded-3xl border border-white/25 bg-white/20">
              <span className="text-2xl font-black tracking-tight text-white">{theme.avatar}</span>
            </div>
            <div className={`min-w-0 flex-1 rounded-3xl border p-4 ${theme.panel}`}>
              <p className="text-xs leading-[1.5] text-white/80">{t("interactivePlay.quickGameQuestionPrefix")} {activeIndex + 1} / {Math.max(questions.length, 1)}</p>
              <p className="mt-1 text-base leading-snug font-black break-words text-white">{activeQuestion?.prompt || t("interactivePlay.ready")}</p>
            </div>
          </div>
          <div className="relative z-10 mt-5">
            <div className="h-3 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-2 text-right text-xs leading-[1.5] text-white/80 tabular-nums">{answeredCount}/{questions.length}</p>
          </div>
        </div>
        <div className={cn(cardClass, 'p-5')}>
          <h2 className="text-[17px] leading-[1.45] font-bold text-fg">{t("interactivePlay.quickGameTitle")}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {questions.map((question, index) => (
            <div key={`${question.prompt}-${index}`} className={cn(cardClass, 'p-4')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("interactivePlay.quickGameQuestionPrefix")} {index + 1}</p>
                {gameSelections[index] && (
                  <span aria-hidden="true" className="text-base">{gameSelections[index] === question.answer ? "✅" : "❌"}</span>
                )}
              </div>
              <p className="mt-1 text-[15px] leading-[1.5] font-bold text-fg">{question.prompt}</p>
              <div className="mt-3 grid gap-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      if (!phaseReadOnly) {
                        setGameSelections((prev) => ({ ...prev, [index]: option }));
                      }
                    }}
                    disabled={phaseReadOnly}
                    aria-pressed={gameSelections[index] === option}
                    className={`btn-3d min-h-11 rounded-xl px-3 py-3 text-left text-sm font-bold text-white transition-all ${theme.target} ${theme.shadow} ${
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
        <Button
          variant="brand"
          size="cta"
          className="w-full"
          onClick={handleQuickGameComplete}
          disabled={phaseReadOnly || questions.some((_question, index) => !gameSelections[index])}
        >
          {t("interactivePlay.quickGameSubmit")}
        </Button>
      </PhaseColumn>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Screen>
      <LessonTopBar
        phase={currentPhase}
        articleTitle={articleTitle}
        reconnecting={connection === "reconnecting"}
        readOnly={phaseReadOnly}
        onExit={() => router.replace('/dashboard')}
      />

      <div className="flex flex-1 flex-col items-center px-4 pt-4 pb-[calc(24px+var(--safe-bottom))]">

        {/* ─── Look-at-screen phases ─── */}
        {isLookAtScreenPhase(currentPhase) && (
          <PhaseColumn>
            <PhaseIntroCard phase={currentPhase} />
            <LookAtScreenRow label={phaseMeta.label} tone={phaseMeta.tone} />
            {renderLessonContentMobile()}
          </PhaseColumn>
        )}

        {GAME_PHASES.includes(currentPhase) && renderGamePhaseMobile()}

        {/* ─── Phase 2: Vocabulary Flashcards ─── */}
        {currentPhase === LESSON_PHASE.FLASHCARDS && (
          <VocabularyFlashcardPhase
            key={`flashcards-${sessionData?.sessionId || 'preview'}`}
            words={articleData?.words}
            hasAnswered={hasAnswered}
            disabled={phaseReadOnly || hasAnswered || isSubmitting}
            onComplete={(summary) => {
              if (phaseReadOnly || hasAnswered || isSubmitting) return;
              setIsSubmitting(true);
              submitAnswer(summary, 'Vocabulary flashcards', 'FLASHCARD_COMPLETE');
            }}
          />
        )}

        {/* ─── Phase 3: Read the Article + Sentence Flag ─── */}
        {currentPhase === LESSON_PHASE.READ_ARTICLE && (
          <PhaseColumn>
            <PhaseIntroCard
              phase={LESSON_PHASE.READ_ARTICLE}
              emoji="🎧"
              title={t("interactivePlay.readArticleTitle")}
              tip={t("interactivePlay.readArticleHint")}
            />
            <LookAtScreenRow label={phaseMeta.label} tone={phaseMeta.tone} />
            <div className={cn(cardClass, 'flex min-h-[120px] flex-col items-center justify-center p-3')}>
              {(() => {
                const activeIdx = sessionData?.activeSentenceIndex ?? -1;
                if (activeIdx < 0) {
                   return <WaitingNextLine>{t("interactivePlay.waitingArticleAudio")}</WaitingNextLine>;
                }
                const s = articleData?.sentences?.[activeIdx];
                if (!s) return null;
                const text = typeof s === 'object' ? s.sentences : s;
                const isFlagged = myFlags.has(activeIdx);
                const count = flagCounts?.[activeIdx] || 0;
                return (
                  <button
                    onClick={() => handleFlagToggle(activeIdx)}
                    disabled={phaseReadOnly}
                    aria-disabled={phaseReadOnly}
                    aria-pressed={isFlagged}
                    className={cn(
                      'pressable flex w-full items-start gap-3 rounded-2xl border px-4 py-5 text-left',
                      isFlagged ? 'border-danger-border bg-danger-bg' : 'border-info-border bg-info-bg',
                    )}
                  >
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-2xl">{isFlagged ? '🚩' : '🔖'}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span lang="en" className={cn('text-lg leading-[1.6]', isFlagged ? 'font-bold text-danger-fg' : 'font-semibold text-fg')}>
                        {text}
                      </span>
                      {count > 0 && (
                        <span className="text-[13px] leading-[1.5] font-semibold text-danger-fg">🚩 {count} {t("interactivePlay.flagCountSuffix")}</span>
                      )}
                    </span>
                  </button>
                );
              })()}
            </div>
          </PhaseColumn>
        )}

        {/* ─── Phase 13: Guided Writing ─── */}
        {currentPhase === LESSON_PHASE.GUIDED_WRITING && (() => {
          const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.GUIDED_WRITING] || 0;
          const prompt = articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.writingTitle");
          const frames = ['I think that…', 'One reason is…', 'For example,…', 'In conclusion,…'];
          return (
            <PhaseColumn>
              {missedQuestion ? (
                renderMissedQuestionSummary()
              ) : aiFeedback ? (
                <PhaseCard icon={Bot} tone="blue" title={t("interactivePlay.aiEvaluation")}>
                  <AiScore score={aiFeedback.score} />
                  <AiFeedbackText>{aiFeedback.feedback}</AiFeedbackText>
                  <WaitingNextLine />
                </PhaseCard>
              ) : (hasAnswered || isSubmitting) ? (
                <AiPendingCard />
              ) : (
                <PhaseCard icon={PenLine} tone="blue" title={t("interactivePlay.writingTitle")}>
                  <p className="text-[15px] leading-[1.6] font-bold text-fg">{prompt}</p>
                  <div className="rounded-2xl border border-info-border bg-info-bg p-3">
                    <p className="text-[13px] leading-[1.5] font-bold text-info-fg">{t("interactivePlay.framesTitle")}</p>
                    <p className="mt-0.5 text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.framesHint")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {frames.map((f) => (
                        <button
                          type="button"
                          key={f}
                          lang="en"
                          onClick={() => setWritingDraft((prev) => (prev ? prev.replace(/\s*$/, ' ') : '') + f.replace('…', '') + ' ')}
                          className="pressable min-h-11 rounded-full border border-info-border bg-surface px-4 text-sm leading-[1.5] font-medium text-fg active:bg-press"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextArea
                    label={t("interactivePlay.writingPlanLabel")}
                    value={writingPlan}
                    onChange={(e) => setWritingPlan(e.target.value)}
                    placeholder={t("interactivePlay.writingPlanPlaceholder")}
                    textareaClassName="min-h-[88px]"
                  />
                  <TextArea
                    label={t("interactivePlay.writingDraftLabel")}
                    value={writingDraft}
                    onChange={(e) => setWritingDraft(e.target.value)}
                    placeholder={t("interactivePlay.writingDraftPlaceholder")}
                    textareaClassName="min-h-[140px]"
                  />
                  <Button variant="brand" size="cta" className="w-full" onClick={handleWritingSubmit} disabled={!writingDraft.trim()}>
                    {t("interactivePlay.writingSubmit")}
                  </Button>
                </PhaseCard>
              )}
              <MobileLeaderboard participants={participants} studentId={studentId} />
            </PhaseColumn>
          );
        })()}

        {/* ─── Phase 15: Language Questions ─── */}
        {currentPhase === LESSON_PHASE.LANGUAGE_QUESTIONS && (
          <PhaseColumn>
            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : languageSkipped ? (
              <StatusCard emoji="👌" title={t("interactivePlay.languageSkipped")} description={t("interactivePlay.waitingFriends")} />
            ) : languageAnswer ? (
              <PhaseCard icon={Bot} tone="purple" title={t("interactivePlay.languageAiTitle")}>
                <div className="rounded-2xl bg-fill-muted p-3">
                  <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("interactivePlay.yourQuestion")}</p>
                  <p className="mt-0.5 text-[15px] leading-[1.6] font-semibold text-fg">{languageAnswer.question}</p>
                </div>
                <AiFeedbackText>{languageAnswer.answer}</AiFeedbackText>
                <WaitingNextLine />
              </PhaseCard>
            ) : (hasAnswered || isSubmitting) ? (
              <AiPendingCard />
            ) : (
              <PhaseCard icon={MessageCircleQuestion} tone="purple" title={t("interactivePlay.languageTitle")}>
                <TextArea
                  label={t("interactivePlay.languagePrompt")}
                  value={languageQuestion}
                  onChange={(e) => setLanguageQuestion(e.target.value)}
                  placeholder={t("interactivePlay.languagePlaceholder")}
                />
                <div className="flex flex-col gap-2">
                  <Button variant="brand" size="cta" className="w-full" onClick={handleLanguageSubmit} disabled={!languageQuestion.trim()}>
                    {t("interactivePlay.languageSubmit")}
                  </Button>
                  <Button variant="ghost" size="touch" className="w-full text-fg-muted" onClick={handleLanguageSkip}>
                    {t("interactivePlay.languageSkip")}
                  </Button>
                </div>
              </PhaseCard>
            )}
            <MobileLeaderboard participants={participants} studentId={studentId} />
          </PhaseColumn>
        )}

        {/* ─── Phase 16: Lesson Reflection ─── */}
        {currentPhase === LESSON_PHASE.REFLECTION && (
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

        {currentPhase === LESSON_PHASE.PAIR_CONVERSATION && (
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
            classBookCycleId={sessionData?.classBookCycleId}
            articleId={articleData?.id}
          />
        )}

        {/* ─── MCQ-style Phases: Comprehension(7), Vocab(9), Sentence fill(11), Sentence order(12) ─── */}
        {MCQ_PHASES.includes(currentPhase) && (
          <PhaseColumn className="flex-1">
            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : hasAnswered ? (
              /* After answering: show result + leaderboard */
              <>
                {selectedChoice && <AnswerEcho big>{selectedChoice}</AnswerEcho>}
                {showEveryoneReady ? (
                  <StatusCard tone="success" emoji="🎉" title={t("interactivePlay.everyoneAnswered")} description={t("interactivePlay.watchTeacherAnswer")} />
                ) : (
                  <StatusCard emoji="✅" title={t("interactivePlay.answerSubmitted")} description={t("interactivePlay.waitingFriends")} />
                )}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </>
            ) : (
              /* Before answering: show question + MCQ buttons */
              <>
                {/* Question card */}
                <section className={cn(cardClass, 'px-4 py-4 text-center')}>
                  <Chip tone="brand" size="sm">{t("interactivePlay.questionLabel")}</Chip>
                  <p className="mt-2 text-[17px] leading-[1.6] font-bold text-fg">
                    {(() => {
                      if (currentPhase === LESSON_PHASE.COMPREHENSION) {
                        const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.COMPREHENSION] || 0;
                        return articleData?.multipleChoiceQuestions?.[idx]?.question || t("interactivePlay.defaultQuestion");
                      } else if (currentPhase === LESSON_PHASE.VOCABULARY_PRACTICE) {
                        const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.VOCABULARY_PRACTICE] || 0;
                        const w = articleData?.words?.[idx];
                        return `${t("interactivePlay.vocabMeaningPrefix")} "${w?.vocabulary || w?.word || w?.text}" ${t("interactivePlay.vocabMeaningSuffix")}`;
                      } else if (currentPhase === LESSON_PHASE.SENTENCE_PRACTICE) {
                        const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.SENTENCE_PRACTICE] || 0;
                        const s = articleData?.sentences?.[idx];
                        const targetStr = typeof s === 'object' ? s.sentences : s;
                        const words = String(targetStr).split(' ');
                        return `${t("interactivePlay.fillBlankPrefix")} ${words.slice(0, words.length - 1).join(' ')} _____`;
                      } else if (currentPhase === LESSON_PHASE.SENTENCE_ORDER) {
                        const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.SENTENCE_ORDER] || 0;
                        return `${t("interactivePlay.orderSentencePrefix")} ${idx + 1}`;
                      }
                      return t("interactivePlay.defaultQuestion");
                    })()}
                  </p>
                </section>

                {/* 2×2 MCQ grid */}
                <div className="grid flex-1 grid-cols-2 gap-3">
                  {mcqOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleMcqClick(opt.label)}
                      className={`btn-3d ${opt.bg} ${opt.shadow} ${opt.activeShadow} active:translate-y-1.5 rounded-2xl flex flex-col items-center justify-center text-white font-black min-h-[100px] gap-1 transition-transform select-none`}
                    >
                      <span className="text-5xl leading-none">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </PhaseColumn>
        )}

        {/* ─── Phase 8: Guided Response / Short Answer ─── */}
        {currentPhase === LESSON_PHASE.GUIDED_RESPONSE && (
          <PhaseColumn>
            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : aiFeedback ? (
              /* AI Feedback result */
              <PhaseCard icon={Bot} tone="purple" title={t("interactivePlay.aiEvaluation")}>
                <AiScore score={aiFeedback.score} ring />
                <p aria-hidden="true" className="text-center text-xl">{getScoreStars(aiFeedback.score) || '—'}</p>
                <AiFeedbackText score={aiFeedback.score}>{aiFeedback.feedback}</AiFeedbackText>
                <WaitingNextLine />
              </PhaseCard>
            ) : (hasAnswered || isSubmitting) ? (
              /* Submitted — waiting for AI */
              <>
                {selectedChoice && <AnswerEcho>{selectedChoice}</AnswerEcho>}
                {showEveryoneReady ? (
                  <StatusCard tone="success" emoji="🎉" title={t("interactivePlay.submittedDone")} description={t("interactivePlay.waitingAiScore")} />
                ) : (
                  <AiPendingCard />
                )}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </>
            ) : (
              /* Input form */
              <PhaseCard icon={PenLine} tone="purple" title={phaseMeta.label}>
                <p className="text-[15px] leading-[1.6] font-bold text-fg">
                  {(() => {
                    const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
                    return articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.textAnswerFallback");
                  })()}
                </p>
                <div>
                  <TextArea
                    aria-label={t("interactivePlay.textAnswerFallback")}
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    placeholder={t("interactivePlay.textAnswerPlaceholder")}
                    textareaClassName="max-h-[35dvh]"
                  />
                  {/* Progress bars */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs leading-[1.5] text-fg-muted tabular-nums">{typedAnswer.length} {t("interactivePlay.characterUnit")}</span>
                    <div aria-hidden="true" className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${typedAnswer.length > i * 40 ? 'bg-brand-vivid' : 'bg-fill-muted'}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <Button variant="brand" size="cta" className="w-full" onClick={handleTextSubmit} disabled={!typedAnswer.trim()}>
                  {t("interactivePlay.submitAnswer")}
                </Button>
              </PhaseCard>
            )}
          </PhaseColumn>
        )}

      </div>
      {devPairButton}
    </Screen>
  );
}

export default function PlayLessonPage() {
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <PlayLessonContent />
    </Suspense>
  );
}
