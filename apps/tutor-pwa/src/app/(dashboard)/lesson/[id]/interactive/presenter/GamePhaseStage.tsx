"use client";

/**
 * Game phases (10 vocabulary game, 14 sentence game): vote board → ready
 * (teacher demo / tutorial options) → teacher demo → tutorial → countdown →
 * live monitor → ranking. Teaching games are code-split (teachingGameRegistry).
 */
import React from "react";
import { Check, Gamepad2, GraduationCap, Lock, Scale, Timer, Trophy, Vote, WifiOff } from "lucide-react";
import { Chip, UserAvatar } from "@/components/app";
import { TeachingGameStage, isTeachingGameId } from "@/components/lesson/teachingGameRegistry";
import { buildLessonSentences, buildLessonVocabulary } from "@/lib/games/lessonContent";
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
  /** Results from students still in the room; a kicked student's stays on the board but does not count. */
  submittedCount: number;
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

/** Difference between the server's clock and this device's, from the last game state. */
function useServerClockOffset(serverNow?: number) {
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    if (serverNow) setOffset(serverNow - Date.now());
  }, [serverNow]);
  return offset;
}

/** The time on the server's clock, re-rendering every tickMs while a timer is on screen. */
function useServerNow(offset: number, tickMs: number | null) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!tickMs) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  return now + offset;
}

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Game rounds are 60 s. Past this, a phone that has not answered is probably stuck.
const GAME_ROUND_MS = 60_000;
const GAME_OVERTIME_MS = 75_000;
// Dragon Flight is the one round whose length comes from its words: one gate each, up to ten.
const DRAGON_FLIGHT_MS_PER_WORD = 5_000;
const DRAGON_FLIGHT_MAX_WORDS = 10;
// More students than fit one column on a projector go into a grid, so nobody scrolls during a game.
const ROSTER_GRID_FROM = 9;

/** How long a round lasts on the students' phones. */
export function gameRoundMs(gameId: string | null | undefined, wordCount: number) {
  if (gameId !== "dragon-flight") return GAME_ROUND_MS;
  return Math.max(1, Math.min(DRAGON_FLIGHT_MAX_WORDS, wordCount)) * DRAGON_FLIGHT_MS_PER_WORD;
}

