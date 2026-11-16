"use client";

/**
 * Presenter for the 18-phase live lesson, shared by the live room
 * (LobbyClient) and the tutor rehearsal (prepare/lesson/PrepareLessonClient).
 *
 * This file owns lesson flow state (phase changes, "can proceed", rehearsal
 * mock students, fullscreen, keyboard shortcuts). Each phase renders through
 * a sibling component in ./presenter, and heavy code (teaching games,
 * recharts, canvas-confetti) is loaded on demand.
 *
 * Public API (props + `PhaseManager` export) is consumed by G5's rehearsal
 * page; keep it stable. Socket events, phase ids and timer semantics are the
 * student app's protocol: do not change them here.
 */
import React from "react";
import { AlertTriangle, History, Users, WifiOff } from "lucide-react";
import { ArticleDisplay } from "./ArticleDisplay";
import { playSound } from "@/lib/sounds";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { Chip, IconTile, Spinner } from "@/components/app";
import { Button } from "@/components/ui/button";
import type { Participant, TutorSessionData, AnswerData, ArticleData, GamePhaseState, LessonPair } from "@/lib/lesson-types";
import { getGamesByCategory } from "@/lib/liveLessonGames";
import {
  GAME_PHASES,
  LESSON_PHASE,
  QUESTION_PHASES,
  RESULT_REVIEW_PHASES,
  TOTAL_LESSON_PHASES,
} from "@/lib/lessonPhases";
import { preloadTeachingGame, LazyFlashcardTeachingGame } from "@/components/lesson/teachingGameRegistry";
import {
  PREPARATION_GUIDE_READY_ANSWER_COUNT,
  PREPARATION_MOCK_SCORES,
  PREPARATION_MOCK_STUDENTS,
  createPreparationAnswer,
  createPreparationGameResult,
  createPreparationGameResults,
  createPreparationGameState,
  createPreparationPairs,
} from "./presenter/preparationMocks";
import {
  buildComprehensionQuestion,
  buildFillBlankQuestion,
  buildSentenceOrderQuestion,
  buildVocabularyQuestion,
  type QuestionModel,
} from "./presenter/questionModels";
import { useLessonAudio } from "./presenter/useLessonAudio";
import { FitToViewport } from "./presenter/FitToViewport";
import { PhaseProgress, getPhaseName } from "./presenter/PhaseProgress";
import { StudentRosterPanel } from "./presenter/StudentRosterPanel";
import { ChoiceQuestionStage } from "./presenter/ChoiceQuestionStage";
import { LanguageQuestionsStage, ReflectionStage, ShortAnswerStage, WritingStage } from "./presenter/WrittenResponseStages";
import { FinalLeaderboardStage, PairConversationStage } from "./presenter/WrapUpStages";
import { GamePhaseStage, rankGameVotes } from "./presenter/GamePhaseStage";
import { PresenterDock, type DevTool } from "./presenter/PresenterDock";
import { PresenterConfirm } from "./presenter/PresenterConfirm";
import { getGamePrimaryAction } from "./presenter/gamePrimaryAction";
import { StageEmpty, StageWaiting } from "./presenter/primitives";
import { fireConfetti } from "./presenter/confetti";

const TOTAL_PHASES = TOTAL_LESSON_PHASES;
const VOCAB_GAME_PHASE = LESSON_PHASE.VOCABULARY_GAME;
const SENTENCE_GAME_PHASE = LESSON_PHASE.SENTENCE_GAME;
const FINAL_LEADERBOARD_PHASE = LESSON_PHASE.WRAP_UP;

const PREPARATION_QUESTION_PHASES = QUESTION_PHASES;
const PREPARATION_RESULT_PHASES = RESULT_REVIEW_PHASES;
const CONFETTI_PHASES: number[] = [
  LESSON_PHASE.FLASHCARDS,
  LESSON_PHASE.COMPREHENSION,
  LESSON_PHASE.VOCABULARY_PRACTICE,
  LESSON_PHASE.SENTENCE_PRACTICE,
  LESSON_PHASE.SENTENCE_ORDER,
];

interface PhaseManagerProps {
  currentPhase: number;
  participants: Participant[];
  totalAnswered: number;
  allAnsweredData: AnswerData[];
  questionEnded?: boolean;
  articleData?: ArticleData;
  changePhase: (phase: number) => Promise<boolean>;
  syncActiveSentence: (index: number) => void;
  endQuestion?: () => void;
  /** Closes a running game. Students without a result simply did not play. */
  endGame?: () => void;
  /** The tutor's own connection is down and reconnecting. */
  connectionLost?: boolean;
  startGameVote: (phase?: number) => void;
  lockGameVote: () => void;
  startGameIntro: (options: { tutorialEnabled: boolean; teacherDemoEnabled: boolean }) => void;
  advanceGameIntro: (durationMs?: number) => void;
  /** Removes a student from the live room; they can rejoin on their own. */
  kickStudent?: (studentId: string) => void;
  sessionData?: TutorSessionData;
  onFinishSession?: () => void;
  flagCounts?: Record<number, number>;
  bypassEmptyStudentGuard?: boolean;
  /** The lesson's exit confirm (outside the presenter) is open. */
  exitConfirmOpen?: boolean;
  preparationMode?: boolean;
  guideOverlay?: React.ReactNode;
  onPreparationAnswersComplete?: (phase: number) => void;
  onPreparationAnswersReadyToEnd?: (phase: number) => void;
  onPreparationGameVotesComplete?: (phase: number) => void;
  onPreparationGameResultsComplete?: (phase: number) => void;
  preparationMockAnswersStarted?: boolean;
  preparationGuideMode?: boolean;
  preparationFreeExplore?: boolean;
}

