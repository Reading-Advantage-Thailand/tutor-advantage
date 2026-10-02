"use client";

/**
 * Game phases (10 vocabulary game, 14 sentence game): vote board → ready
 * (teacher demo / tutorial options) → teacher demo → tutorial → countdown →
 * live monitor → ranking. Teaching games are code-split (teachingGameRegistry).
 */
import React from "react";
import { Check, Gamepad2, GraduationCap, Lock, Timer, Trophy, Vote } from "lucide-react";
import { Chip, UserAvatar } from "@/components/app";
import { TeachingGameStage, isTeachingGameId } from "@/components/lesson/teachingGameRegistry";
import type { GamePhaseState, Participant } from "@/lib/lesson-types";
import { getGameById, getGamesByCategory, getGameTutorial } from "@/lib/liveLessonGames";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { StageEyebrow, StagePanel } from "./primitives";

type Category = "vocabulary" | "sentence";

export interface GamePhaseStageProps {
  category: Category;
  currentPhase: number;
  gameState: GamePhaseState | null;
  participants: Participant[];
  totalParticipants: number;
  articleData?: any;
  isFullscreen: boolean;
  preparationMode?: boolean;
  teacherDemoEnabled: boolean;
  onTeacherDemoEnabledChange: (value: boolean) => void;
  tutorialEnabled: boolean;
  onTutorialEnabledChange: (value: boolean) => void;
  teacherDemoAnswer: string | null;
  onTeacherDemoAnswer: (answer: string) => void;
  potionRushTeacherDemoCompleted: boolean;
  onPotionRushTeacherDemoComplete: () => void;
  roster: React.ReactNode;
}

/** Re-render every 250ms while a countdown is running. */
function useCountdownSeconds(endsAt?: number, active = false) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active || !endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active, endsAt]);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
}

export function buildGameContent(articleData: any, category: Category) {
  const articleWords = (articleData?.words || articleData?.content?.words || []) as any[];
  const articleSentences = (articleData?.sentences || articleData?.content?.sentences || []) as any[];
  const vocabulary = articleWords
    .map((word, index) => ({
      term: String(word?.vocabulary || word?.word || word?.text || `Word ${index + 1}`),
      translation: String(word?.definition?.th || word?.translation || word?.meaning || word?.definition?.en || ""),
    }))
    .filter((word) => word.term && word.translation);
  const sentences = articleSentences
    .map((sentence, index) => ({
      term: typeof sentence === "string" ? sentence : String(sentence?.sentences || sentence?.sentence || sentence?.text || `Sentence ${index + 1}`),
      translation:
        typeof sentence === "string"
          ? sentence
          : String(sentence?.translation || sentence?.meaning || sentence?.sentences || sentence?.text || ""),
    }))
    .filter((s) => s.term);
  const demoWord = articleWords[0];
  const demoPrompt =
    category === "vocabulary" ? demoWord?.vocabulary || demoWord?.word || demoWord?.text || "example" : "เรียงคำให้เป็นประโยคที่ถูกต้อง";
  const demoCorrectAnswer =
    category === "vocabulary"
      ? demoWord?.definition?.th || demoWord?.translation || demoWord?.meaning || demoPrompt
      : String(articleSentences[0]?.sentences || articleSentences[0]?.text || articleSentences[0] || "Students read together");
  const demoAnswers = Array.from(
    new Set(
      [
        demoCorrectAnswer,
        ...(category === "vocabulary"
          ? articleWords.slice(1, 3).map((word) => word?.definition?.th || word?.translation || word?.meaning || word?.vocabulary)
          : [String(demoCorrectAnswer).split(" ").reverse().join(" "), "Teacher together read students"]),
      ].filter(Boolean),
    ),
  ).slice(0, 3) as string[];
  return { vocabulary, sentences, demoPrompt: String(demoPrompt), demoCorrectAnswer: String(demoCorrectAnswer), demoAnswers };
}

