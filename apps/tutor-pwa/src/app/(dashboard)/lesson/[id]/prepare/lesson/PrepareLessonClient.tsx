"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Chip } from "@/components/app/Atoms";
import { LessonBarActions } from "@/components/app/LessonShell";
import { useShellTitle } from "@/components/app/ShellContext";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { fill } from "../../_lib/articles";
import { LoadingAnnouncement, Skeleton } from "@/components/app/Skeletons";
import { getGamesByCategory } from "@/lib/liveLessonGames";
import {
  AnswerData,
  ArticleData,
  GamePhaseState,
  Participant,
  TutorSessionData,
} from "@/lib/lesson-types";
import TutorGuideOverlay from "./TutorGuideOverlay";
import { buildTutorGuideSteps } from "./TutorGuidePlan";
import { GAME_PHASES, LESSON_PHASE, TOTAL_LESSON_PHASES } from "@/lib/lessonPhases";

/**
 * The live presenter (PhaseManager + charts + teaching games) is by far the
 * heaviest part of this route. Load it as a separate client-only chunk so the
 * rehearsal page shell, title and guide controls arrive first; the stage
 * shows a skeleton until it is ready. PhaseManager itself is owned by the
 * live lesson (interactive/) and is consumed here unchanged.
 */
const PhaseManager = dynamic(
  () => import("../../interactive/PhaseManager").then((mod) => mod.PhaseManager),
  { ssr: false, loading: () => <StageSkeleton /> },
);

function StageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <LoadingAnnouncement />
      <Skeleton className="h-20 rounded-xl" />
      <div aria-hidden="true" className="mx-auto grid w-full max-w-6xl flex-1 gap-6 py-4 lg:grid-cols-[45%_1fr]">
        <Skeleton className="h-64 rounded-xl lg:h-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

type PreparationMode = "explore" | "guided";

export type PreparationArticle = ArticleData & {
  passage?: string;
  words?: any[];
  sentences?: any[];
  multipleChoiceQuestions?: any[];
  shortAnswerQuestions?: any[];
  content?: {
    words?: any[];
    sentences?: any[];
    comprehensionQuestions?: any[];
    shortAnswerQuestions?: any[];
    [key: string]: any;
  };
  [key: string]: any;
};

const TOTAL_PHASES = TOTAL_LESSON_PHASES;
const PREPARATION_MOCK_ANSWER_INTERVAL_MS = 1400;
const PREPARATION_MOCK_ANSWER_COUNT = 4;
const PREPARATION_MOCK_WAIT_BUFFER_MS = 800;
const PREPARATION_MOCK_GAME_RESULT_INTERVAL_MS = 1400;
const PREPARATION_MOCK_GAME_RESULT_COUNT = 4;

function normaliseArticle(article: PreparationArticle): ArticleData {
  const content = article.content || {};
  const words = Array.isArray(article.words) ? article.words : Array.isArray(content.words) ? content.words : [];
  const sentences = Array.isArray(article.sentences) ? article.sentences : Array.isArray(content.sentences) ? content.sentences : [];
  const multipleChoiceQuestions = Array.isArray(article.multipleChoiceQuestions)
    ? article.multipleChoiceQuestions
    : Array.isArray(content.comprehensionQuestions)
      ? content.comprehensionQuestions
      : [];
  const shortAnswerQuestions = Array.isArray(article.shortAnswerQuestions)
    ? article.shortAnswerQuestions
    : Array.isArray(content.shortAnswerQuestions)
      ? content.shortAnswerQuestions
      : [];

  return {
    ...article,
    id: String(article.id),
    title: String(article.title || "Untitled lesson"),
    words,
    sentences,
    multipleChoiceQuestions,
    shortAnswerQuestions,
    content: {
      ...content,
      words,
      sentences,
      comprehensionQuestions: multipleChoiceQuestions,
      shortAnswerQuestions,
    },
  } as ArticleData;
}

function buildInitialPhaseIndices() {
  return Object.fromEntries(Array.from({ length: TOTAL_PHASES }, (_, index) => [index + 1, 0]));
}