export const PhaseManager: React.FC<PhaseManagerProps> = ({
  currentPhase,
  participants: liveParticipants,
  totalAnswered: liveTotalAnswered,
  allAnsweredData: liveAllAnsweredData,
  questionEnded: liveQuestionEnded = false,
  articleData,
  changePhase,
  syncActiveSentence,
  endQuestion,
  endGame,
  connectionLost = false,
  startGameVote,
  lockGameVote,
  startGameIntro,
  advanceGameIntro,
  kickStudent,
  sessionData,
  onFinishSession,
  flagCounts,
  bypassEmptyStudentGuard = false,
  exitConfirmOpen = false,
  preparationMode = false,
  guideOverlay,
  onPreparationAnswersComplete,
  onPreparationAnswersReadyToEnd,
  onPreparationGameVotesComplete,
  onPreparationGameResultsComplete,
  preparationMockAnswersStarted = true,
  preparationGuideMode = false,
  preparationFreeExplore = false,
}) => {
  const [isChangingPhase, setIsChangingPhase] = React.useState(false);
  const phaseChangePendingRef = React.useRef(false);
  const phaseChangeRequestIdRef = React.useRef(0);
  const [canProceedDelayed, setCanProceedDelayed] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Keep the target after closing so the dialog title does not lose the
  // student's name while it animates out.
  const [kickTarget, setKickTarget] = React.useState<Participant | null>(null);
  const [kickConfirmOpen, setKickConfirmOpen] = React.useState(false);
  const requestKick = React.useCallback((participant: Participant) => {
    setKickTarget(participant);
    setKickConfirmOpen(true);
  }, []);
  // Actions that throw away a lesson or a game ask first.
  const [pendingConfirm, setPendingConfirm] = React.useState<"finish" | "lobby" | "previous" | null>(null);
  // Ending a game takes a second tap on the same button.
  const [endGameArmed, setEndGameArmed] = React.useState(false);
  const [isToolbarHidden, setIsToolbarHidden] = React.useState(false);
  const [tutorialEnabled, setTutorialEnabled] = React.useState(true);
  const [teacherDemoEnabled, setTeacherDemoEnabled] = React.useState(false);
  const [teacherDemoAnswer, setTeacherDemoAnswer] = React.useState<string | null>(null);
  const [potionRushTeacherDemoCompleted, setPotionRushTeacherDemoCompleted] = React.useState(false);
  const [preparationAnsweredData, setPreparationAnsweredData] = React.useState<AnswerData[]>([]);
  const [preparationQuestionEnded, setPreparationQuestionEnded] = React.useState(false);
  const [preparationQuestionReadyToEnd, setPreparationQuestionReadyToEnd] = React.useState(false);
  const [preparationGameState, setPreparationGameState] = React.useState<GamePhaseState | null>(null);
  const preparationAnswersCompleteNotifiedRef = React.useRef<number | null>(null);
  const preparationAnswersReadyToEndNotifiedRef = React.useRef<number | null>(null);
  const preparationGameVotesCompleteNotifiedRef = React.useRef<number | null>(null);
  const preparationGameResultsCompleteNotifiedRef = React.useRef<number | null>(null);
  // Dev-only: mock participant list to preview the wrap-up leaderboard
  const [mockLeaderboard, setMockLeaderboard] = React.useState<Participant[] | null>(null);
  // Dev-only: mock pairs to preview the Phase 17 pair-conversation layout
  const [mockPairs, setMockPairs] = React.useState<LessonPair[] | null>(null);
  const fullscreenRef = React.useRef<HTMLDivElement>(null);
  const studentsLeftNoticeRef = React.useRef<HTMLDivElement>(null);
  // Where focus was before the students-left notice took it, and whether it has.
  const focusBeforeStudentsLeft = React.useRef<HTMLElement | null>(null);
  const studentsLeftFocused = React.useRef(false);
  // The last presenter control that had focus outside a dialog, for when focus
  // has already fallen to <body> (its control became inert under a confirm).
  const lastPresenterFocus = React.useRef<HTMLElement | null>(null);
  const audio = useLessonAudio(articleData);

  const handleActiveIdxChange = React.useCallback(
    (idx: number) => {
      if (sessionData?.activeSentenceIndex !== idx) syncActiveSentence(idx);
    },
    [sessionData?.activeSentenceIndex, syncActiveSentence],
  );

  // Reset phase-local teaching controls when the server confirms a new phase.
  // The phase-change spinner is released by the request promise instead; if
  // this effect cleared it immediately, a second click could race the first
  // request while the server was still broadcasting the transition.
  const isGamePhase = GAME_PHASES.includes(currentPhase);
  const isInteractivePhase = PREPARATION_QUESTION_PHASES.includes(currentPhase);

  // Reset the local preparation simulation when the server confirms a new phase.
  React.useEffect(() => {
    setTutorialEnabled(true);
    setTeacherDemoEnabled(false);
    setTeacherDemoAnswer(null);
    setPotionRushTeacherDemoCompleted(false);
    setPreparationAnsweredData([]);
    setPreparationQuestionEnded(false);
    setPreparationQuestionReadyToEnd(false);
    preparationAnswersCompleteNotifiedRef.current = null;
    preparationAnswersReadyToEndNotifiedRef.current = null;
    preparationGameVotesCompleteNotifiedRef.current = null;
    preparationGameResultsCompleteNotifiedRef.current = null;
    setPreparationGameState(
      preparationMode && GAME_PHASES.includes(currentPhase) ? createPreparationGameState(currentPhase) : null,
    );
  }, [currentPhase, preparationMode]);

  const requestPhaseChange = React.useCallback(
    (phase: number) => {
      if (phaseChangePendingRef.current) return;

      phaseChangePendingRef.current = true;
      const requestId = ++phaseChangeRequestIdRef.current;
      setIsChangingPhase(true);
      playSound("phaseChange");
      // The socket hook waits for the server acknowledgement and has a bounded
      // timeout. Always release the local loading state so a lost socket packet
      // cannot leave the tutor stuck on "processing" forever.
      const release = () => {
        if (phaseChangeRequestIdRef.current !== requestId) return;
        phaseChangePendingRef.current = false;
        setIsChangingPhase(false);
      };
      void changePhase(phase).then(release, release);
    },
    [changePhase],
  );

  const isRewoundPhase = Boolean(sessionData?.phaseRestored);
  const liveGameState = sessionData?.gameState ?? null;
  const gameState = preparationMode
    ? preparationGameState ?? (isGamePhase ? createPreparationGameState(currentPhase) : liveGameState)
    : liveGameState;
  const currentGameCategory =
    currentPhase === VOCAB_GAME_PHASE ? "vocabulary" : currentPhase === SENTENCE_GAME_PHASE ? "sentence" : null;
  const hasPlayableGameForPhase = currentGameCategory
    ? getGamesByCategory(currentGameCategory).some((game) => game.enabled !== false)
    : true;
  const participants = preparationMode
    ? PREPARATION_MOCK_STUDENTS.map((student, index) => ({
        ...student,
        score: preparationAnsweredData.some((answer) => answer.studentId === student.studentId)
          ? PREPARATION_MOCK_SCORES[index]
          : 0,
      }))
    : liveParticipants;
  // Only students still in the room count. A kicked student's result stays on the
  // board, but it must not stand in for someone still playing.
  const gameResultsCount = participants.filter((p) => gameState?.results?.[p.studentId]).length;
  const allAnsweredData = preparationMode ? preparationAnsweredData : liveAllAnsweredData;
  const totalAnswered = preparationMode ? preparationAnsweredData.length : liveTotalAnswered;
  const questionEnded = preparationMode ? preparationQuestionEnded : liveQuestionEnded;
  const totalParticipants = participants.length;
  const preparationAnswerCountComplete =
    preparationMode && isInteractivePhase && !isGamePhase && totalParticipants > 0 && totalAnswered >= totalParticipants;
  const preparationAnswersReadyToEnd =
    preparationMode &&
    isInteractivePhase &&
    !isGamePhase &&
    totalParticipants > 0 &&
    (preparationGuideMode ? preparationQuestionReadyToEnd : preparationAnswerCountComplete);
  const preparationGuideResultGateActive =
    preparationMode && Boolean(guideOverlay) && PREPARATION_RESULT_PHASES.includes(currentPhase);
  const showQuestionResults = preparationMode
    ? PREPARATION_QUESTION_PHASES.includes(currentPhase) &&
      totalParticipants > 0 &&
      (preparationGuideResultGateActive
        ? preparationGuideMode
          ? preparationQuestionEnded
          : preparationAnswerCountComplete
        : questionEnded || totalAnswered >= totalParticipants)
    : questionEnded || allAnsweredData.length > 0;
  const preparationAnswerStatusText = preparationMode
    ? preparationFreeExplore
      ? t("lesson.live.prepFreeExploreStatus")
      : showQuestionResults
        ? t("lesson.live.prepAllAnsweredSummary")
        : preparationAnswerCountComplete
          ? t("lesson.live.prepAllAnsweredOpening")
          : `${t("lesson.live.prepWaitingPrefix")} ${totalAnswered}/${totalParticipants} ${t("lesson.interactive.peopleUnit")}`
    : null;
  const gameVoting = isGamePhase && gameState?.status === "voting";
  const gameInPlay = isGamePhase && ["countdown", "playing", "results"].includes(gameState?.status || "");
  const leaderboardAnsweredStudentIds = gameVoting
    ? Object.keys(gameState?.votes || {})
    : isGamePhase
      ? Object.keys(gameState?.results || {})
      : allAnsweredData.map((answer) => answer.studentId);

  // In preparation mode, let the tutor see the same waiting state as a real
  // lesson while four sample students answer one by one.
  React.useEffect(() => {
    if (preparationFreeExplore || !preparationMode || !preparationMockAnswersStarted || !isInteractivePhase || isGamePhase) return;

    const targetAnswerCount = preparationGuideMode ? PREPARATION_GUIDE_READY_ANSWER_COUNT : PREPARATION_MOCK_STUDENTS.length;
    const timer = window.setInterval(() => {
      setPreparationAnsweredData((previous) => {
        if (previous.length >= targetAnswerCount) {
          window.clearInterval(timer);
          return previous;
        }
        const student = PREPARATION_MOCK_STUDENTS[previous.length];
        if (!student) {
          window.clearInterval(timer);
          return previous;
        }
        const nextAnswers = [...previous, createPreparationAnswer(currentPhase, student, previous.length)];
        if (
          nextAnswers.length >= targetAnswerCount &&
          preparationGuideMode &&
          preparationAnswersReadyToEndNotifiedRef.current !== currentPhase
        ) {
          preparationAnswersReadyToEndNotifiedRef.current = currentPhase;
          window.setTimeout(() => {
            setPreparationQuestionReadyToEnd(true);
            onPreparationAnswersReadyToEnd?.(currentPhase);
          }, 0);
        }
        if (
          nextAnswers.length >= PREPARATION_MOCK_STUDENTS.length &&
          !preparationGuideMode &&
          preparationAnswersCompleteNotifiedRef.current !== currentPhase
        ) {
          // Notify the parent after the answer list has been committed. This
          // is the authoritative hand-off that lets Guide leave its waiting
          // step and show the summary phase.
          window.setTimeout(() => {
            if (preparationAnswersCompleteNotifiedRef.current === currentPhase) return;
            preparationAnswersCompleteNotifiedRef.current = currentPhase;
            onPreparationAnswersComplete?.(currentPhase);
          }, 0);
        }
        return nextAnswers;
      });
    }, 1400);

    return () => window.clearInterval(timer);
  }, [
    currentPhase,
    isGamePhase,
    isInteractivePhase,
    onPreparationAnswersReadyToEnd,
    onPreparationAnswersComplete,
    preparationMockAnswersStarted,
    preparationGuideMode,
    preparationFreeExplore,
    preparationMode,
  ]);

  React.useEffect(() => {
    if (preparationAnswerCountComplete && !preparationGuideMode) setPreparationQuestionEnded(true);
  }, [preparationAnswerCountComplete, preparationGuideMode]);

  // Notify the preparation Guide after the local Lesson state has committed
  // the completed-answer state. This keeps the Guide's waiting step in sync
  // with the result screen, including short-answer phases.
  React.useEffect(() => {
    if (
      !preparationMode ||
      !isInteractivePhase ||
      isGamePhase ||
      !preparationQuestionEnded ||
      preparationAnswersCompleteNotifiedRef.current === currentPhase
    ) {
      return;
    }
    preparationAnswersCompleteNotifiedRef.current = currentPhase;
    onPreparationAnswersComplete?.(currentPhase);
  }, [currentPhase, isGamePhase, isInteractivePhase, onPreparationAnswersComplete, preparationMode, preparationQuestionEnded]);

  // Simulate students voting at a steady pace so the tutor can see the vote
  // count, the leader, and the voters update before locking the vote.
  React.useEffect(() => {
    if (preparationFreeExplore || !preparationMode || !isGamePhase || gameState?.status !== "voting" || !currentGameCategory) return;

    const enabledGames = getGamesByCategory(currentGameCategory).filter((game) => game.enabled !== false);
    let nextStudentIndex = 0;
    const timer = window.setInterval(() => {
      const studentIndex = nextStudentIndex;
      const student = PREPARATION_MOCK_STUDENTS[studentIndex];
      if (!student) {
        window.clearInterval(timer);
        return;
      }
      nextStudentIndex += 1;

      setPreparationGameState((previous) => {
        if (!previous || previous.status !== "voting") return previous;
        const voteTarget = enabledGames[studentIndex === PREPARATION_MOCK_STUDENTS.length - 1 ? 1 : 0] || enabledGames[0];
        if (!voteTarget) return previous;
        return { ...previous, votes: { ...previous.votes, [student.studentId]: voteTarget.id } };
      });
    }, 1400);

    return () => window.clearInterval(timer);
  }, [currentGameCategory, gameState?.status, isGamePhase, preparationFreeExplore, preparationMode]);

  React.useEffect(() => {
    if (
      preparationFreeExplore ||
      !preparationMode ||
      !isGamePhase ||
      gameState?.status !== "voting" ||
      totalParticipants === 0 ||
      Object.keys(gameState.votes || {}).length < totalParticipants ||
      preparationGameVotesCompleteNotifiedRef.current === currentPhase
    ) {
      return;
    }
    preparationGameVotesCompleteNotifiedRef.current = currentPhase;
    onPreparationGameVotesComplete?.(currentPhase);
  }, [
    currentPhase,
    gameState?.status,
    gameState?.votes,
    isGamePhase,
    onPreparationGameVotesComplete,
    preparationFreeExplore,
    preparationMode,
    totalParticipants,
  ]);

  // After the tutor starts the game in preparation mode, show a live game
  // monitor and let the mock students finish one by one before the result
  // screen appears.
  React.useEffect(() => {
    if (preparationFreeExplore || !preparationMode || !isGamePhase || gameState?.status !== "playing") return;

    let nextStudentIndex = Object.keys(gameState.results || {}).length;
    const timer = window.setInterval(() => {
      const studentIndex = nextStudentIndex;
      const student = PREPARATION_MOCK_STUDENTS[studentIndex];
      if (!student) {
        window.clearInterval(timer);
        return;
      }
      nextStudentIndex += 1;

      setPreparationGameState((previous) => {
        if (!previous || previous.status !== "playing") return previous;
        const result = createPreparationGameResult(previous.selectedGameId || "dragon-flight", previous.category, student, studentIndex);
        const nextResults = { ...previous.results, [student.studentId]: result };
        const isComplete = Object.keys(nextResults).length >= PREPARATION_MOCK_STUDENTS.length;
        return { ...previous, status: isComplete ? "results" : "playing", results: nextResults };
      });
    }, 1400);

    return () => window.clearInterval(timer);
  }, [gameState?.status, isGamePhase, preparationFreeExplore, preparationMode]);

  React.useEffect(() => {
    if (
      preparationFreeExplore ||
      !preparationMode ||
      !isGamePhase ||
      gameState?.status !== "results" ||
      totalParticipants === 0 ||
      Object.keys(gameState.results || {}).length < totalParticipants ||
      preparationGameResultsCompleteNotifiedRef.current === currentPhase
    ) {
      return;
    }
    preparationGameResultsCompleteNotifiedRef.current = currentPhase;
    onPreparationGameResultsComplete?.(currentPhase);
  }, [
    currentPhase,
    gameState?.results,
    gameState?.status,
    isGamePhase,
    onPreparationGameResultsComplete,
    preparationFreeExplore,
    preparationMode,
    totalParticipants,
  ]);

  // Can proceed if everyone answered OR if results are already showing OR if no participants
  const canProceed = preparationFreeExplore
    ? true
    : preparationGuideResultGateActive && !(preparationGuideMode ? preparationQuestionEnded : preparationAnswerCountComplete)
      ? false
      : isRewoundPhase ||
        (!isInteractivePhase && !isGamePhase) ||
        totalParticipants === 0 ||
        preparationAnswersReadyToEnd ||
        (isGamePhase && !hasPlayableGameForPhase) ||
        // Games are over when the server says so: everyone expected has submitted,
        // or the tutor ended the game, even with nothing submitted.
        (isGamePhase && gameState?.status === "results") ||
        (!isGamePhase && (questionEnded || totalAnswered >= totalParticipants || showQuestionResults));

  // After End game, phones still playing end their round and hand in what they
  // have, some after a short pause of their own. Moving on closes the game, so
  // give those results a moment to arrive first.
  const gameEndedEarly =
    isGamePhase && gameState?.status === "results" && gameResultsCount < totalParticipants;

  React.useEffect(() => {
    if (preparationFreeExplore) {
      setCanProceedDelayed(true);
    } else if (canProceed) {
      const timer = setTimeout(() => setCanProceedDelayed(true), gameEndedEarly ? 3000 : 1000);
      return () => clearTimeout(timer);
    } else {
      setCanProceedDelayed(false);
    }
  }, [canProceed, preparationFreeExplore, gameEndedEarly]);

  const nextPhaseTarget =
    isRewoundPhase && sessionData?.resumePhase && sessionData.resumePhase > currentPhase
      ? sessionData.resumePhase
      : currentPhase < TOTAL_PHASES
        ? currentPhase + 1
        : 0;

  const handleNextPhase = React.useCallback(() => {
    if (!isChangingPhase && (preparationFreeExplore || canProceedDelayed)) {
      // Phase 0 safely loops back to the lobby; the backend cycles a fresh DB
      // session the moment instruction begins again.
      requestPhaseChange(nextPhaseTarget > 0 ? nextPhaseTarget : 0);
    }
  }, [isChangingPhase, canProceedDelayed, preparationFreeExplore, requestPhaseChange, nextPhaseTarget]);

  const goToPreviousPhase = React.useCallback(() => {
    if (currentPhase <= 1 || isChangingPhase) return;
    requestPhaseChange(currentPhase - 1);
  }, [currentPhase, isChangingPhase, requestPhaseChange]);

  const gameIsRunning = isGamePhase && !preparationMode && ["countdown", "playing"].includes(gameState?.status || "");
  const handlePreviousPhase = React.useCallback(() => {
    if (gameIsRunning) setPendingConfirm("previous");
    else goToPreviousPhase();
  }, [gameIsRunning, goToPreviousPhase]);

  const handleFinishRequest = React.useCallback(() => {
    // Rehearsal passes its own close action here, and it loses nothing.
    if (preparationMode || currentPhase >= FINAL_LEADERBOARD_PHASE) onFinishSession?.();
    else setPendingConfirm("finish");
  }, [currentPhase, onFinishSession, preparationMode]);

  // A confirmation cannot outlive the state it asked about.
  React.useEffect(() => {
    setPendingConfirm(null);
    setEndGameArmed(false);
  }, [currentPhase, gameState?.status]);

  React.useEffect(() => {
    if (!endGameArmed) return;
    const timer = window.setTimeout(() => setEndGameArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [endGameArmed]);

  const handleEndQuestion = React.useCallback(() => {
    if (isRewoundPhase || questionEnded || totalParticipants === 0) return;
    if (preparationMode) {
      if (!preparationFreeExplore && !preparationAnswersReadyToEnd) return;
      playSound("submit");
      setPreparationQuestionEnded(true);
      return;
    }
    if (!endQuestion) return;
    playSound("submit");
    endQuestion();
  }, [endQuestion, isRewoundPhase, preparationAnswersReadyToEnd, preparationFreeExplore, preparationMode, questionEnded, totalParticipants]);

  const toggleMockLeaderboard = React.useCallback(() => {
    if (mockLeaderboard) {
      setMockLeaderboard(null);
      return;
    }
    const mock = Array.from({ length: 14 }, (_, i) => ({
      studentId: `mock-${i}`,
      name: `Student ${i + 1}`,
      score: Math.floor(Math.random() * 60),
    }));
    setMockLeaderboard(mock);
    requestPhaseChange(FINAL_LEADERBOARD_PHASE);
  }, [mockLeaderboard, requestPhaseChange]);

  const toggleMockPairs = React.useCallback(() => {
    if (mockPairs) {
      setMockPairs(null);
      return;
    }
    const students = Array.from({ length: 7 }, (_, i) => ({ studentId: `mock-pair-${i}`, name: `Student ${i + 1}` }));
    const mock: LessonPair[] = [];
    for (let i = 0; i + 1 < students.length; i += 2) {
      mock.push({ pairNumber: mock.length + 1, members: [students[i], students[i + 1]] });
    }
    if (students.length % 2 === 1) mock[mock.length - 1].members.push(students[students.length - 1]);
    setMockPairs(mock);
    requestPhaseChange(LESSON_PHASE.PAIR_CONVERSATION);
  }, [mockPairs, requestPhaseChange]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
        return;
      }
      // Don't hijack arrow keys while the tutor types or uses a control.
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      // During a game the arrow keys drive the demo, and the dock button moves the game on.
      if (isGamePhase && gameState?.status && gameState.status !== "results") return;
      if (e.key === "ArrowRight" && (preparationFreeExplore || canProceedDelayed) && !isChangingPhase) {
        handleNextPhase();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNextPhase, canProceedDelayed, isChangingPhase, preparationFreeExplore, currentPhase, isFullscreen, isGamePhase, gameState?.status]);

  React.useEffect(() => {
    const fullscreenElement = fullscreenRef.current;
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (document.fullscreenElement === fullscreenElement) document.exitFullscreen().catch(() => undefined);
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
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
      return;
    }
    setIsFullscreen(true);
    if (fullscreenElement?.requestFullscreen) await fullscreenElement.requestFullscreen().catch(() => undefined);
  }, [isFullscreen]);

  // Confetti effect when results are ready (canvas-confetti loads on demand).
  React.useEffect(() => {
    if (CONFETTI_PHASES.includes(currentPhase) && showQuestionResults) fireConfetti();
  }, [currentPhase, showQuestionResults]);

  // ── Code-split preloading ────────────────────────────────────────────────
  // Flashcards (phase 2) are next after the launch phase.
  React.useEffect(() => {
    if (currentPhase >= 1 && currentPhase <= LESSON_PHASE.FLASHCARDS) void preloadTeachingGame("flashcard");
  }, [currentPhase]);

  // Download the vote leader / locked game while students vote, so the
  // teacher demo and tutorial (and the countdown that follows) never flash a
  // loader. The leader can change while voting; each candidate is cached.
  const voteLeaderId = React.useMemo(() => {
    if (!currentGameCategory || gameState?.status !== "voting") return null;
    const { leadingGame } = rankGameVotes(currentGameCategory, gameState.votes || {}, participants, gameState.leadingGameId);
    return leadingGame && leadingGame.enabled !== false ? leadingGame.id : null;
    // participants only affects voter names, not the leader
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGameCategory, gameState?.status, gameState?.votes, gameState?.leadingGameId]);
  React.useEffect(() => {
    if (voteLeaderId) void preloadTeachingGame(voteLeaderId);
  }, [voteLeaderId]);
  React.useEffect(() => {
    if (gameState?.selectedGameId) void preloadTeachingGame(gameState.selectedGameId);
  }, [gameState?.selectedGameId]);

  // ── Rendering ────────────────────────────────────────────────────────────
  const tour = (target: string) => (preparationMode ? target : undefined);
  const roster = (
    <StudentRosterPanel
      participants={participants}
      answeredStudentIds={leaderboardAnsweredStudentIds}
      showAnswerStatus={isInteractivePhase || gameVoting || gameInPlay}
      statusLabels={
        gameVoting
          ? { done: t("lesson.live.statusVoted"), waiting: t("lesson.live.statusNotVoted"), count: t("lesson.live.dockVoted") }
          : gameInPlay
            ? {
                done: t("lesson.live.submittedCheck"),
                waiting: gameState?.status === "results" ? t("lesson.live.statusNotPlayed") : t("lesson.live.statusPlaying"),
                count: t("lesson.live.rosterSubmitted"),
              }
            : undefined
      }
      preparationMode={preparationMode}
      preparationFreeExplore={preparationFreeExplore}
      onRemoveStudent={!preparationMode && kickStudent ? requestKick : undefined}
    />
  );
  const questionContext = {
    articleData,
    sessionId: sessionData?.sessionId,
    phaseSelectedIndices: sessionData?.phaseSelectedIndices,
    audio,
  };

  const renderChoice = (model: QuestionModel, emptyPhase: number) =>
    model.kind === "empty" ? (
      <StageEmpty
        message={model.message}
        tourTarget={tour(`phase-${emptyPhase}-empty-state`)}
        statusTarget={tour(`phase-${emptyPhase}-student-status`)}
      />
    ) : (
      <ChoiceQuestionStage
        model={model}
        currentPhase={currentPhase}
        showResults={showQuestionResults}
        answers={allAnsweredData}
        totalAnswered={totalAnswered}
        totalParticipants={totalParticipants}
        audio={audio}
        roster={roster}
        preparationMode={preparationMode}
        preparationStatusText={preparationAnswerStatusText}
      />
    );

  const writtenCommon = {
    currentPhase,
    showResults: showQuestionResults,
    answers: allAnsweredData,
    totalAnswered,
    totalParticipants,
    roster,
    preparationMode,
    preparationStatusText: preparationAnswerStatusText,
  };

  const renderPhaseContent = () => {
    if (currentPhase === 0 && participants.length === 0) {
      return <StageWaiting as="h1" title={t("lesson.interactive.waitingStudents")} description={t("lesson.interactive.noJoinedYet")} />;
    }
    switch (currentPhase) {
      case LESSON_PHASE.FLASHCARDS:
        return (
          <div data-tour-target={tour("phase-2-flashcards")} className="w-full min-w-0">
            <LazyFlashcardTeachingGame
              words={(articleData as any)?.words || []}
              participants={participants}
              answered={totalAnswered}
              onSpeak={(text, audioUrl) => audio.playClip(audioUrl || audio.getWordAudioUrl(text), text)}
              preparationMode={preparationMode}
            />
          </div>
        );
      case LESSON_PHASE.COMPREHENSION:
        return renderChoice(buildComprehensionQuestion(questionContext), LESSON_PHASE.COMPREHENSION);
      case LESSON_PHASE.VOCABULARY_PRACTICE:
        return renderChoice(buildVocabularyQuestion(questionContext), LESSON_PHASE.VOCABULARY_PRACTICE);
      case LESSON_PHASE.SENTENCE_PRACTICE:
        return renderChoice(buildFillBlankQuestion(questionContext), LESSON_PHASE.SENTENCE_PRACTICE);
      case LESSON_PHASE.SENTENCE_ORDER:
        return renderChoice(buildSentenceOrderQuestion(questionContext), LESSON_PHASE.SENTENCE_ORDER);
      case LESSON_PHASE.GUIDED_RESPONSE: {
        const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
        const question = articleData?.shortAnswerQuestions?.[idx] || articleData?.shortAnswerQuestions?.[0];
        const manifestQuestion =
          audio.getManifestQuestionByText(question?.question, "saq") ||
          audio.getManifestQuestion("saq", idx) ||
          audio.getManifestQuestion("saq", 0);
        const audioUrl = manifestQuestion?.questionAudioUrl || question?.questionAudioUrl || question?.audioUrl;
        return (
          <ShortAnswerStage
            {...writtenCommon}
            question={question?.question}
            onSpeak={() => audio.playClip(audioUrl, question?.question)}
          />
        );
      }
      case LESSON_PHASE.GUIDED_WRITING: {
        const idx = sessionData?.phaseSelectedIndices?.[LESSON_PHASE.GUIDED_WRITING] || 0;
        const question = articleData?.shortAnswerQuestions?.[idx] || articleData?.shortAnswerQuestions?.[0];
        const manifestQuestion =
          audio.getManifestQuestionByText(question?.question) ||
          audio.getManifestQuestion("saq", idx) ||
          audio.getManifestQuestion("saq", 0);
        const prompt = question?.question || t("lesson.interactive.writingPromptLabel");
        const audioUrl = manifestQuestion?.questionAudioUrl || question?.questionAudioUrl || question?.audioUrl;
        return (
          <WritingStage
            {...writtenCommon}
            prompt={prompt}
            hasQuestion={Boolean(question?.question)}
            onSpeak={() => audio.playClip(audioUrl, question?.question)}
          />
        );
      }
      case VOCAB_GAME_PHASE:
      case SENTENCE_GAME_PHASE:
        return (
          <GamePhaseStage
            category={currentPhase === VOCAB_GAME_PHASE ? "vocabulary" : "sentence"}
            currentPhase={currentPhase}
            gameState={gameState}
            participants={participants}
            totalParticipants={totalParticipants}
            submittedCount={gameResultsCount}
            articleData={articleData}
            isFullscreen={isFullscreen}
            preparationMode={preparationMode}
            teacherDemoEnabled={teacherDemoEnabled}
            onTeacherDemoEnabledChange={setTeacherDemoEnabled}
            tutorialEnabled={tutorialEnabled}
            onTutorialEnabledChange={setTutorialEnabled}
            teacherDemoAnswer={teacherDemoAnswer}
            onTeacherDemoAnswer={setTeacherDemoAnswer}
            potionRushTeacherDemoCompleted={potionRushTeacherDemoCompleted}
            onPotionRushTeacherDemoComplete={() => setPotionRushTeacherDemoCompleted(true)}
            roster={roster}
          />
        );
      case LESSON_PHASE.LANGUAGE_QUESTIONS:
        return <LanguageQuestionsStage {...writtenCommon} />;
      case LESSON_PHASE.REFLECTION:
        return <ReflectionStage {...writtenCommon} />;
      case LESSON_PHASE.PAIR_CONVERSATION: {
        const pairs: LessonPair[] = mockPairs ?? (preparationMode ? createPreparationPairs() : sessionData?.pairs ?? []);
        // Mock pairs preview the layout without real students in the room
        const showEmptyState =
          pairs.length === 0 || (!preparationMode && !mockPairs && pairs.every((p) => p.members.length < 2));
        return <PairConversationStage pairs={pairs} showEmptyState={showEmptyState} preparationMode={preparationMode} />;
      }
      case FINAL_LEADERBOARD_PHASE:
        return <FinalLeaderboardStage participants={mockLeaderboard ?? participants} preparationMode={preparationMode} />;
      default:
        // Presentation phases: Launch, Read, Vocabulary Context, Deep Reading, and Key Sentences.
        return (
          <ArticleDisplay
            articleData={audio.presentationArticleData}
            phase={currentPhase}
            isFullscreen={isFullscreen}
            flagCounts={flagCounts}
            onActiveIdxChange={handleActiveIdxChange}
          />
        );
    }
  };

  // ── Dock ─────────────────────────────────────────────────────────────────
  const isNextDisabled = (preparationFreeExplore ? false : !canProceedDelayed) || isChangingPhase;
  const gameStatus = gameState?.status;
  const hasGameResults = isGamePhase && gameResultsCount > 0;
  const canEndGame = isGamePhase && !isRewoundPhase && !preparationMode && gameStatus === "playing" && Boolean(endGame);
  const handleEndGame = () => {
    if (!endGameArmed) {
      setEndGameArmed(true);
      return;
    }
    setEndGameArmed(false);
    playSound("submit");
    endGame?.();
  };
  const expectedStudentIds = gameState?.expectedStudentIds;
  const studentsStillPlaying =
    gameStatus === "playing"
      ? participants.filter(
          (p) => !gameState?.results?.[p.studentId] && (!expectedStudentIds || expectedStudentIds.includes(p.studentId)),
        )
      : [];
  // Name them once there is someone to name: a phone that dropped, or everyone else done.
  const waitingNames =
    !preparationMode && (hasGameResults || studentsStillPlaying.some((p) => p.offlineSince))
      ? [...studentsStillPlaying].sort((a, b) => Number(Boolean(b.offlineSince)) - Number(Boolean(a.offlineSince))).map((p) => p.name)
      : [];
  const canEndQuestion =
    isInteractivePhase &&
    !isRewoundPhase &&
    !questionEnded &&
    totalParticipants > 0 &&
    totalAnswered < totalParticipants &&
    (!preparationMode || preparationFreeExplore || preparationAnswersReadyToEnd);
  const useGamePrimaryAction =
    isGamePhase &&
    !isRewoundPhase &&
    hasPlayableGameForPhase &&
    // The rehearsal guide points at the next button once mock results come in.
    (preparationMode ? !hasGameResults : gameStatus !== "results");
  const gameAction = getGamePrimaryAction({
    status: gameStatus,
    hasPlayableGame: hasPlayableGameForPhase,
    teacherDemoEnabled,
    tutorialEnabled,
    stateTutorialEnabled: Boolean(gameState?.tutorialEnabled),
    preparationMode,
    preparationFreeExplore,
    votesCount: Object.keys(gameState?.votes || {}).length,
    totalParticipants,
    waitingNames,
  });

  const handleGamePrimaryAction = () => {
    if (!gameStatus) {
      if (preparationMode) setPreparationGameState(createPreparationGameState(currentPhase));
      else startGameVote(currentPhase);
      return;
    }
    if (gameStatus === "voting") {
      if (preparationMode) {
        const enabledGames = currentGameCategory
          ? getGamesByCategory(currentGameCategory).filter((game) => game.enabled !== false)
          : [];
        const voteCounts = enabledGames.map((game) => ({
          game,
          count: Object.values(gameState?.votes || {}).filter((vote) => vote === game.id).length,
        }));
        const winningGame = [...voteCounts].sort((a, b) => b.count - a.count)[0]?.game || enabledGames[0];
        setPreparationGameState((previous) =>
          previous
            ? {
                ...previous,
                // Keep the same preparation sequence as a live lesson:
                // closing the vote reveals the ready screen first.
                status: "ready",
                selectedGameId: winningGame?.id,
                results: {},
              }
            : previous,
        );
      } else {
        lockGameVote();
      }
      return;
    }
    if (gameStatus === "ready") {
      if (preparationMode) {
        setPreparationGameState((previous) =>
          previous
            ? {
                ...previous,
                status: teacherDemoEnabled ? "teacher_demo" : tutorialEnabled ? "tutorial" : "playing",
                tutorialEnabled,
                teacherDemoEnabled,
                results: {},
              }
            : previous,
        );
      } else {
        startGameIntro({ tutorialEnabled, teacherDemoEnabled });
      }
      return;
    }
    if (gameStatus === "playing" && preparationFreeExplore) {
      setPreparationGameState((previous) =>
        previous
          ? {
              ...previous,
              status: "results",
              results: createPreparationGameResults(previous.selectedGameId || "dragon-flight", previous.category),
            }
          : previous,
      );
      return;
    }
    if (gameStatus === "teacher_demo") {
      if (preparationMode) {
        setPreparationGameState((previous) =>
          previous ? { ...previous, status: previous.tutorialEnabled ? "tutorial" : "playing", results: {} } : previous,
        );
      } else {
        advanceGameIntro(5000);
      }
    } else if (gameStatus === "tutorial") {
      if (preparationMode) {
        setPreparationGameState((previous) => (previous ? { ...previous, status: "playing", results: {} } : previous));
      } else {
        advanceGameIntro(5000);
      }
    }
  };

  const nextLabel = isChangingPhase
    ? t("lesson.interactive.processing")
    : !preparationFreeExplore && !canProceedDelayed
      ? t("lesson.interactive.waitingAnswers")
      : currentPhase === FINAL_LEADERBOARD_PHASE
        ? t("lesson.interactive.startNewRound")
        : isRewoundPhase
          ? `${t("lesson.live.backToPhase")} ${sessionData?.resumePhase ?? currentPhase + 1}`
          : t("lesson.live.next");
  const nextHint =
    nextPhaseTarget > 0 && !isChangingPhase ? `${t("lesson.live.nextUp")} ${getPhaseName(nextPhaseTarget)}` : undefined;
  const showNextChevron = !isChangingPhase && (preparationFreeExplore || canProceedDelayed);

  const isDevelopmentMode = process.env.NODE_ENV === "development" && !preparationMode;
  const devTools: DevTool[] | undefined = isDevelopmentMode
    ? [
        { label: "Prev", onClick: () => requestPhaseChange(Math.max(1, currentPhase - 1)), disabled: isChangingPhase },
        { label: "Skip", onClick: () => requestPhaseChange(Math.min(TOTAL_PHASES, currentPhase + 1)), disabled: isChangingPhase },
        ...(isGamePhase
          ? [
              {
                label: "Reopen phase",
                onClick: () => requestPhaseChange(currentPhase),
                disabled: isChangingPhase,
                title: "Reset the current game phase as a fresh live phase",
              },
            ]
          : []),
        { label: mockLeaderboard ? "Mock LB on" : "Mock LB", onClick: toggleMockLeaderboard, active: Boolean(mockLeaderboard) },
        { label: mockPairs ? "Mock pairs on" : "Mock pairs", onClick: toggleMockPairs, active: Boolean(mockPairs) },
      ]
    : undefined;

  // Everyone left mid-lesson: a blocking notice whose only action returns to the lobby.
  const studentsLeft = currentPhase > 0 && participants.length === 0 && !bypassEmptyStudentGuard;
  const dialogOpen = pendingConfirm !== null || kickConfirmOpen || exitConfirmOpen;
  // When the notice appears, move focus onto the notice card (screen readers read
  // its title and text, and focusing it scrolls it into view). Not onto its danger
  // action: the notice comes from students dropping out, not from the tutor, so a
  // stray Enter must not send the class to the lobby. Wait while a confirm is
  // open, and give focus back when the notice goes away.
  React.useEffect(() => {
    if (!studentsLeft) {
      const previous = focusBeforeStudentsLeft.current;
      focusBeforeStudentsLeft.current = null;
      studentsLeftFocused.current = false;
      if (previous?.isConnected && !previous.closest("[inert]") && document.activeElement === document.body) {
        previous.focus();
      }
      return;
    }
    const notice = studentsLeftNoticeRef.current;
    if (!notice) return;
    const active = document.activeElement;
    if (studentsLeftFocused.current) {
      // Leaving fullscreen made the dock inert while it had focus: take it back.
      if (active instanceof HTMLElement && active.closest("[inert]")) notice.focus();
      return;
    }
    if (dialogOpen) return;
    if (active instanceof HTMLElement && active !== document.body && !notice.contains(active)) {
      focusBeforeStudentsLeft.current = active;
    } else if (lastPresenterFocus.current?.isConnected) {
      focusBeforeStudentsLeft.current = lastPresenterFocus.current;
    }
    studentsLeftFocused.current = true;
    notice.focus();
  }, [studentsLeft, dialogOpen, isFullscreen]);

  const dockStatus = isInteractivePhase ? (
    <span className="inline-flex items-center gap-1.5">
      <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
      {t("lesson.live.dockAnswered")}{" "}
      <span className="text-lg font-semibold tabular-nums text-fg">
        {totalAnswered}/{totalParticipants}
      </span>
    </span>
  ) : isGamePhase && gameStatus && gameStatus !== "voting" ? (
    <span className="inline-flex items-center gap-1.5">
      <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
      {t("lesson.live.dockSubmitted")}{" "}
      <span className="text-lg font-semibold tabular-nums text-fg">
        {gameResultsCount}/{totalParticipants}
      </span>
    </span>
  ) : isGamePhase && gameStatus === "voting" ? (
    <span className="inline-flex items-center gap-1.5">
      <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
      {t("lesson.live.dockVoted")}{" "}
      <span className="text-lg font-semibold tabular-nums text-fg">
        {Object.keys(gameState?.votes || {}).length}/{totalParticipants}
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
      {t("lesson.interactive.studentsLabel")}{" "}
      <span className="text-lg font-semibold tabular-nums text-fg">{totalParticipants}</span>{" "}
      {t("lesson.interactive.peopleUnit")}
    </span>
  );

  return (
    <div
      ref={fullscreenRef}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement && !event.target.closest('[role="alertdialog"]')) {
          lastPresenterFocus.current = event.target;
        }
      }}
      data-current-phase={currentPhase}
      // Vocabulary / active-sentence marker used by ArticleDisplay.
      style={{ "--highlight-bg": "var(--warning-bg)", "--highlight-text": "var(--warning-fg)" } as React.CSSProperties}
      className={
        isFullscreen
          ? // The stage keeps clear of the dock, and takes its room back when the dock is hidden.
            `fixed inset-0 z-(--z-presenter) flex h-dvh w-screen flex-col overflow-hidden bg-app ${isToolbarHidden ? "" : "pb-28"}`
          : "relative flex min-h-[var(--lesson-viewport-h,100dvh)] flex-1 flex-col bg-app"
      }
    >
      {connectionLost ? (
        <div
          role="status"
          className="mx-4 mt-3 flex items-center gap-3 rounded-(--radius-card) border border-warning-border bg-warning-bg px-3.5 py-2.5 text-sm text-warning-fg lg:mx-6"
        >
          <WifiOff aria-hidden="true" className="size-5 shrink-0" />
          <p className="min-w-0 flex-1 leading-[1.6]">
            <span className="font-semibold">{t("lesson.live.reconnectingTitle")}</span>
            <span className="hidden sm:inline"> · {t("lesson.live.reconnectingHint")}</span>
          </p>
          <Spinner className="text-warning-fg" />
        </div>
      ) : null}

      {/* Warning overlay when everyone left */}
      {studentsLeft ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-app/85 p-4">
          <div
            ref={studentsLeftNoticeRef}
            role="alertdialog"
            tabIndex={-1}
            // Not aria-modal: the stage behind it is inert, but the lesson bar (exit,
            // theme) and in fullscreen the dock stay usable, so screen readers must
            // still reach them.
            aria-labelledby="students-left-title"
            aria-describedby="students-left-description"
            className="flex w-full max-w-md flex-col items-center rounded-(--radius-dialog) border border-clay-rim bg-surface-elevated px-6 py-8 text-center shadow-popover outline-none sm:px-8"
          >
            <IconTile icon={Users} tone="amber" size="xl" />
            <h3 id="students-left-title" className="mt-4 text-2xl leading-[1.35] font-semibold text-balance-th text-fg">
              {thaiLabel(t("lesson.interactive.studentsLeftTitle"))}
            </h3>
            <p id="students-left-description" className="mt-2 text-base text-fg-muted">
              {thaiCopy(t("lesson.interactive.studentsLeftDescription"))}
            </p>
            <Button
              size="xl"
              className="mt-6 w-full"
              onClick={() => requestPhaseChange(0)}
              disabled={isChangingPhase}
            >
              {t("lesson.interactive.returnLobbyNow")}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        data-tour-target={tour("phase-progress")}
        inert={studentsLeft || undefined}
        className={
          isFullscreen && !preparationMode ? "hidden" : "shrink-0 border-b border-hairline bg-surface-nav px-4 pt-3 pb-2 lg:px-6"
        }
      >
        <PhaseProgress
          currentPhase={currentPhase}
          interactive={preparationFreeExplore}
          disabled={isChangingPhase}
          onSelectPhase={(phase) => {
            if (phase !== currentPhase && !isChangingPhase) requestPhaseChange(phase);
          }}
        />
      </div>
      {isRewoundPhase ? (
        <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-(--radius-card) border border-warning-border bg-warning-bg px-3.5 py-2.5 text-sm font-semibold text-warning-fg lg:mx-6">
          <History aria-hidden="true" className="size-5 shrink-0" />
          <p className="min-w-0 flex-1 leading-[1.6]">
            {thaiCopy(`${t("lesson.live.rewoundNotice")} ${sessionData?.resumePhase ?? currentPhase + 1}`)}
          </p>
        </div>
      ) : null}
      <div
        data-tour-target={tour("phase-content")}
        inert={studentsLeft || undefined}
        className={isFullscreen ? "flex h-full min-h-0 min-w-0 flex-1 flex-col px-6 pt-5" : "flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-4 pb-5 lg:px-6 lg:pt-5"}
      >
        <FitToViewport enabled={isFullscreen}>{renderPhaseContent()}</FitToViewport>
      </div>

      <PresenterDock
        isFullscreen={isFullscreen}
        hidden={isToolbarHidden}
        inert={studentsLeft && !isFullscreen}
        onShow={() => setIsToolbarHidden(false)}
        onHide={() => setIsToolbarHidden(true)}
        onToggleFullscreen={() => void toggleFullscreen()}
        status={dockStatus}
        modeBadge={
          preparationMode ? (
            <Chip tone="info" size="sm">
              {preparationFreeExplore ? t("lesson.live.modeFreeExplore") : t("lesson.live.modeRehearsal")}
            </Chip>
          ) : undefined
        }
        onReturnLobby={preparationMode ? undefined : () => setPendingConfirm("lobby")}
        returnLobbyDisabled={isChangingPhase}
        onPrevious={handlePreviousPhase}
        previousDisabled={currentPhase <= 1 || isChangingPhase}
        endQuestion={
          canEndGame
            ? {
                onClick: handleEndGame,
                label: endGameArmed
                  ? t("lesson.live.endGameConfirm")
                  : `${t("lesson.live.endGame")} (${gameResultsCount}/${totalParticipants})`,
                title: t("lesson.live.endGameTitle"),
              }
            : canEndQuestion
              ? {
                  onClick: handleEndQuestion,
                  disabled: !preparationMode && !endQuestion,
                  title: `${t("lesson.live.endQuestionTitle")} ${totalAnswered}/${totalParticipants} ${t("lesson.interactive.peopleUnit")}`,
                }
              : null
        }
        primary={
          useGamePrimaryAction
            ? {
                label: gameAction.label,
                onClick: handleGamePrimaryAction,
                disabled: gameAction.disabled,
                tone: "game",
                showChevron: gameStatus === "voting",
                tourTarget: tour("game-primary-button"),
              }
            : {
                label: nextLabel,
                onClick: handleNextPhase,
                disabled: isNextDisabled,
                loading: isChangingPhase,
                tone: "next",
                showChevron: showNextChevron,
                tourTarget: tour("phase-next-button"),
                hint: nextHint,
              }
        }
        onFinish={onFinishSession ? handleFinishRequest : undefined}
        finishEmphasis={currentPhase === FINAL_LEADERBOARD_PHASE}
        devTools={devTools}
        tour={tour}
      />

      {audio.fallbackText ? (
        <div
          role="status"
          className="fixed right-4 bottom-24 z-(--z-presenter-toast) flex max-w-sm items-start gap-3 rounded-(--radius-card) border border-clay-rim bg-surface-elevated px-3.5 py-3 shadow-popover sm:right-6"
        >
          <IconTile icon={AlertTriangle} tone="amber" size="sm" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-fg">{t("lesson.live.speechFallbackTitle")}</p>
            <p className="mt-0.5 text-fg-muted">&ldquo;{audio.fallbackText}&rdquo;</p>
          </div>
        </div>
      ) : null}
      <PresenterConfirm
        open={kickConfirmOpen}
        onCancel={() => setKickConfirmOpen(false)}
        // The question and the student's name (user data) are one block each: the line breaks between them
        // first, and the question only wraps (word by word) where the dialog is narrower than it.
        title={
          <>
            <span className="inline-block max-w-full">{thaiLabel(t("lesson.live.removeConfirmTitle"))}</span>
            {kickTarget?.name ? (
              <>
                {" "}
                <span className="inline-block max-w-full">{kickTarget.name}</span>
              </>
            ) : null}
          </>
        }
        description={t("lesson.live.removeConfirmDescription")}
        confirmLabel={t("lesson.live.removeConfirm")}
        cancelLabel={t("lesson.live.removeCancel")}
        onConfirm={() => {
          if (kickTarget) kickStudent?.(kickTarget.studentId);
          setKickConfirmOpen(false);
        }}
      />
      <PresenterConfirm
        open={pendingConfirm === "finish"}
        onCancel={() => setPendingConfirm(null)}
        title={t("lesson.live.finishConfirmTitle")}
        description={`${t("lesson.live.finishConfirmStepPrefix")} ${currentPhase}/${TOTAL_PHASES} ${t("lesson.live.finishConfirmDescription")}`}
        confirmLabel={t("lesson.live.finishLessonShort")}
        cancelLabel={t("lesson.live.keepTeaching")}
        onConfirm={() => {
          setPendingConfirm(null);
          onFinishSession?.();
        }}
      />
      <PresenterConfirm
        open={pendingConfirm === "lobby"}
        onCancel={() => setPendingConfirm(null)}
        title={t("lesson.live.lobbyConfirmTitle")}
        description={t("lesson.live.lobbyConfirmDescription")}
        confirmLabel={t("lesson.interactive.returnLobby")}
        cancelLabel={t("lesson.live.keepTeaching")}
        onConfirm={() => {
          setPendingConfirm(null);
          requestPhaseChange(0);
        }}
      />
      <PresenterConfirm
        open={pendingConfirm === "previous"}
        onCancel={() => setPendingConfirm(null)}
        title={t("lesson.live.previousConfirmTitle")}
        description={t("lesson.live.previousConfirmDescription")}
        confirmLabel={t("lesson.live.previousConfirm")}
        cancelLabel={t("lesson.live.keepTeaching")}
        onConfirm={() => {
          setPendingConfirm(null);
          goToPreviousPhase();
        }}
      />
      {guideOverlay}
    </div>
  );
};