/** Vote tally per game, enabled games first, then by votes, then catalogue order. */
export function rankGameVotes(category: Category, votes: Record<string, string>, participants: Participant[]) {
  const games = getGamesByCategory(category);
  const voteCounts = games.map((game) => ({
    ...game,
    count: Object.values(votes).filter((gameId) => gameId === game.id).length,
    voters: participants.filter((p) => votes[p.studentId] === game.id).map((p) => p.name),
  }));
  const rankedGames = [...voteCounts].sort(
    (a, b) =>
      Number(b.enabled !== false) - Number(a.enabled !== false) ||
      b.count - a.count ||
      games.findIndex((game) => game.id === a.id) - games.findIndex((game) => game.id === b.id),
  );
  const leadingGame = rankedGames.find((game) => game.enabled !== false) || rankedGames[0];
  return { games, rankedGames, leadingGame, enabledCount: games.filter((g) => g.enabled !== false).length };
}

const STATUS_KEYS: Record<string, Parameters<typeof t>[0]> = {
  voting: "lesson.live.gameStatusVoting",
  ready: "lesson.live.gameStatusReady",
  teacher_demo: "lesson.live.gameStatusTeacherDemo",
  tutorial: "lesson.live.gameStatusTutorial",
  countdown: "lesson.live.gameStatusCountdown",
  playing: "lesson.live.gameStatusPlaying",
  results: "lesson.live.gameStatusResults",
};

