"use client";

/**
 * Client side of /dev/presenter-preview (dev only). Renders the real lobby
 * and presenter components with fixture students (local seed names and the
 * long-name stress string from /dev/ui-kit), so their layouts can be checked
 * without opening a live room. Nothing here talks to the server.
 */
import React from "react";
import { BarChart3, Settings2, Users, type LucideIcon } from "lucide-react";
import { PhaseManager } from "@/app/(dashboard)/lesson/[id]/interactive/PhaseManager";
import { LobbyFinishing, LobbySkeleton, LobbyView } from "@/app/(dashboard)/lesson/[id]/interactive/LobbyView";
import { createPreparationAnswer } from "@/app/(dashboard)/lesson/[id]/interactive/presenter/preparationMocks";
import { TeachingEndCard } from "@/components/lesson/TeachingEndCard";
import type { AnswerData, ArticleData, GamePhaseState, GamePhaseStatus, LessonPair, Participant } from "@/lib/lesson-types";
import { getGamesByCategory } from "@/lib/liveLessonGames";
import { GAME_PHASES, LESSON_PHASE, TOTAL_LESSON_PHASES } from "@/lib/lessonPhases";
import { t } from "@/lib/i18n";

export interface PreviewParams {
  view?: string;
  phase?: string;
  state?: string;
  game?: string;
}

const STUDENTS: Participant[] = [
  { studentId: "dev-student", name: "Dev Student", score: 120, isReady: true },
  { studentId: "local-student-008", name: "Local Student 008", score: 96, isReady: true },
  { studentId: "punnchanida", name: "ปุณณ์ชนิดา ศรีสุวรรณวงศ์", score: 88, isReady: true },
  { studentId: "phumipat", name: "ภูมิพัฒน์ ใจดี", score: 72, offlineSince: 1, isReady: false },
  { studentId: "mintra", name: "มินตรา", score: 60, isReady: true },
  { studentId: "tonkla", name: "ต้นกล้า", score: 12, isReady: false },
];

const PAIRS: LessonPair[] = [
  { pairNumber: 1, members: [STUDENTS[0], STUDENTS[1]] },
  { pairNumber: 2, members: [STUDENTS[2], STUDENTS[3]] },
  { pairNumber: 3, members: [STUDENTS[4], STUDENTS[5]] },
];

const FALLBACK_ARTICLE = {
  id: "preview-article",
  title: "The Friendly Dolphin",
  passage:
    "Dolphins live in the sea. They talk to each other with clicks and whistles. One day a friendly dolphin swims near a small boat and plays with the children. The children laugh and wave, and the dolphin jumps high out of the water.",
  translated_summary: { th: ["โลมาที่เป็นมิตรว่ายน้ำมาเล่นกับเด็ก ๆ ใกล้เรือลำเล็ก"] },
  genre: "Science",
  cefr_level: "A1",
  words: [
    { vocabulary: "dolphin", definition: { en: "a smart sea animal", th: "โลมา" } },
    { vocabulary: "whistle", definition: { en: "a high sound", th: "เสียงหวีด" } },
    { vocabulary: "friendly", definition: { en: "kind and nice to others", th: "เป็นมิตร" } },
    { vocabulary: "wave", definition: { en: "to move your hand to say hello", th: "โบกมือ" } },
  ],
  sentences: [
    { sentences: "Dolphins live in the sea." },
    { sentences: "They talk to each other with clicks and whistles." },
    { sentences: "The children laugh and wave." },
  ],
  multipleChoiceQuestions: [
    {
      question: "How do dolphins talk to each other?",
      options: { a: "With clicks and whistles", b: "With their hands", c: "By writing letters", d: "They never talk" },
      answer: "With clicks and whistles",
    },
  ],
  shortAnswerQuestions: [{ question: "Why do you think the dolphin swims near the boat?" }],
};

/** Same top-level shape the rehearsal gives PhaseManager (words, sentences, questions). */
function normalise(article: Record<string, unknown>): ArticleData {
  const content = (article.content ?? {}) as Record<string, unknown>;
  const list = (value: unknown, fallback: unknown) => (Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : []);
  const words = list(article.words, content.words);
  const sentences = list(article.sentences, content.sentences);
  const multipleChoiceQuestions = list(article.multipleChoiceQuestions, content.comprehensionQuestions);
  const shortAnswerQuestions = list(article.shortAnswerQuestions, content.shortAnswerQuestions);
  return {
    ...article,
    id: String(article.id),
    title: String(article.title || "Untitled lesson"),
    words,
    sentences,
    multipleChoiceQuestions,
    shortAnswerQuestions,
    content: { ...content, words, sentences, comprehensionQuestions: multipleChoiceQuestions, shortAnswerQuestions },
  } as ArticleData;
}

const GAME_STATUSES: GamePhaseStatus[] = ["voting", "ready", "teacher_demo", "tutorial", "countdown", "playing", "results"];

function buildGameState(phase: number, game: string | undefined): GamePhaseState | null {
  if (!GAME_PHASES.includes(phase) || !game || !GAME_STATUSES.includes(game as GamePhaseStatus)) return null;
  const category = phase === LESSON_PHASE.SENTENCE_GAME ? "sentence" : "vocabulary";
  const games = getGamesByCategory(category).filter((item) => item.enabled !== false);
  const selectedGameId = games[0]?.id;
  const now = Date.now();
  const submitted = game === "results" ? STUDENTS : game === "playing" ? STUDENTS.slice(0, 3) : [];
  return {
    phase,
    category,
    status: game as GamePhaseStatus,
    votes: Object.fromEntries(STUDENTS.slice(0, 4).map((student, index) => [student.studentId, games[index % 2]?.id ?? ""])),
    selectedGameId: game === "voting" ? undefined : selectedGameId,
    results: Object.fromEntries(
      submitted.map((student, index) => [
        student.studentId,
        {
          studentId: student.studentId,
          name: student.name,
          gameId: selectedGameId ?? "",
          score: [9, 8, 8, 6, 4, 0][index] ?? 0,
          correct: [9, 8, 8, 6, 4, 0][index] ?? 0,
          total: 10,
          durationMs: 40000 + index * 3200,
          submittedAt: now,
        },
      ]),
    ),
    playingStartedAt: now - 20_000,
    countdownEndsAt: now + 3_000,
    serverNow: now,
  };
}