export function buildGameContent(articleData: any, category: Category) {
  const articleWords = (articleData?.words || articleData?.content?.words || []) as any[];
  const articleSentences = (articleData?.sentences || articleData?.content?.sentences || []) as any[];
  const vocabulary = buildLessonVocabulary({ words: articleWords });
  const sentences = buildLessonSentences({
    sentences: articleSentences,
    translated_passage: articleData?.translated_passage ?? articleData?.content?.translated_passage,
  });
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

/**
 * Vote tally per game, enabled games first, then by votes, then catalogue order.
 * `leadingGameId` is the server's winner, so the board can never name a different
 * game from the one that starts. Preparation mode has no server and uses the order.
 */
export function rankGameVotes(
  category: Category,
  votes: Record<string, string>,
  participants: Participant[],
  leadingGameId?: string,
) {
  const games = getGamesByCategory(category);
  const voteCounts = games.map((game) => ({
    ...game,
    count: Object.values(votes).filter((gameId) => gameId === game.id).length,
    voters: participants.filter((p) => votes[p.studentId] === game.id).map((p) => p.name),
  }));
  const rankedGames = [...voteCounts].sort(
    (a, b) =>
      Number(b.enabled !== false) - Number(a.enabled !== false) ||
      Number(b.id === leadingGameId) - Number(a.id === leadingGameId) ||
      b.count - a.count ||
      games.findIndex((game) => game.id === a.id) - games.findIndex((game) => game.id === b.id),
  );
  const leadingGame = rankedGames.find((game) => game.enabled !== false) || rankedGames[0];
  const isTie =
    (leadingGame?.count ?? 0) > 0 &&
    rankedGames.filter((game) => game.enabled !== false && game.count === leadingGame?.count).length > 1;
  return { games, rankedGames, leadingGame, isTie, enabledCount: games.filter((g) => g.enabled !== false).length };
}

/** Results ranked with shared places for equal scores, and no place for a score of zero. */
export function rankGameResults<T extends { score: number }>(results: T[]): Array<T & { rank: number | null }> {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((result, index) => {
    if (result.score !== lastScore) {
      lastScore = result.score;
      lastRank = index + 1;
    }
    return { ...result, rank: result.score > 0 ? lastRank : null };
  });
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
  submittedCount,
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
  // Every socket event re-renders this. Fresh lists here would restart the demo under the tutor's hands.
  const content = React.useMemo(() => buildGameContent(articleData, category), [articleData, category]);
  const { rankedGames, leadingGame, isTie, enabledCount } = rankGameVotes(category, votes, participants, gameState?.leadingGameId);
  const totalVotes = Object.keys(votes).length;
  const clockOffset = useServerClockOffset(gameState?.serverNow);
  const serverNow = useServerNow(clockOffset, status === "countdown" ? 250 : status === "playing" ? 1000 : null);
  const countdownLeft = gameState?.countdownEndsAt ? Math.max(0, Math.ceil((gameState.countdownEndsAt - serverNow) / 1000)) : 0;
  const elapsedMs = status === "playing" && gameState?.playingStartedAt ? serverNow - gameState.playingStartedAt : null;
  const showScoreRanking = ["playing", "countdown", "in_game", "active", "results"].includes(status || "");
  const tour = (target: string) => (preparationMode ? target : undefined);

  // The dock button that started the demo keeps focus, so a stray Space would skip
  // the demo or start the game for everyone. Tab still reaches the dock from here.
  const demoStageRef = React.useRef<HTMLDivElement>(null);
  const showsDemo = status === "teacher_demo" || status === "tutorial";
  React.useEffect(() => {
    if (showsDemo) demoStageRef.current?.focus({ preventScroll: true });
  }, [showsDemo, status]);

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
        submittedCount={submittedCount}
        elapsedMs={elapsedMs}
        roundMs={gameRoundMs(selectedGame?.id, content.vocabulary.length)}
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
      <div ref={demoStageRef} tabIndex={-1} data-tour-target={tour(`phase-${currentPhase}-teacher-demo`)} className={cn("w-full outline-none", isFullscreen && "flex min-h-0 flex-1 flex-col")}>
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
      <div ref={demoStageRef} tabIndex={-1} data-tour-target={tour(`phase-${currentPhase}-tutorial`)} className={cn("w-full outline-none", isFullscreen && "flex min-h-0 flex-1 flex-col")}>
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
        isTie={isTie}
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
    <div data-tour-target={tour(`phase-${currentPhase}-game`)} className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className={cn("flex min-w-0 flex-1 flex-col", isFullscreen ? "min-h-0 overflow-hidden" : "gap-4")}>
        {header}
        {body}
      </div>
      {/* Below lg the roster stacks under the game so the tutor can still remove a stuck student. */}
      {!isFullscreen ? <div className="flex">{roster}</div> : null}
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
  isTie,
  totalVotes,
  participantsCount,
  enabledCount,
  isFullscreen,
  tourTarget,
}: {
  rankedGames: RankedGame[];
  leadingGame?: RankedGame;
  isTie: boolean;
  totalVotes: number;
  participantsCount: number;
  enabledCount: number;
  isFullscreen: boolean;
  tourTarget?: string;
}) {
  // Students see only playable games plus a teaser, so the board does the same.
  const others = rankedGames.filter((game) => game.id !== leadingGame?.id && game.enabled !== false);
  const lockedCount = rankedGames.filter((game) => game.id !== leadingGame?.id && game.enabled === false).length;
  const leaderLocked = leadingGame?.enabled === false;
  const noVotes = !leaderLocked && (leadingGame?.count ?? 0) === 0;
  const leaderHint = isTie ? t("lesson.live.voteTieHint") : noVotes ? t("lesson.live.voteDefaultHint") : null;
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
            <Chip tone="brand" icon={isTie ? Scale : noVotes ? Vote : Trophy} className="bg-surface">
              {leaderLocked
                ? t("lesson.interactive.locked")
                : noVotes
                  ? t("lesson.interactive.noVotesYet")
                  : isTie
                    ? t("lesson.live.voteTieChip")
                    : t("lesson.interactive.mostVoted")}
            </Chip>
          </span>
        </div>
        <div className="flex flex-col gap-2 p-4">
          <h3 className="text-2xl font-semibold leading-tight text-fg">{leadingGame?.title || t("lesson.interactive.waitingVotes")}</h3>
          <p className="line-clamp-2 text-sm text-fg-muted">
            {leaderLocked ? t("lesson.interactive.gamesComingSoon") : leadingGame?.description || t("lesson.interactive.gameVoteStageHelp")}
          </p>
          {leaderHint ? <p className="text-sm font-medium text-fg">{leaderHint}</p> : null}
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
            return (
              <li key={game.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface p-2">
                <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md">
                  <GameCover src={game.cover} alt="" className="size-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-base font-medium text-fg">{game.title}</span>
                    <span className="shrink-0 text-base font-semibold tabular-nums text-fg">{game.count}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fill-muted">
                    <span className="block h-full rounded-full bg-brand-vivid transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </span>
                </span>
              </li>
            );
          })}
          {lockedCount > 0 ? (
            <li className="flex items-center gap-2 rounded-lg border border-dashed border-hairline-strong px-3 py-2 text-sm text-fg-muted">
              <Lock aria-hidden="true" className="size-4 shrink-0" />
              +{lockedCount} {t("lesson.live.moreGamesSuffix")}
            </li>
          ) : null}
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
  submittedCount,
  elapsedMs,
  roundMs,
  isFullscreen,
  tourTarget,
}: {
  status?: string;
  countdownLeft: number;
  selectedGameTitle?: string;
  results: GamePhaseState["results"][string][];
  participants: Participant[];
  totalParticipants: number;
  submittedCount: number;
  elapsedMs: number | null;
  roundMs: number;
  isFullscreen: boolean;
  tourTarget?: string;
}) {
  const participantById = new Map(participants.map((participant) => [participant.studentId, participant]));
  const submittedIds = new Set(results.map((r) => r.studentId));
  const rows = [
    ...rankGameResults(results).map((result) => ({
      studentId: result.studentId,
      name: result.name,
      score: result.score,
      rank: result.rank,
      correct: result.correct,
      total: result.total,
      durationMs: result.durationMs,
      pictureUrl: participantById.get(result.studentId)?.pictureUrl,
      isSubmitted: true,
      isOffline: false,
    })),
    ...participants
      .filter((p) => !submittedIds.has(p.studentId))
      .map((p) => ({
        studentId: p.studentId,
        name: p.name,
        score: 0,
        rank: null as number | null,
        correct: undefined as number | undefined,
        total: undefined as number | undefined,
        durationMs: undefined as number | undefined,
        pictureUrl: p.pictureUrl,
        isSubmitted: false,
        isOffline: Boolean(p.offlineSince),
      })),
  ];
  const topScore = Math.max(...results.map((r) => r.score), 0);
  // Only for bar width: the number on screen is the real top score.
  const barMax = Math.max(topScore, 1);
  const isResults = status === "results";
  // Nobody scored: nothing to celebrate, and no order to put on a podium.
  const podium = topScore > 0 ? [rows[1], rows[0], rows[2]].filter((row) => row?.isSubmitted && row.score > 0) : [];
  const useGrid = rows.length >= ROSTER_GRID_FROM;
  const roundIsOn = elapsedMs !== null && elapsedMs < roundMs;

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
            {selectedGameTitle || t("lesson.interactive.gameSelectedFallback")} · {submittedCount} / {totalParticipants}{" "}
            {t("lesson.interactive.studentsSubmittedSuffix")}
          </p>
        </div>
        {status === "countdown" ? (
          <div role="timer" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-bg px-5 py-3">
            <Timer aria-hidden="true" className="size-7 text-warning-fg" />
            <p className="text-4xl font-bold tabular-nums text-warning-fg">{countdownLeft}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-stretch gap-3">
            {elapsedMs !== null ? (
              <div
                role="timer"
                className={cn(
                  "rounded-xl border px-5 py-3 text-center",
                  elapsedMs > GAME_OVERTIME_MS ? "border-warning-border bg-warning-bg" : "border-hairline bg-surface-muted",
                )}
              >
                <p className={cn("text-3xl font-bold tabular-nums", elapsedMs > GAME_OVERTIME_MS ? "text-warning-fg" : "text-fg")}>
                  {formatElapsed(roundIsOn ? roundMs - elapsedMs + 999 : elapsedMs)}
                </p>
                <p className={cn("text-sm", elapsedMs > GAME_OVERTIME_MS ? "font-medium text-warning-fg" : "text-fg-muted")}>
                  {elapsedMs > GAME_OVERTIME_MS
                    ? t("lesson.live.elapsedOverHint")
                    : roundIsOn
                      ? t("lesson.live.timeLeftLabel")
                      : t("lesson.live.elapsedLabel")}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-hairline bg-surface-muted px-5 py-3 text-center">
              <p className="text-3xl font-bold tabular-nums text-fg">{results.length > 0 ? topScore : "-"}</p>
              <p className="text-sm text-fg-muted">{t("lesson.interactive.topScore")}</p>
            </div>
          </div>
        )}
      </div>

      <div className={cn("grid min-h-0 flex-1 gap-4", podium.length > 0 ? "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "")}>
        {podium.length > 0 ? (
          <div className="grid grid-cols-3 items-end gap-3 rounded-xl bg-surface-muted p-4">
            {[2, 1, 3].map((place) => {
              const row = rows[place - 1];
              if (!row?.isSubmitted || row.score <= 0) return <div key={place} />;
              return (
                <div key={row.studentId} className="game-rank-card flex min-w-0 flex-col items-center gap-1.5">
                  <UserAvatar name={row.name} src={row.pictureUrl} size="lg" className={place === 1 ? "ring-4 ring-brand-soft-border" : undefined} />
                  <p className="max-w-full truncate text-base font-semibold text-fg">{row.name}</p>
                  <p className={cn("font-bold tabular-nums", place === 1 ? "text-4xl text-brand-fg" : "text-2xl text-fg")}>{row.score}</p>
                  <div
                    className={cn(
                      "flex w-full items-start justify-center rounded-t-lg pt-1.5 text-2xl font-bold",
                      place === 1 ? "h-24 bg-brand-solid text-on-brand" : place === 2 ? "h-16 bg-surface text-fg-muted" : "h-12 bg-surface text-fg-muted",
                    )}
                  >
                    {row.rank ?? place}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <ol
          className={cn(
            "min-h-0 gap-2 overflow-y-auto pr-1",
            useGrid
              ? "grid content-start [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]"
              : "flex flex-col",
          )}
        >
          {rows.map((row, index) => {
            const pct = row.isSubmitted && row.score > 0 ? Math.max(6, Math.round((row.score / barMax) * 100)) : 0;
            return (
              <li
                key={row.studentId}
                className={cn(
                  "game-rank-card flex items-center gap-3 rounded-lg border px-3",
                  useGrid ? "py-1.5" : "py-2.5",
                  row.rank === 1 ? "border-brand-soft-border bg-brand-soft" : "border-hairline bg-surface",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="w-6 shrink-0 text-center text-base font-semibold tabular-nums text-fg-subtle">{row.rank ?? "–"}</span>
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
                        {typeof row.correct === "number" && (row.correct > 0 || (row.total ?? 0) > 1)
                          ? ` · ${row.correct}/${row.total} ${t("lesson.interactive.correctUnit")}`
                          : ""}
                        {typeof row.durationMs === "number" ? ` · ${(row.durationMs / 1000).toFixed(1)} ${t("lesson.live.secondsUnit")}` : ""}
                      </p>
                    </>
                  ) : isResults ? (
                    <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{t("lesson.live.statusNotPlayed")}</p>
                  ) : row.isOffline ? (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-warning-fg">
                      <WifiOff aria-hidden="true" className="size-3.5" />
                      {t("lesson.live.statusOffline")}
                    </p>
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