export function GamePhaseStage({
  category,
  currentPhase,
  gameState,
  participants,
  totalParticipants,
  articleData,
  isFullscreen,
  preparationMode = false,
  teacherDemoEnabled,
  onTeacherDemoEnabledChange,
  tutorialEnabled,
  onTutorialEnabledChange,
  teacherDemoAnswer,
  onTeacherDemoAnswer,
  potionRushTeacherDemoCompleted,
  onPotionRushTeacherDemoComplete,
  roster,
}: GamePhaseStageProps) {
  const status = gameState?.status;
  const votes = gameState?.votes || {};
  const results = Object.values(gameState?.results || {}).sort((a, b) => b.score - a.score);
  const selectedGame = getGameById(gameState?.selectedGameId);
  const content = buildGameContent(articleData, category);
  const { rankedGames, leadingGame, enabledCount } = rankGameVotes(category, votes, participants);
  const totalVotes = Object.keys(votes).length;
  const countdownLeft = useCountdownSeconds(gameState?.countdownEndsAt, status === "countdown");
  const showScoreRanking = ["playing", "countdown", "in_game", "active", "results"].includes(status || "");
  const tour = (target: string) => (preparationMode ? target : undefined);

  const statusLine = status
    ? status === "countdown"
      ? `${t("lesson.live.gameStatusCountdown")} ${countdownLeft} ${t("lesson.live.secondsUnit")}`
      : status === "playing"
        ? `${t("lesson.live.gameStatusPlaying")} ${selectedGame?.title || gameState?.selectedGameId || ""}`
        : t(STATUS_KEYS[status] ?? "lesson.live.gameStatusVoting")
    : t("lesson.live.gameStatusIdle");

  const header = (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", isFullscreen && "hidden")}>
      <div className="min-w-0">
        <StageEyebrow icon={Gamepad2}>
          {category === "vocabulary" ? t("lesson.live.vocabularyGame") : t("lesson.live.sentenceGame")}
        </StageEyebrow>
        <p className="mt-0.5 text-xl font-semibold text-fg xl:text-2xl">{statusLine}</p>
      </div>
      {selectedGame ? (
        <Chip tone="brand" icon={Check}>
          {t("lesson.interactive.gameSelectedFallback")}: {selectedGame.title}
        </Chip>
      ) : null}
    </div>
  );

  const teachingStage = (mode: "teacher" | "tutorial") =>
    isTeachingGameId(selectedGame?.id) ? (
      <TeachingGameStage
        gameId={selectedGame!.id}
        mode={mode}
        vocabulary={content.vocabulary}
        sentences={content.sentences}
        fullscreen={isFullscreen}
        potionRushTeacherDemoCompleted={potionRushTeacherDemoCompleted}
        onPotionRushTeacherDemoComplete={onPotionRushTeacherDemoComplete}
      />
    ) : null;

  let body: React.ReactNode = null;

  if (showScoreRanking) {
    body = (
      <GameRanking
        status={status}
        countdownLeft={countdownLeft}
        selectedGameTitle={selectedGame?.title}
        results={results}
        participants={participants}
        totalParticipants={totalParticipants}
        isFullscreen={isFullscreen}
        tourTarget={tour("game-results-summary")}
      />
    );
  } else if (status === "ready") {
    body = (
      <div className={isFullscreen ? "flex flex-1 items-center justify-center px-6 pb-32" : ""}>
        <StagePanel as="div" data-tour-target={tour("game-ready-panel")} className={cn("p-5", isFullscreen && "w-full max-w-5xl")}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-xl">
              <StageEyebrow icon={Vote}>{t("lesson.live.voteClosed")}</StageEyebrow>
              <h3 className="mt-1 text-2xl font-semibold text-fg">
                {t("lesson.live.prepareBeforeGame")} {selectedGame?.title}
              </h3>
              <p className="mt-2 text-base text-fg-muted">{t("lesson.live.prepareBeforeGameHelp")}</p>
            </div>
            <div className="grid gap-3 xl:min-w-[360px]">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-muted p-4">
                <span className="flex items-center gap-3">
                  <GraduationCap aria-hidden="true" className="size-6 text-icon-amber" />
                  <span>
                    <span className="block text-base font-semibold text-fg">{t("lesson.live.teacherDemoOption")}</span>
                    <span className="block text-sm text-fg-muted">{t("lesson.live.teacherDemoOptionHelp")}</span>
                  </span>
                </span>
                <input
                  data-tour-target={tour("game-teacher-demo-toggle")}
                  type="checkbox"
                  checked={teacherDemoEnabled}
                  onChange={(event) => onTeacherDemoEnabledChange(event.target.checked)}
                  className="size-5 shrink-0 accent-brand-600"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-muted p-4">
                <span className="flex items-center gap-3">
                  <Gamepad2 aria-hidden="true" className="size-6 text-icon-blue" />
                  <span>
                    <span className="block text-base font-semibold text-fg">{t("lesson.live.tutorialOption")}</span>
                    <span className="block text-sm text-fg-muted">{t("lesson.live.tutorialOptionHelp")}</span>
                  </span>
                </span>
                <input
                  data-tour-target={tour("game-tutorial-toggle")}
                  type="checkbox"
                  checked={tutorialEnabled}
                  onChange={(event) => onTutorialEnabledChange(event.target.checked)}
                  className="size-5 shrink-0 accent-brand-600"
                />
              </label>
            </div>
          </div>
        </StagePanel>
      </div>
    );
  } else if (status === "teacher_demo") {
    body = (
      <div data-tour-target={tour(`phase-${currentPhase}-teacher-demo`)} className={cn("w-full", isFullscreen && "flex min-h-0 flex-1 flex-col")}>
        {teachingStage("teacher") ?? (
          <StagePanel as="div" className="grid gap-6 p-6 xl:grid-cols-[0.8fr_1.2fr] xl:items-center">
            <div>
              <Chip tone="warning" icon={GraduationCap}>
                {t("lesson.live.teacherDemoBadge")}
              </Chip>
              <h3 className="mt-3 text-2xl font-semibold text-fg">{t("lesson.live.teacherDemoTitle")}</h3>
              <p className="mt-2 text-base text-fg-muted">{t("lesson.live.teacherDemoHelp")}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-muted p-5">
              <p className="text-sm text-fg-muted">{t("lesson.live.example")}</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{content.demoPrompt}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {content.demoAnswers.map((answer) => {
                  const selected = teacherDemoAnswer === answer;
                  const correct = answer === content.demoCorrectAnswer;
                  return (
                    <button
                      key={answer}
                      type="button"
                      onClick={() => onTeacherDemoAnswer(answer)}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left text-base font-semibold transition-colors",
                        selected
                          ? correct
                            ? "border-success-border bg-success-bg text-success-fg"
                            : "border-danger-border bg-danger-bg text-danger-fg"
                          : "border-hairline bg-surface text-fg hover:bg-press",
                      )}
                    >
                      {answer}
                    </button>
                  );
                })}
              </div>
              {teacherDemoAnswer ? (
                <p className={cn("mt-4 text-base font-semibold", teacherDemoAnswer === content.demoCorrectAnswer ? "text-success-fg" : "text-danger-fg")}>
                  {teacherDemoAnswer === content.demoCorrectAnswer ? t("lesson.live.demoCorrect") : t("lesson.live.demoTryAgain")}
                </p>
              ) : null}
            </div>
          </StagePanel>
        )}
      </div>
    );
  } else if (status === "tutorial") {
    const tutorialSteps = getGameTutorial(gameState?.selectedGameId, category);
    body = (
      <div data-tour-target={tour(`phase-${currentPhase}-tutorial`)} className={cn("w-full", isFullscreen && "flex min-h-0 flex-1 flex-col")}>
        {teachingStage("tutorial") ?? (
          <StagePanel as="div" className="p-6">
            <StageEyebrow icon={Gamepad2}>{t("lesson.live.tutorialBadge")}</StageEyebrow>
            <h3 className="mt-1 text-2xl font-semibold text-fg">
              {t("lesson.live.howToPlay")} {selectedGame?.title}
            </h3>
            <ol className="mt-5 grid gap-3 lg:grid-cols-3">
              {tutorialSteps.map((step, index) => (
                <li key={step} className="rounded-xl border border-hairline bg-surface-muted p-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-solid text-lg font-bold text-on-brand">{index + 1}</span>
                  <p className="mt-3 text-base font-medium leading-relaxed text-fg">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-fg-muted">{t("lesson.live.tutorialOnPhones")}</p>
          </StagePanel>
        )}
      </div>
    );
  } else if (status === "voting") {
    body = (
      <GameVoteBoard
        rankedGames={rankedGames}
        leadingGame={leadingGame}
        totalVotes={totalVotes}
        participantsCount={participants.length}
        enabledCount={enabledCount}
        isFullscreen={isFullscreen}
        tourTarget={tour("game-vote-options")}
      />
    );
  } else if (!status) {
    body = (
      <StagePanel as="div" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Vote aria-hidden="true" className="size-10 text-brand-fg" />
        <p className="text-xl font-semibold text-fg">{t("lesson.live.gameIdleTitle")}</p>
        <p className="max-w-lg text-base text-fg-muted">{t("lesson.live.gameIdleHelp")}</p>
      </StagePanel>
    );
  }

  return (
    <div data-tour-target={tour(`phase-${currentPhase}-game`)} className="flex min-h-0 flex-1 gap-4">
      <div className={cn("flex min-w-0 flex-1 flex-col", isFullscreen ? "min-h-0 overflow-hidden" : "gap-4")}>
        {header}
        {body}
      </div>
      {!isFullscreen ? <div className="hidden lg:flex">{roster}</div> : null}
    </div>
  );
}

type RankedGame = ReturnType<typeof rankGameVotes>["rankedGames"][number];

function GameCover({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} /> : <span className={cn("bg-fill-muted", className)} />;
}

function GameVoteBoard({
  rankedGames,
  leadingGame,
  totalVotes,
  participantsCount,
  enabledCount,
  isFullscreen,
  tourTarget,
}: {
  rankedGames: RankedGame[];
  leadingGame?: RankedGame;
  totalVotes: number;
  participantsCount: number;
  enabledCount: number;
  isFullscreen: boolean;
  tourTarget?: string;
}) {
  const others = rankedGames.filter((game) => game.id !== leadingGame?.id);
  const leaderLocked = leadingGame?.enabled === false;
  return (
    <div data-tour-target={tourTarget} className={cn("grid min-h-0 gap-4 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]", isFullscreen && "flex-1")}>
      <StagePanel as="div" className="relative flex min-h-[340px] flex-col overflow-hidden">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-fill-muted md:aspect-auto md:min-h-0 md:flex-1">
          {leadingGame ? <GameCover src={leadingGame.cover} alt={leadingGame.title} className="absolute inset-0 size-full" /> : null}
          {leaderLocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
              <Lock aria-hidden="true" className="size-8" />
              <p className="text-lg font-semibold">{t("lesson.interactive.comingSoon")}</p>
            </div>
          ) : null}
          <span className="absolute left-3 top-3">
            <Chip tone="brand" icon={Trophy} className="bg-surface">
              {leaderLocked ? t("lesson.interactive.locked") : t("lesson.interactive.mostVoted")}
            </Chip>
          </span>
        </div>
        <div className="flex flex-col gap-2 p-4">
          <h3 className="text-2xl font-semibold leading-tight text-fg">{leadingGame?.title || t("lesson.interactive.waitingVotes")}</h3>
          <p className="line-clamp-2 text-sm text-fg-muted">
            {leaderLocked ? t("lesson.interactive.gamesComingSoon") : leadingGame?.description || t("lesson.interactive.gameVoteStageHelp")}
          </p>
          <div className="flex items-end justify-between gap-3 pt-1">
            <p className="text-5xl font-bold tabular-nums leading-none text-fg">
              {leadingGame?.count || 0}
              <span className="ml-1.5 text-base font-medium text-fg-muted">{t("lesson.interactive.votes")}</span>
            </p>
            <p className="min-w-0 truncate text-right text-sm text-fg-muted" title={leadingGame?.voters.join(", ")}>
              {leadingGame?.voters.length ? leadingGame.voters.join(", ") : t("lesson.interactive.noVotesYet")}
            </p>
          </div>
        </div>
      </StagePanel>

      <StagePanel as="div" className="flex min-h-0 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-fg">{t("lesson.interactive.gameVoteStageTitle")}</p>
            <p className="text-sm text-fg-muted">
              {enabledCount ? t("lesson.live.voteBoardHelp") : t("lesson.interactive.gamesComingSoon")}
            </p>
          </div>
          <p className="shrink-0 text-right text-sm text-fg-muted">
            <span className="block text-3xl font-bold tabular-nums text-fg">
              {totalVotes}
              <span className="text-lg font-medium text-fg-muted">/{participantsCount}</span>
            </span>
            {t("lesson.live.studentsVoted")}
          </p>
        </div>
        <ul className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1 xl:grid-cols-2">
          {others.map((game) => {
            const pct = participantsCount ? Math.round((game.count / participantsCount) * 100) : 0;
            const locked = game.enabled === false;
            return (
              <li
                key={game.id}
                className={cn("flex items-center gap-3 rounded-lg border border-hairline p-2", locked ? "bg-surface-muted opacity-60" : "bg-surface")}
              >
                <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md">
                  <GameCover src={game.cover} alt="" className="size-full" />
                  {locked ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                      <Lock aria-hidden="true" className="size-4" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-base font-medium text-fg">{game.title}</span>
                    <span className="shrink-0 text-base font-semibold tabular-nums text-fg">
                      {locked ? <span className="text-sm font-normal text-fg-subtle">{t("lesson.interactive.comingSoon")}</span> : game.count}
                    </span>
                  </span>
                  {!locked ? (
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fill-muted">
                      <span className="block h-full rounded-full bg-brand-vivid transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </StagePanel>
    </div>
  );
}

function GameRanking({
  status,
  countdownLeft,
  selectedGameTitle,
  results,
  participants,
  totalParticipants,
  isFullscreen,
  tourTarget,
}: {
  status?: string;
  countdownLeft: number;
  selectedGameTitle?: string;
  results: GamePhaseState["results"][string][];
  participants: Participant[];
  totalParticipants: number;
  isFullscreen: boolean;
  tourTarget?: string;
}) {
  const participantById = new Map(participants.map((participant) => [participant.studentId, participant]));
  const submittedIds = new Set(results.map((r) => r.studentId));
  const rows = [
    ...results.map((result) => ({
      studentId: result.studentId,
      name: result.name,
      score: result.score,
      correct: result.correct,
      total: result.total,
      durationMs: result.durationMs,
      pictureUrl: participantById.get(result.studentId)?.pictureUrl,
      isSubmitted: true,
    })),
    ...participants
      .filter((p) => !submittedIds.has(p.studentId))
      .map((p) => ({
        studentId: p.studentId,
        name: p.name,
        score: 0,
        correct: undefined as number | undefined,
        total: undefined as number | undefined,
        durationMs: undefined as number | undefined,
        pictureUrl: p.pictureUrl,
        isSubmitted: false,
      })),
  ];
  const topScore = Math.max(...results.map((r) => r.score), 1);
  const isResults = status === "results";
  const podium = [rows[1], rows[0], rows[2]].filter((row) => row?.isSubmitted);

  return (
    <StagePanel as="div" data-tour-target={tourTarget} className={cn("flex min-h-0 flex-col p-5", isFullscreen && "flex-1")}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <StageEyebrow icon={isResults ? Trophy : Gamepad2}>
            {isResults ? t("lesson.interactive.gameRankingTitle") : t("lesson.live.liveMonitor")}
          </StageEyebrow>
          <h3 className="mt-0.5 text-2xl font-semibold text-fg">
            {isResults ? t("lesson.interactive.gameRankingHeading") : `${t("lesson.live.studentsPlaying")} ${selectedGameTitle || ""}`}
          </h3>
          <p className="mt-0.5 text-base text-fg-muted">
            {selectedGameTitle || t("lesson.interactive.gameSelectedFallback")} · {results.length} / {totalParticipants}{" "}
            {t("lesson.interactive.studentsSubmittedSuffix")}
          </p>
        </div>
        {status === "countdown" ? (
          <div role="timer" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-bg px-5 py-3">
            <Timer aria-hidden="true" className="size-7 text-warning-fg" />
            <p className="text-4xl font-bold tabular-nums text-warning-fg">{countdownLeft}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-surface-muted px-5 py-3 text-center">
            <p className="text-3xl font-bold tabular-nums text-fg">{results.length > 0 ? topScore : "-"}</p>
            <p className="text-sm text-fg-muted">{t("lesson.interactive.topScore")}</p>
          </div>
        )}
      </div>

      <div className={cn("grid min-h-0 flex-1 gap-4", podium.length > 0 ? "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "")}>
        {podium.length > 0 ? (
          <div className="grid grid-cols-3 items-end gap-3 rounded-xl bg-surface-muted p-4">
            {[2, 1, 3].map((rank) => {
              const row = rows[rank - 1];
              if (!row?.isSubmitted) return <div key={rank} />;
              return (
                <div key={row.studentId} className="game-rank-card flex min-w-0 flex-col items-center gap-1.5">
                  <UserAvatar name={row.name} src={row.pictureUrl} size="lg" className={rank === 1 ? "ring-4 ring-brand-soft-border" : undefined} />
                  <p className="max-w-full truncate text-base font-semibold text-fg">{row.name}</p>
                  <p className={cn("font-bold tabular-nums", rank === 1 ? "text-4xl text-brand-fg" : "text-2xl text-fg")}>{row.score}</p>
                  <div
                    className={cn(
                      "flex w-full items-start justify-center rounded-t-lg pt-1.5 text-2xl font-bold",
                      rank === 1 ? "h-24 bg-brand-solid text-on-brand" : rank === 2 ? "h-16 bg-surface text-fg-muted" : "h-12 bg-surface text-fg-muted",
                    )}
                  >
                    {rank}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {rows.map((row, index) => {
            const pct = row.isSubmitted ? Math.max(6, Math.round((row.score / topScore) * 100)) : 0;
            return (
              <li
                key={row.studentId}
                className={cn(
                  "game-rank-card flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  row.isSubmitted && index === 0 ? "border-brand-soft-border bg-brand-soft" : "border-hairline bg-surface",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="w-6 shrink-0 text-center text-base font-semibold tabular-nums text-fg-subtle">{row.isSubmitted ? index + 1 : "–"}</span>
                <UserAvatar name={row.name} src={row.pictureUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-lg font-semibold text-fg">{row.name}</p>
                    <p className="text-2xl font-bold tabular-nums text-fg">{row.isSubmitted ? row.score : ""}</p>
                  </div>
                  {row.isSubmitted ? (
                    <>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill-muted">
                        <div className="h-full rounded-full bg-brand-vivid transition-[width] duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-[0.8125rem] text-fg-muted">
                        <span className="font-medium text-success-fg">{t("lesson.live.submittedCheck")}</span>
                        {typeof row.correct === "number" ? ` · ${row.correct}/${row.total} ${t("lesson.interactive.correctUnit")}` : ""}
                        {typeof row.durationMs === "number" ? ` · ${(row.durationMs / 1000).toFixed(1)} ${t("lesson.live.secondsUnit")}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-muted">
                      <span aria-hidden="true" className="size-2 rounded-full bg-info-solid motion-safe:animate-pulse" />
                      {status === "countdown" ? t("lesson.live.getReady") : t("lesson.live.playingOnPhone")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </StagePanel>
  );
}