export function PresenterPreview({ article, params }: { article: Record<string, unknown> | null; params: PreviewParams }) {
  const view = params.view ?? "presenter";
  const state = params.state ?? "answering";
  const initialPhase = Math.max(0, Math.min(TOTAL_LESSON_PHASES, Number(params.phase ?? 7) || 0));
  const [phase, setPhase] = React.useState(initialPhase);
  const [ended, setEnded] = React.useState(state === "results");
  const articleData = React.useMemo(() => normalise(article ?? FALLBACK_ARTICLE), [article]);

  React.useEffect(() => {
    setEnded(state === "results");
  }, [phase, state]);

  if (view === "endcard") {
    return (
      <div className="grid flex-1 gap-4 p-4 md:grid-cols-2 md:p-6">
        <div className="relative min-h-96 overflow-hidden rounded-(--radius-card) bg-surface-muted">
          <TeachingEndCard title="ผ่านด่านแล้ว!" detail="ได้ 8 จาก 10 คำ" onReplay={() => undefined} />
        </div>
        <div className="relative min-h-96 overflow-hidden rounded-(--radius-card) bg-surface-muted">
          <TeachingEndCard title="ปราสาทแตกแล้ว" detail="ลองอีกครั้งนะ" lost onReplay={() => undefined} />
        </div>
      </div>
    );
  }

  if (view === "lobby") {
    if (state === "loading") return <LobbySkeleton label={t("lesson.interactive.preparingRoom")} />;
    if (state === "finishing") return <LobbyFinishing label={t("lesson.live.finishing")} />;
    const participants = state === "empty" ? [] : state === "ready" ? STUDENTS.map((s) => ({ ...s, isReady: true, offlineSince: undefined })) : STUDENTS;
    const readyCount = participants.filter((p) => p.isReady).length;
    const totalCount = participants.length;
    const isEveryoneReady = totalCount > 0 && readyCount === totalCount;
    const tutorTips: Array<[LucideIcon, string]> = [
      [BarChart3, t("lesson.interactive.tipWaitReady")],
      [Users, t("lesson.interactive.tipNudge")],
      [Settings2, t("lesson.interactive.tipReconnect")],
    ];
    const cover = Array.isArray(articleData.image_urls) ? (articleData.image_urls[0] as string) : null;
    return (
      <LobbyView
        demo={false}
        articleTitle={articleData.title}
        coverUrl={cover}
        summary={(articleData.translated_summary as { th?: string[] } | undefined)?.th?.[0] || t("lesson.interactive.noDescription")}
        cefr={articleData.cefr_level ? String(articleData.cefr_level).replace(/^CEFR\s*/i, "") : null}
        genre={articleData.genre}
        participants={participants}
        readyCount={readyCount}
        totalCount={totalCount}
        isEveryoneReady={isEveryoneReady}
        readyPct={totalCount > 0 ? (readyCount / totalCount) * 100 : 0}
        referralLink="https://liff.line.me/2000000000-preview?class=preview"
        isSendingLobbyNotification={false}
        lobbyNotificationStatus={null}
        onSendNotification={() => undefined}
        tutorTips={tutorTips}
        onNudge={() => undefined}
        onKick={() => undefined}
        onCloseRoom={() => undefined}
        startLabel={isEveryoneReady ? t("lesson.live.startLesson") : `${t("lesson.live.waitingReady")} (${readyCount}/${totalCount})`}
        startDisabled={!isEveryoneReady}
        starting={false}
        onStart={() => undefined}
      />
    );
  }

  const participants = state === "left" || state === "empty" ? [] : STUDENTS;
  const answers: AnswerData[] = ended
    ? participants.map((student, index) => ({ ...createPreparationAnswer(phase, student, index % 4), studentId: student.studentId, name: student.name }))
    : [];
  const sessionData = {
    sessionId: "presenter-preview",
    currentPhase: phase,
    phaseSelectedIndices: {},
    articleData,
    pairs: PAIRS,
    gameState: buildGameState(phase, params.game),
    phaseRestored: state === "rewound",
    resumePhase: state === "rewound" ? Math.min(TOTAL_LESSON_PHASES, phase + 2) : undefined,
  };

  return (
    <PhaseManager
      currentPhase={phase}
      participants={participants}
      totalAnswered={ended ? participants.length : Math.min(4, participants.length)}
      allAnsweredData={answers}
      questionEnded={ended}
      articleData={articleData}
      sessionData={sessionData}
      connectionLost={state === "offline"}
      changePhase={async (next) => {
        setPhase(next);
        return true;
      }}
      syncActiveSentence={() => undefined}
      endQuestion={() => setEnded(true)}
      endGame={() => undefined}
      startGameVote={() => undefined}
      lockGameVote={() => undefined}
      startGameIntro={() => undefined}
      advanceGameIntro={() => undefined}
      kickStudent={() => undefined}
      onFinishSession={() => undefined}
    />
  );
}
