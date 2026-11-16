"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bookmark, Bot, CheckCircle2, Clock, DoorOpen, Flag, Gamepad2, Headphones, Hourglass, MessageCircleQuestion, PartyPopper, PenLine, Presentation, SearchX, ThumbsUp, WifiOff, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { playSound } from '@/lib/sounds';
import { studentApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { MobileLeaderboard } from '@/components/lesson/MobileLeaderboard';
import { ANSWER_OPTIONS, AnswerTile } from '@/components/lesson/AnswerTiles';
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
import type { RoundReview } from '@/lib/games/lessonGameResult';
import { RoundReviewList } from '@/components/lesson/RoundReviewList';
import { preloadGameAssets } from '@/lib/games/gameAssetPreloader';
import { VocabularyFlashcardPhase } from '@/components/lesson/VocabularyFlashcardPhase';
import { GAME_PHASES, LESSON_PHASE, TOTAL_LESSON_PHASES } from '@/lib/lessonPhases';
import { AppBar, Chip, ErrorState, ProgressBar, Screen, StatusScreen, TextArea } from '@/components/mobile';
import { ReedyMini } from '@/components/mascot/ReedyMini';
import { Button, buttonVariants } from '@/components/ui/button';
import { LessonStatusCards, LessonTopBar } from './LessonTopBar';
import { PlaySkeleton } from './PlaySkeleton';
import {
  AiFeedbackText,
  AiPendingCard,
  AiScore,
  AnswerEcho,
  lessonCardClass,
  LookAtScreenRow,
  PhaseCard,
  PhaseColumn,
  PhaseHeader,
  RankStrip,
  StatusCard,
  WaitingNextLine,
} from '@/components/lesson/PhaseBlocks';
import { rankParticipants } from '@/components/lesson/leaderboardModel';
import { useRankMoves } from '@/components/lesson/useRankMoves';
import { getVotingDeck, isLookAtScreenPhase, MCQ_PHASES } from './playModel';
import { useLessonLiff, useLessonSession } from './lessonPreview';
import { GameCountdownStage, GameReadyStage, GameTutorialStage, GameVoteStage, TeacherDemoStage } from './GameStages';

const FINAL_LEADERBOARD_PHASE = TOTAL_LESSON_PHASES;
// How long a phone still playing when the tutor ends the round gets to hand in
// its points so far. Games hold their end for up to about 1.5 s first.
const CLOSED_ROUND_HANDOVER_MS = 6_000;

const cardClass = lessonCardClass;

// ── Main Component ────────────────────────────────────────────────────────────
export function PlayLessonContent() {
  // "Try again" after a fatal connection error remounts the lesson, which
  // reopens the socket (fresh token + join) exactly like a first visit.
  const [attempt, setAttempt] = useState(0);
  return <PlayLesson key={attempt} onReconnect={() => setAttempt((value) => value + 1)} />;
}

function PlayLesson({ onReconnect }: { onReconnect: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const { profile, isReady: liffReady, error: liffError, errorCode: liffErrorCode, retry: retryLiff } = useLessonLiff();

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
    removedByTutor,
    roomInterrupted,
    tutorAway,
    connectionLost,
    clockOffsetMs,
    flagCounts,
    flagSentence,
    submitGameVote,
    submitGameResult,
    phaseReadOnly,
  } = useLessonSession(classId || undefined, studentId, name, profile?.pictureUrl);
  // Presentation only: "↑ 2" on the leaderboard, from the previous ranking this phone showed.
  const rankedParticipants = useRankMoves(participants);

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
  const [pendingGameResult, setPendingGameResult] = useState<{ key: string; score: number; correct?: number; total?: number; review?: RoundReview } | null>(null);
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
  // The tutor can end a round while this phone is still playing it. The game
  // stays on screen to end its own round and hand in the points so far; this
  // key marks a round that had nothing to hand in or ran out of time to do it.
  const [closedRoundDoneKey, setClosedRoundDoneKey] = useState<string | null>(null);
  const closingRoundKey = gameState?.status === "results" && gameStartedAt ? gamePhaseKey : null;

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
    if (!closingRoundKey) return;
    const timer = window.setTimeout(() => setClosedRoundDoneKey(closingRoundKey), CLOSED_ROUND_HANDOVER_MS);
    return () => window.clearTimeout(timer);
  }, [closingRoundKey]);

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
    // Only a lesson the tutor finished is really over.
    const canRejoin = removedByTutor || roomInterrupted;
    return (
      <Screen>
        <AppBar title={t("interactivePlay.topBarTitle")} back fallbackHref="/dashboard" />
        <StatusScreen
          icon={DoorOpen}
          tone="neutral"
          title={removedByTutor ? t("interactivePlay.removedTitle") : kicked}
          description={
            removedByTutor
              ? t("interactivePlay.removedDescription")
              : roomInterrupted
                ? t("interactivePlay.roomInterruptedDescription")
                : t("interactivePlay.lessonEnded")
          }
          primaryAction={
            canRejoin ? (
              <Button variant="brand" size="cta" className="w-full" onClick={onReconnect}>
                {t("interactivePlay.rejoin")}
              </Button>
            ) : homeLink
          }
          secondaryAction={
            canRejoin ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "cta" }), "w-full text-fg-muted")}>
                {t("interactivePlay.backHome")}
              </Link>
            ) : undefined
          }
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
      data-dev-pair-toggle=""
      onClick={() => setDevPairPreview((v) => ((v + 1) % 3) as 0 | 1 | 2)}
      className={`fixed bottom-4 left-4 z-50 min-h-11 rounded-xl border-[1.5px] px-3 text-xs leading-[1.5] font-semibold shadow-[var(--shadow-popover)] transition-colors ${
        devPairPreview
          ? 'border-warning-border bg-warning-solid text-on-warning'
          : 'border-clay-rim bg-surface text-fg-muted'
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
  const myRanking = rankParticipants(participants, studentId);

  // MCQ answer tiles (components.md §6.1): the shared --answer-* tokens, the same
  // definition as the tutor presenter's OPTION_STYLES — A berry, B ocean, C sunshine,
  // D deep violet, each with a shape (triangle, diamond, circle, square) and its
  // letter. Tile colour never signals right or wrong.
  const mcqOptions = ANSWER_OPTIONS;

  const renderMissedQuestionSummary = () => (
    <>
      <StatusCard
        tone="warning"
        eyebrow={t("interactivePlay.missedEyebrow")}
        icon={Clock}
        title={t("interactivePlay.missedTitle")}
        description={t("interactivePlay.missedDescription")}
        mascot="calm"
      />
      <MobileLeaderboard participants={rankedParticipants} studentId={studentId} show="focus" />
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
              <mark key={i} className="rounded-md bg-highlight-bg px-0.5 font-semibold text-highlight-text not-italic">
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        });
      }
      return (
        <div className={cn(cardClass, 'px-[18px] py-4')}>
          <p lang="en" className="text-[17px] leading-[1.7] whitespace-pre-line text-fg">{body}</p>
        </div>
      );
    };

    switch (currentPhase) {
      case LESSON_PHASE.LAUNCH: {
        const summary = ad?.translated_summary?.th?.[0] || (typeof ad?.summary === 'string' ? ad.summary : ad?.summary?.th?.[0]);
        if (!summary) return null;
        return (
          <div className={cn(cardClass, 'px-[18px] py-4')}>
            <p className="text-base leading-[1.7] text-fg">{summary}</p>
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
          <section className={cn(cardClass, 'px-[18px] pt-3.5 pb-4')}>
            <h3 className="mb-2.5 font-heading text-base leading-[1.45] font-semibold text-fg">{t("interactivePlay.phaseName6")}</h3>
            <ol className="flex flex-col gap-2">
              {display.map((s, i) => {
                const text = typeof s === 'object' ? s.sentences : s;
                return (
                  <li key={i} className="flex items-start gap-3 rounded-lg bg-surface-muted px-3.5 py-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] leading-none font-semibold text-brand-soft-fg tabular-nums">{i + 1}</span>
                    <span lang="en" className="text-base leading-[1.7] text-fg">{text}</span>
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

  const submitCurrentGameResult = (result: { gameId: string; score: number; correct?: number; total?: number; durationMs?: number }, review?: RoundReview) => {
    if (phaseReadOnly || !gameState) return;
    const key = `${gameState.phase}:${gameState.selectedGameId || result.gameId}`;
    if (submittedGameKeyRef.current === key) return;

    submittedGameKeyRef.current = key;
    setPendingGameResult({ key, score: result.score, correct: result.correct, total: result.total, review });
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
        return { avatar: "DR", action: t("interactivePlay.chooseCorrectAnswer") };
    }
    if (gameId?.includes("castle") || gameId?.includes("tower")) {
        return { avatar: "CT", action: t("interactivePlay.chooseCorrectAnswer") };
    }
    if (gameId?.includes("potion") || gameId?.includes("alchemist")) {
        return { avatar: "PX", action: t("interactivePlay.brewCorrectAnswer") };
    }
    if (gameId?.includes("rune") || gameId?.includes("spell")) {
        return { avatar: "RN", action: t("interactivePlay.activateCorrectRune") };
    }
    if (gameId?.includes("shadow") || gameId?.includes("dungeon") || gameId?.includes("abyssal")) {
        return { avatar: "DG", action: t("interactivePlay.escapeCorrectAnswer") };
    }
    return {
      avatar: category === "vocabulary" ? "VX" : "SX",
      action: category === "vocabulary" ? t("interactivePlay.matchVocabulary") : t("interactivePlay.buildSentence"),
    };
  };

  const renderGamePhaseMobile = () => {
    if (!gameState) {
      return (
        <PhaseColumn>
          <StatusCard tone="info" icon={Gamepad2} title={t("interactivePlay.gamePreparing")} mascot="calm" />
        </PhaseColumn>
      );
    }
    const selected = getGameById(gameState.selectedGameId);
    const selectedTitle = selected?.title || t("interactivePlay.gameFallbackTitle");
    const myVote = gameState.votes?.[gameActorId] || gameState.votes?.[studentId];
    const myResult = gameState.results?.[gameActorId] || gameState.results?.[studentId];
    const currentResultKey = `${gameState.phase}:${gameState.selectedGameId || ""}`;
    const pendingResult = pendingGameResult?.key === currentResultKey ? pendingGameResult : null;
    // On the server's clock: this phone's own clock may be wrong by minutes.
    const countdownLeft = gameState.countdownEndsAt ? Math.max(0, Math.ceil((gameState.countdownEndsAt - (Date.now() + clockOffsetMs)) / 1000)) : 0;
    const categoryLabel = gameState.category === "vocabulary" ? t("interactivePlay.gameCategoryVocab") : t("interactivePlay.gameCategorySentence");

    if (myResult || pendingResult) {
      const displayedScore = myResult?.score ?? pendingResult?.score ?? 0;
      const displayedCorrect = myResult?.correct ?? pendingResult?.correct;
      const displayedTotal = myResult?.total ?? pendingResult?.total;
      const review = pendingResult?.review;
      return (
        <PhaseColumn>
          <section role="status" className="animate-pop-in rounded-[var(--radius-card)] border-[1.5px] border-success-border bg-success-bg pt-4 pr-2 pb-4 pl-[18px]">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-[1.5] font-semibold text-success-fg">{review?.heading ?? t("interactivePlay.gameComplete")}</p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[48px] leading-[1.15] font-semibold text-success-fg tabular-nums">{displayedScore}</span>
                  <span className="text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.gameScoreLabel")}</span>
                </p>
                {typeof displayedCorrect === "number" && typeof displayedTotal === "number" && (displayedCorrect > 0 || displayedTotal > 1) && (
                  <p className="mt-0.5 text-[15px] leading-[1.6] font-semibold text-fg tabular-nums">
                    {t("interactivePlay.gameCorrectPrefix")} {displayedCorrect} {t("interactivePlay.gameCorrectOf")} {displayedTotal} {t("interactivePlay.gameCorrectSuffix")}
                  </p>
                )}
              </div>
              <ReedyMini mood="cheer" size="xl" decorative />
            </div>
            <div className="pr-2.5">
              <RoundReviewList review={review} />
            </div>
          </section>
          <WaitingNextLine>{t("interactivePlay.gameWaitTeacher")}</WaitingNextLine>
          <MobileLeaderboard participants={rankedParticipants} studentId={studentId} title={t("interactivePlay.totalScoreTitle")} show="focus" />
        </PhaseColumn>
      );
    }

    // This phone was playing when the round closed for the class: keep the game
    // mounted so it ends its round and hands in what it has.
    const finishingClosedRound =
      gameState.status === "results" && gameStartedAt !== null && !phaseReadOnly && closedRoundDoneKey !== currentResultKey;

    // A result phase normally means every participant has submitted. Keep a
    // late/reconnected student in a waiting state instead of rendering the
    // legacy quick-game fallback with no way to submit the selected game.
    if (gameState.status === "results" && !finishingClosedRound) {
      return (
        <PhaseColumn>
          <StatusCard tone="warning" icon={Gamepad2} eyebrow={t("interactivePlay.gameRoundOverEyebrow")} title={t("interactivePlay.gameWaitTeacher")} mascot="calm" />
          <MobileLeaderboard participants={rankedParticipants} studentId={studentId} title={t("interactivePlay.totalScoreTitle")} show="focus" />
        </PhaseColumn>
      );
    }

    if (gameState.status === "voting") {
      const deck = getVotingDeck(gameState.category);
      return (
        <GameVoteStage
          categoryLabel={categoryLabel}
          games={deck.games}
          hasMore={deck.hasMore}
          myVote={myVote}
          myVoteTitle={myVote ? getGameById(myVote)?.title || myVote : t("interactivePlay.noGameSelected")}
          onVote={(gameId) => submitGameVote(gameId)}
        />
      );
    }

    if (gameState.status === "ready") {
      return <GameReadyStage selected={selected} />;
    }

    if (gameState.status === "teacher_demo") {
      return <TeacherDemoStage selected={selected} />;
    }

    if (gameState.status === "tutorial") {
      const tutorialSteps = getGameTutorial(gameState.selectedGameId, gameState.category);
      return <GameTutorialStage selectedTitle={selectedTitle} steps={tutorialSteps} />;
    }

    if (gameState.status === "countdown") {
      return <GameCountdownStage countdownLeft={countdownLeft} selectedTitle={selectedTitle} />;
    }

    if (gameState.status === "playing" && phaseReadOnly) {
      // Going back to a game left mid-round: it cannot be played or scored again.
      return (
        <PhaseColumn>
          <StatusCard tone="warning" icon={Gamepad2} title={t("interactivePlay.gameReviewTitle")} description={t("interactivePlay.gameReviewDescription")} mascot="calm" />
          <MobileLeaderboard participants={rankedParticipants} studentId={studentId} title={t("interactivePlay.totalScoreTitle")} show="focus" />
        </PhaseColumn>
      );
    }

    if (gameState.status === "playing" || finishingClosedRound) {
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
            roundClosed={gameState.status === "results"}
            onRoundUnplayed={() => setClosedRoundDoneKey(currentResultKey)}
            onComplete={(result) => {
              if (phaseReadOnly) return;
              submitCurrentGameResult({
                gameId: gameState.selectedGameId || "",
                score: result.score,
                correct: result.correct,
                total: result.total,
                durationMs: result.durationMs,
              }, result.review);
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
        <section className={cn(cardClass, 'px-[18px] pt-4 pb-[18px]')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] leading-[1.5] font-semibold text-brand-fg">{selected?.title || t("interactivePlay.lessonGame")}</p>
              <h2 className="mt-0.5 font-heading text-xl leading-[1.35] font-bold text-fg">{theme.action}</h2>
            </div>
            <div className="shrink-0 rounded-lg bg-surface-muted px-3 py-2 text-right">
              <p className="text-xs leading-[1.5] text-fg-muted">{t("interactivePlay.score")}</p>
              <p className="text-2xl leading-[1.2] font-semibold text-fg tabular-nums">{liveCorrect * 2}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-tile-purple font-heading text-xl font-bold text-icon-purple">
              {theme.avatar}
            </span>
            <div className="min-w-0 flex-1 rounded-lg bg-surface-muted px-3.5 py-3">
              <p className="text-xs leading-[1.5] text-fg-muted tabular-nums">{t("interactivePlay.quickGameQuestionPrefix")} {activeIndex + 1} / {Math.max(questions.length, 1)}</p>
              <p className="mt-0.5 text-base leading-[1.6] font-semibold break-words text-fg">{activeQuestion?.prompt || t("interactivePlay.ready")}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={progressPct} size="sm" label={t("interactivePlay.quickGameTitle")} />
            <p className="mt-1.5 text-right text-xs leading-[1.5] text-fg-muted tabular-nums">{answeredCount}/{questions.length}</p>
          </div>
        </section>
        <h2 className="px-1 font-heading text-[17px] leading-[1.4] font-semibold text-fg">{t("interactivePlay.quickGameTitle")}</h2>
        <div className="flex flex-col gap-2.5">
          {questions.map((question, index) => (
            <div key={`${question.prompt}-${index}`} className={cn(cardClass, 'px-4 py-3.5')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("interactivePlay.quickGameQuestionPrefix")} {index + 1}</p>
                {gameSelections[index] && (
                  <span aria-hidden="true">{gameSelections[index] === question.answer ? <CheckCircle2 className="size-5 text-success-fg" strokeWidth={2.4} /> : <XCircle className="size-5 text-fg-muted" strokeWidth={2.4} />}</span>
                )}
              </div>
              <p className="mt-0.5 text-[15px] leading-[1.6] font-semibold text-fg">{question.prompt}</p>
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
                    className={cn(
                      'clay-press min-h-11 rounded-[14px] border-2 px-3.5 py-2.5 text-left text-sm leading-[1.5] font-semibold disabled:opacity-45 disabled:shadow-none',
                      gameSelections[index] === option
                        ? 'border-brand-fg bg-brand-soft text-brand-soft-fg shadow-[0_var(--ledge-sm)_0_var(--brand-soft-border)]'
                        : 'border-field-border bg-surface text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]',
                    )}
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
          size="cta-lg"
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
        score={myRanking.myScore}
        reconnecting={connection === "reconnecting" || connectionLost}
        readOnly={phaseReadOnly}
        tutorAway={tutorAway}
        onExit={() => router.replace('/dashboard')}
      />

      {/* The game screens cover the bar above, so keep it small and out of the way. */}
      {GAME_PHASES.includes(currentPhase) && gameState && ["teacher_demo", "tutorial", "countdown", "playing"].includes(gameState.status) && (tutorAway || connectionLost) ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-[calc(4px+var(--safe-bottom))] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1.5 rounded-full border-[1.5px] border-clay-rim bg-surface-elevated px-3 py-1 text-xs leading-[1.5] font-semibold text-fg shadow-[var(--shadow-popover)]"
        >
          {connectionLost ? <WifiOff aria-hidden="true" className="size-3.5 shrink-0" /> : <Hourglass aria-hidden="true" className="size-3.5 shrink-0" />}
          <span className="whitespace-nowrap">{connectionLost ? t("interactivePlay.reconnecting") : t("interactivePlay.tutorAwayTitle")}</span>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center px-4 pt-3.5 pb-[calc(24px+var(--safe-bottom))]">
        {/* Phase row: tone tile + "ขั้นที่ 7/18" + phase name, then the 18-step journey. */}
        <PhaseHeader phase={currentPhase} className="mb-3.5 w-full max-w-[560px]" />
        {/* Full status messages under the phase row; the bar keeps a one-line sticky reminder.
            A game left mid-round shows its own read-only card, so the generic one steps aside. */}
        <LessonStatusCards
          reconnecting={connection === "reconnecting" || connectionLost}
          readOnly={phaseReadOnly && !(GAME_PHASES.includes(currentPhase) && gameState?.status === "playing")}
          tutorAway={tutorAway}
          className="mb-3.5 w-full max-w-[560px]"
        />

        {/* ─── Look-at-screen phases ─── */}
        {isLookAtScreenPhase(currentPhase) && (
          <PhaseColumn>
            <LookAtScreenRow label={phaseMeta.tip ?? phaseMeta.label} tone={phaseMeta.tone} />
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
            <LookAtScreenRow label={phaseMeta.tip ?? phaseMeta.label} tone={phaseMeta.tone} />
            <PhaseCard icon={Headphones} tone="blue" title={t("interactivePlay.readArticleTitle")}>
              <p className="-mt-1 text-[15px] leading-[1.6] text-fg-muted">{t("interactivePlay.readArticleHint")}</p>
            <div className="flex min-h-[120px] flex-col items-center justify-center">
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
                      'clay-press flex w-full items-start gap-3 rounded-[20px] px-4 py-4 text-left disabled:opacity-45 disabled:shadow-none',
                      isFlagged
                        ? 'border-2 border-brand-fg bg-brand-soft shadow-[0_var(--ledge)_0_var(--brand-soft-border)]'
                        : 'border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-tap)]',
                    )}
                  >
                    {isFlagged ? (
                      <Flag aria-hidden="true" className="mt-1 size-6 shrink-0 fill-current text-brand-fg" strokeWidth={2.2} />
                    ) : (
                      <Bookmark aria-hidden="true" className="mt-1 size-6 shrink-0 text-info-fg" strokeWidth={2.2} />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span lang="en" className={cn('text-lg leading-[1.6] font-semibold', isFlagged ? 'text-brand-soft-fg' : 'text-fg')}>
                        {text}
                      </span>
                      {count > 0 && (
                        <span className="inline-flex items-center gap-1 text-[13px] leading-[1.5] font-semibold text-fg-muted"><Flag aria-hidden="true" className="size-3.5 shrink-0 fill-current text-brand-fg" strokeWidth={2.4} /><span className="tabular-nums">{count}</span> {t("interactivePlay.flagCountSuffix")}</span>
                      )}
                    </span>
                  </button>
                );
              })()}
            </div>
            </PhaseCard>
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
                <PhaseCard icon={PenLine} tone="blue" title={t("interactivePlay.writingTaskTitle")}>
                  <p className="text-base leading-[1.6] font-semibold text-fg">{prompt}</p>
                  <div className="rounded-lg bg-surface-muted px-3.5 py-3">
                    <p className="text-sm leading-[1.5] font-semibold text-fg">{t("interactivePlay.framesTitle")}</p>
                    <p className="mt-0.5 text-[13px] leading-[1.6] text-fg-muted">{t("interactivePlay.framesHint")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {frames.map((f) => (
                        <button
                          type="button"
                          key={f}
                          lang="en"
                          onClick={() => setWritingDraft((prev) => (prev ? prev.replace(/\s*$/, ' ') : '') + f.replace('…', '') + ' ')}
                          className="clay-press min-h-11 rounded-full border-[1.5px] border-field-border bg-surface px-4 text-sm leading-[1.5] font-medium text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]"
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
              <MobileLeaderboard participants={rankedParticipants} studentId={studentId} show="focus" />
            </PhaseColumn>
          );
        })()}

        {/* ─── Phase 15: Language Questions ─── */}
        {currentPhase === LESSON_PHASE.LANGUAGE_QUESTIONS && (
          <PhaseColumn>
            {missedQuestion ? (
              renderMissedQuestionSummary()
            ) : languageSkipped ? (
              <StatusCard icon={ThumbsUp} title={t("interactivePlay.languageSkipped")} description={t("interactivePlay.waitingFriends")} mascot="happy" />
            ) : languageAnswer ? (
              <PhaseCard icon={Bot} tone="purple" title={t("interactivePlay.languageAiTitle")}>
                <div className="rounded-lg bg-surface-muted px-3.5 py-3">
                  <p className="text-xs leading-[1.5] font-medium text-fg-muted">{t("interactivePlay.yourQuestion")}</p>
                  <p className="mt-0.5 text-base leading-[1.6] font-semibold text-fg">{languageAnswer.question}</p>
                </div>
                <AiFeedbackText>{languageAnswer.answer}</AiFeedbackText>
                <WaitingNextLine />
              </PhaseCard>
            ) : (hasAnswered || isSubmitting) ? (
              <AiPendingCard />
            ) : (
              <PhaseCard icon={MessageCircleQuestion} tone="purple" title={t("interactivePlay.languageAskTitle")}>
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
            <MobileLeaderboard participants={rankedParticipants} studentId={studentId} show="focus" />
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
            participants={rankedParticipants}
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
              /* After answering: what was sent, the class ranking, then wait for the tutor */
              <>
                {showEveryoneReady ? (
                  <StatusCard tone="success" icon={PartyPopper} title={t("interactivePlay.everyoneAnswered")} description={t("interactivePlay.watchTeacherAnswer")} mascot="cheer" />
                ) : (
                  <StatusCard icon={CheckCircle2} title={t("interactivePlay.answerSubmitted")} description={t("interactivePlay.waitingFriends")} mascot="happy" />
                )}
                {selectedChoice && <AnswerEcho big>{selectedChoice}</AnswerEcho>}
                <MobileLeaderboard participants={rankedParticipants} studentId={studentId} show="focus" />
                {showEveryoneReady ? <WaitingNextLine>{t("interactivePlay.waitTeacherNext")}</WaitingNextLine> : null}
              </>
            ) : (
              /* Before answering: question card, A–D tiles (letters + shapes only), rank strip */
              <>
                <section aria-labelledby="mcq-question" className={cn(cardClass, 'px-[18px] pt-3.5 pb-4')}>
                  <Chip tone="brand" size="md" icon={MessageCircleQuestion}>{t("interactivePlay.questionLabel")}</Chip>
                  <h2
                    id="mcq-question"
                    lang={currentPhase === LESSON_PHASE.COMPREHENSION ? "en" : undefined}
                    className={cn(
                      "mt-2.5 mb-1.5 font-heading text-[23px] leading-[1.4] font-bold break-words text-fg",
                      // Balance English questions; Thai templates wrap naturally (balance splits "คำ|ว่า").
                      currentPhase === LESSON_PHASE.COMPREHENSION && "text-balance",
                    )}
                  >
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
                  </h2>
                  <p className="flex items-start gap-2 text-sm leading-[1.6] text-fg-muted">
                    <Presentation aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2.1} />
                    {t("interactivePlay.mcqHint")}
                  </p>
                </section>

                {/* 2×2 MCQ grid: letters + shapes only (the options are on the teacher's screen).
                    Sent / read-only tiles are aria-disabled: the chosen one keeps its colour + a check. */}
                <div role="group" aria-label={t("interactivePlay.chooseCorrectAnswer")} className="grid min-h-[256px] flex-1 grid-cols-2 gap-x-3 gap-y-4 pb-1.5">
                  {mcqOptions.map((opt) => (
                    <AnswerTile
                      key={opt.label}
                      letter={opt.label}
                      state={phaseReadOnly ? "dimmed" : selectedChoice ? (selectedChoice === opt.label ? "chosen" : "dimmed") : "idle"}
                      onClick={() => handleMcqClick(opt.label)}
                    />
                  ))}
                </div>
                <RankStrip rank={myRanking.myRank} score={myRanking.myScore} />
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
                <AiFeedbackText score={aiFeedback.score}>{aiFeedback.feedback}</AiFeedbackText>
                <WaitingNextLine />
              </PhaseCard>
            ) : (hasAnswered || isSubmitting) ? (
              /* Submitted — waiting for AI */
              <>
                {selectedChoice && <AnswerEcho>{selectedChoice}</AnswerEcho>}
                {showEveryoneReady ? (
                  <StatusCard tone="success" icon={PartyPopper} title={t("interactivePlay.submittedDone")} description={t("interactivePlay.waitingAiScore")} mascot="happy" />
                ) : (
                  <AiPendingCard />
                )}
                <MobileLeaderboard participants={rankedParticipants} studentId={studentId} show="focus" />
              </>
            ) : (
              /* Input form */
              <PhaseCard icon={PenLine} tone="purple" title={t("interactivePlay.textAnswerFallback")}>
                <p className="text-base leading-[1.6] font-semibold text-fg">
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
                        <div key={i} className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${typedAnswer.length > i * 40 ? 'bg-brand-vivid' : 'bg-track'}`} />
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