export default function PrepareLessonClient({
  classId,
  article,
  mode,
}: {
  classId: string;
  article: PreparationArticle;
  mode: PreparationMode;
}) {
  const router = useRouter();
  const articleData = useMemo(() => normaliseArticle(article), [article]);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [gameState, setGameState] = useState<GamePhaseState | null>(null);
  const [guideOpen, setGuideOpen] = useState(mode === "guided");
  const [guideIndex, setGuideIndex] = useState(0);
  const [preparationAnswersCompletePhase, setPreparationAnswersCompletePhase] = useState<number | null>(null);
  const [preparationGameVotesCompletePhase, setPreparationGameVotesCompletePhase] = useState<number | null>(null);
  const [preparationGameResultsCompletePhase, setPreparationGameResultsCompletePhase] = useState<number | null>(null);
  const [preparationAnswersReadyToEndPhase, setPreparationAnswersReadyToEndPhase] = useState<number | null>(null);
  const [preparationGuideReadyPhase, setPreparationGuideReadyPhase] = useState<number | null>(null);
  const [preparationGameResultsReadyFallbackPhase, setPreparationGameResultsReadyFallbackPhase] = useState<number | null>(null);
  const guideResultTransitionPhaseRef = useRef<number | null>(null);
  const participants: Participant[] = [];
  const allAnsweredData: AnswerData[] = [];
  const phaseSelectedIndices = useMemo(buildInitialPhaseIndices, []);

  const closePreparation = useCallback(() => {
    router.push(`/dashboard/classes/${classId}`);
  }, [classId, router]);

  const sessionData = useMemo<TutorSessionData>(() => ({
    sessionId: `preparation-${articleData.id}`,
    currentPhase,
    activeSentenceIndex,
    phaseSelectedIndices,
    articleData,
    pairs: null,
    gameState,
  }), [activeSentenceIndex, articleData, currentPhase, gameState, phaseSelectedIndices]);

  const changePhase = useCallback(async (phase: number): Promise<boolean> => {
    if (phase <= 0) {
      closePreparation();
      return true;
    }

    const nextPhase = Math.min(TOTAL_PHASES, phase);
    setCurrentPhase(nextPhase);
    if (!GAME_PHASES.includes(nextPhase)) setGameState(null);
    return true;
  }, [closePreparation]);

  const syncActiveSentence = useCallback((index: number) => {
    setActiveSentenceIndex(index);
  }, []);

  const handlePreparationAnswersComplete = useCallback((phase: number) => {
    setPreparationAnswersCompletePhase(phase);
  }, []);

  const handlePreparationAnswersReadyToEnd = useCallback((phase: number) => {
    setPreparationAnswersReadyToEndPhase(phase);
  }, []);

  const handlePreparationGameVotesComplete = useCallback((phase: number) => {
    setPreparationGameVotesCompletePhase(phase);
  }, []);

  const handlePreparationGameResultsComplete = useCallback((phase: number) => {
    setPreparationGameResultsCompletePhase(phase);
  }, []);

  const startGameVote = useCallback((phase?: number) => {
    const gamePhase = phase === LESSON_PHASE.SENTENCE_GAME
      ? LESSON_PHASE.SENTENCE_GAME
      : LESSON_PHASE.VOCABULARY_GAME;
    setGameState({
      phase: gamePhase,
      category: gamePhase === LESSON_PHASE.SENTENCE_GAME ? "sentence" : "vocabulary",
      status: "voting",
      votes: {},
      results: {},
    });
  }, []);

  const lockGameVote = useCallback(() => {
    setGameState((current) => {
      if (!current) return current;
      const selectedGame = getGamesByCategory(current.category).find((game) => game.enabled !== false);
      return {
        ...current,
        status: "ready",
        selectedGameId: selectedGame?.id,
      };
    });
  }, []);

  const startGameIntro = useCallback((options: { tutorialEnabled: boolean; teacherDemoEnabled: boolean }) => {
    setGameState((current) => {
      if (!current) return current;
      const nextStatus = options.teacherDemoEnabled
        ? "teacher_demo"
        : options.tutorialEnabled
          ? "tutorial"
          : "results";
      return {
        ...current,
        status: nextStatus,
        tutorialEnabled: options.tutorialEnabled,
        teacherDemoEnabled: options.teacherDemoEnabled,
      };
    });
  }, []);

  const advanceGameIntro = useCallback(() => {
    setGameState((current) => {
      if (!current) return current;
      if (current.status === "teacher_demo" && current.tutorialEnabled) {
        return { ...current, status: "tutorial" };
      }
      return { ...current, status: "results" };
    });
  }, []);

  useShellTitle(fill(t("lesson.preflow.rehearsal.barTitle"), { title: articleData.title }));

  const guideSteps = useMemo(() => buildTutorGuideSteps(articleData), [articleData]);

  useEffect(() => {
    if (!guideOpen) return;
    const step = guideSteps[guideIndex];
    if (step) setCurrentPhase(step.phase + 1);
  }, [guideIndex, guideOpen, guideSteps]);

  useEffect(() => {
    setPreparationAnswersCompletePhase(null);
    setPreparationAnswersReadyToEndPhase(null);
    setPreparationGameVotesCompletePhase(null);
    setPreparationGameResultsCompletePhase(null);
    setPreparationGuideReadyPhase(null);
    setPreparationGameResultsReadyFallbackPhase(null);
    guideResultTransitionPhaseRef.current = null;
  }, [currentPhase]);

  const openGuide = () => {
    setGuideIndex(0);
    setCurrentPhase(1);
    setGuideOpen(true);
  };

  const moveGuide = useCallback((direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(guideSteps.length - 1, guideIndex + direction));
    setGuideIndex(nextIndex);
  }, [guideIndex, guideSteps.length]);

  const currentGuideStep = guideSteps[guideIndex];
  const currentGuidePhase = currentGuideStep ? currentGuideStep.phase + 1 : null;
  const preparationGuideMockReady = Boolean(
    currentGuidePhase !== null &&
    (currentGuideStep?.waitForMockAnswers
      ? preparationAnswersCompletePhase === currentGuidePhase || preparationAnswersReadyToEndPhase === currentGuidePhase || preparationGuideReadyPhase === currentGuidePhase
      : currentGuideStep?.waitForMockVotes
        ? preparationGameVotesCompletePhase === currentGuidePhase
        : currentGuideStep?.waitForGameResults
          ? preparationGameResultsCompletePhase === currentGuidePhase || preparationGameResultsReadyFallbackPhase === currentGuidePhase
          : false),
  );
  const waitingForMockAnswers = Boolean(
    guideOpen &&
    currentGuideStep?.waitForMockAnswers &&
    !preparationGuideMockReady,
  );
  const waitingForMockVotes = Boolean(
    guideOpen &&
    currentGuideStep?.waitForMockVotes &&
    !preparationGuideMockReady,
  );
  const waitingForGameResults = Boolean(
    guideOpen &&
    currentGuideStep?.waitForGameResults &&
    !preparationGuideMockReady,
  );
  const waitingForPreparationMock = waitingForMockAnswers || waitingForMockVotes || waitingForGameResults;

  // Keep a small buffer after each mock sequence so the Lesson surface has
  // time to render its updated state before the Guide advances.
  useEffect(() => {
    if (!guideOpen || currentGuidePhase === null || !currentGuideStep) {
      return;
    }

    const isWaitingForAnswers = Boolean(currentGuideStep.waitForMockAnswers);
    const isWaitingForVotes = Boolean(currentGuideStep.waitForMockVotes);
    const isWaitingForResults = Boolean(currentGuideStep.waitForGameResults);
    if (!isWaitingForAnswers && !isWaitingForVotes && !isWaitingForResults) return;
    // The Lesson owns the vote state. Do not release this step on a timer;
    // otherwise the Guide can point at a disabled close-vote button while
    // the last mock votes are still arriving.
    if (isWaitingForVotes) return;

    const interval = isWaitingForResults
      ? PREPARATION_MOCK_GAME_RESULT_INTERVAL_MS
      : PREPARATION_MOCK_ANSWER_INTERVAL_MS;
    const count = isWaitingForResults
      ? PREPARATION_MOCK_GAME_RESULT_COUNT
      : PREPARATION_MOCK_ANSWER_COUNT;

    const timer = window.setTimeout(() => {
      if (isWaitingForAnswers) {
        setPreparationGuideReadyPhase(currentGuidePhase);
      } else {
        setPreparationGameResultsReadyFallbackPhase(currentGuidePhase);
      }
    }, interval * count + PREPARATION_MOCK_WAIT_BUFFER_MS);
    return () => window.clearTimeout(timer);
  }, [currentGuidePhase, currentGuideStep, guideOpen]);

  useEffect(() => {
    const isWaitingStep = Boolean(
      currentGuideStep?.waitForMockAnswers ||
      currentGuideStep?.waitForMockVotes ||
      currentGuideStep?.waitForGameResults,
    );
    if (
      !guideOpen ||
      !isWaitingStep ||
      currentGuidePhase === null ||
      !preparationGuideMockReady
    ) {
      return;
    }

    if (guideResultTransitionPhaseRef.current === guideIndex) return;
    guideResultTransitionPhaseRef.current = guideIndex;

    const timer = window.setTimeout(() => {
      setGuideIndex((previousIndex) =>
        Math.min(guideSteps.length - 1, previousIndex + 1),
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    currentGuidePhase,
    currentGuideStep?.waitForGameResults,
    currentGuideStep?.waitForMockAnswers,
    currentGuideStep?.waitForMockVotes,
    guideIndex,
    guideOpen,
    guideSteps.length,
    preparationGuideMockReady,
    waitingForPreparationMock,
  ]);

  const handleGuideNext = useCallback(() => {
    if (
      (currentGuideStep?.waitForMockAnswers || currentGuideStep?.waitForMockVotes || currentGuideStep?.waitForGameResults) &&
      !preparationGuideMockReady
    ) {
      return;
    }

    if (guideIndex >= guideSteps.length - 1) {
      setGuideOpen(false);
      return;
    }
    moveGuide(1);
  }, [
    currentGuideStep?.waitForGameResults,
    currentGuideStep?.waitForMockAnswers,
    currentGuideStep?.waitForMockVotes,
    guideIndex,
    guideSteps.length,
    moveGuide,
    preparationGuideMockReady,
  ]);

  return (
    <div className="flex min-h-[var(--lesson-viewport-h)] w-full flex-1 flex-col px-2 pt-2 sm:px-4 sm:pt-3 lg:px-6">
      <LessonBarActions>
        <Chip tone="brand" className="max-sm:hidden">
          {mode === "guided" ? t("lesson.preflow.rehearsal.modeGuided") : t("lesson.preflow.rehearsal.modeExplore")}
        </Chip>
        <Button
          type="button"
          variant={guideOpen ? "soft" : "outline"}
          size="sm"
          onClick={guideOpen ? () => setGuideOpen(false) : openGuide}
          aria-pressed={guideOpen}
          aria-label={guideOpen ? t("lesson.preflow.rehearsal.closeGuide") : t("lesson.preflow.rehearsal.openGuide")}
        >
          <Sparkles aria-hidden="true" />
          <span className="max-sm:hidden">
            {guideOpen ? t("lesson.preflow.rehearsal.closeGuide") : t("lesson.preflow.rehearsal.openGuide")}
          </span>
        </Button>
      </LessonBarActions>
      <PhaseManager
        currentPhase={currentPhase}
        participants={participants}
        totalAnswered={0}
        allAnsweredData={allAnsweredData}
        questionEnded={false}
        articleData={articleData}
        flagCounts={{}}
        sessionData={sessionData}
        changePhase={changePhase}
        syncActiveSentence={syncActiveSentence}
        endQuestion={() => undefined}
        startGameVote={startGameVote}
        lockGameVote={lockGameVote}
        startGameIntro={startGameIntro}
        advanceGameIntro={advanceGameIntro}
        bypassEmptyStudentGuard
        preparationMode
        preparationGuideMode={guideOpen}
        onPreparationAnswersReadyToEnd={handlePreparationAnswersReadyToEnd}
        onPreparationAnswersComplete={handlePreparationAnswersComplete}
        onPreparationGameVotesComplete={handlePreparationGameVotesComplete}
        onPreparationGameResultsComplete={handlePreparationGameResultsComplete}
        preparationMockAnswersStarted={mode === "guided" && (!guideOpen || Boolean(currentGuideStep?.waitForMockAnswers))}
        preparationFreeExplore={mode === "explore"}
        onFinishSession={closePreparation}
        guideOverlay={guideOpen && currentGuideStep ? (
          <TutorGuideOverlay
            step={currentGuideStep}
            stepIndex={guideIndex}
            totalSteps={guideSteps.length}
            onPrevious={() => moveGuide(-1)}
            canAdvance={!waitingForPreparationMock}
            onNext={handleGuideNext}
          />
        ) : null}
      />
    </div>
  );
}
