"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, ClipboardCheck, Clock, Monitor, QrCode } from "lucide-react";
import type { LiveAssessmentState } from "@tutor-advantage/shared-config";
import LiveAssessmentStudent from "@/components/LiveAssessmentStudent";
import { AppBar, IconTile, ListGroup, ListRow, Screen } from "@/components/mobile";
import { LessonPreviewContext, type LessonSocketState } from "@/app/interactive/play/_components/lessonPreview";
import { PlayLessonContent } from "@/app/interactive/play/_components/PlayLesson";
import { PlaySkeleton } from "@/app/interactive/play/_components/PlaySkeleton";
import { MCQ_PHASES } from "@/app/interactive/play/_components/playModel";
import { ArticleReaderView, type PageData } from "@/app/student/read/[articleId]/_components/ArticleReaderView";
import { ReaderSkeleton } from "@/app/student/read/[articleId]/_components/ReaderSkeleton";
import { getParagraphs } from "@/app/student/read/[articleId]/_components/readerModel";
import { useReadAloud, useSpeechSupported } from "@/app/student/read/[articleId]/_components/useReadAloud";
import { ARTICLE, baseSocket, ME, participants, PREVIEW_CLASS_ID, PREVIEW_LIFF, PREVIEW_STATES, READER_ARTICLE, READER_SESSION, type PreviewState } from "./fixtures";

/** Renders the real live-lesson screen for one fixture; the phone "answers" like a real one when interactive. */
function PlayState({ state, everyone }: { state: PreviewState; everyone: boolean }) {
  const [answered, setAnswered] = useState(false);
  const [everyoneReady, setEveryoneReady] = useState(false);
  const [myScore, setMyScore] = useState(120);

  useEffect(() => {
    if (!answered || !everyone) return;
    const timer = window.setTimeout(() => setEveryoneReady(true), 600);
    return () => window.clearTimeout(timer);
  }, [answered, everyone]);

  const value = useMemo(() => {
    const base = baseSocket();
    const fixture = state.socket ?? {};
    const phase = fixture.sessionData?.currentPhase ?? 0;
    const socket: LessonSocketState = {
      ...base,
      ...fixture,
      participants: fixture.participants ?? participants(myScore),
      hasAnswered: fixture.hasAnswered || answered,
      isEveryoneReady: fixture.isEveryoneReady || everyoneReady,
      submitAnswer: state.interactive
        ? () => {
            window.setTimeout(() => {
              setAnswered(true);
              if (MCQ_PHASES.includes(phase)) setMyScore(240);
            }, 500);
          }
        : base.submitAnswer,
    };
    return { socket, liff: { ...PREVIEW_LIFF, ...state.liff } };
  }, [state, answered, everyoneReady, myScore]);

  return (
    <LessonPreviewContext.Provider value={value}>
      <PlayLessonContent />
    </LessonPreviewContext.Provider>
  );
}

const ASSESSMENT_BASE: LiveAssessmentState = {
  sessionId: "preview-session",
  supported: true,
  articleTitle: ARTICLE.title,
  mode: "PRE",
  status: "RUNNING",
  revision: 1,
  postOpened: false,
  paused: false,
  items: Array.from({ length: 15 }, (_, index) => ({
    id: `q${index}`,
    skill: index % 3 === 0 ? "reading" : index % 3 === 1 ? "vocabulary" : "listening",
    prompt: index === 0 ? "Where do dolphins live?" : `Question ${index + 1}: choose the best word.`,
    options: ["In the ocean", "In a forest", "On a mountain", "In the desert"],
    passage: index === 0 ? "Dolphins live in the ocean in groups called pods." : undefined,
  })),
  answers: {},
  completed: false,
  progress: [],
};

const ASSESSMENT_STATES: Record<string, Partial<LiveAssessmentState>> = {
  lobby: { status: "LOBBY", items: [] },
  running: {},
  paused: { paused: true, answers: { q0: 0, q1: 2 } },
  done: { answers: Object.fromEntries(ASSESSMENT_BASE.items.map((item) => [item.id, 0])) },
  finished: { status: "FINISHED", completed: true, items: [] },
};

function AssessmentState({ id }: { id: string }) {
  const state = { ...ASSESSMENT_BASE, ...(ASSESSMENT_STATES[id] ?? {}) };
  return (
    <main className="live-assessment-page">
      <LiveAssessmentStudent
        key={id}
        state={state}
        busy={false}
        error=""
        onAnswer={async () => true}
        lessonName="English · Primary Origins 2 (A0)"
        tutorName="T.นกเอี้ยง"
      />
    </main>
  );
}

/** The article reader (/student/read) from fixtures: pre-class or review. */
function ReaderState({ mode }: { mode: "pre-class" | "review" }) {
  const data = useMemo<PageData>(
    () => ({ article: READER_ARTICLE, mode, session: mode === "review" ? READER_SESSION : null }),
    [mode],
  );
  const paragraphs = useMemo(() => getParagraphs(data.article), [data]);
  const speechSupported = useSpeechSupported();
  const { readingIndex, isReading, startReading, stopReading, speakWord } = useReadAloud(paragraphs);
  return (
    <ArticleReaderView
      data={data}
      paragraphs={paragraphs}
      speechSupported={speechSupported}
      readAloud={{ readingIndex, isReading, startReading, stopReading, speakWord }}
    />
  );
}

function PreviewIndex() {
  const groups = PREVIEW_STATES.reduce<Record<string, PreviewState[]>>((acc, state) => {
    (acc[state.group] ??= []).push(state);
    return acc;
  }, {});
  const href = (state: PreviewState, extra = "") =>
    `/dev/lesson-preview?state=${state.id}${state.noClass ? "" : `&classId=${PREVIEW_CLASS_ID}`}${extra}`;
  return (
    <Screen>
      <AppBar title="Lesson preview (dev)" subtitle="S6–S8 live lesson, study, reader" back fallbackHref="/dev/ui-kit" />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-10">
        {Object.entries(groups).map(([group, states]) => (
          <ListGroup key={group} header={group}>
            {states.map((state) => (
              <ListRow
                key={state.id}
                href={href(state, state.id === "p7-mcq-everyone" ? "&tap=B&everyone=1" : state.id === "p7-mcq-sending" ? "&tap=C" : "")}
                title={state.label}
                subtitle={state.id}
                chevron
              />
            ))}
          </ListGroup>
        ))}
        <ListGroup header="Other screens">
          <ListRow href="/dev/lesson-preview?state=skeleton" leading={<IconTile icon={Clock} tone="neutral" size="sm" />} title="PlaySkeleton (loading)" chevron />
          <ListRow href="/interactive/join" leading={<IconTile icon={QrCode} tone="brand" size="sm" />} title="/interactive/join" chevron />
          <ListRow href="/study/preview" leading={<IconTile icon={BookOpen} tone="purple" size="sm" />} title="/study/[id]" chevron />
          <ListRow href="/dev/lesson-preview?reader=pre-class" leading={<IconTile icon={BookOpen} tone="amber" size="sm" />} title={<>/student/read · <span className="whitespace-nowrap">เตรียมตัวก่อนเรียน</span></>} chevron />
          <ListRow href="/dev/lesson-preview?reader=review" leading={<IconTile icon={BookOpen} tone="brand" size="sm" />} title={<>/student/read · <span className="whitespace-nowrap">ทบทวน (มีคะแนน)</span></>} chevron />
          <ListRow href="/dev/lesson-preview?reader=skeleton" leading={<IconTile icon={Clock} tone="neutral" size="sm" />} title="/student/read · loading" chevron />
          <ListRow href="/interactive/play" leading={<IconTile icon={Monitor} tone="blue" size="sm" />} title="/interactive/play (no class)" chevron />
          {Object.keys(ASSESSMENT_STATES).map((id) => (
            <ListRow
              key={id}
              href={`/dev/lesson-preview?assessment=${id}`}
              leading={<IconTile icon={ClipboardCheck} tone="orange" size="sm" />}
              title={`LiveAssessmentStudent · ${id}`}
              chevron
            />
          ))}
        </ListGroup>
        <p className="text-[13px] leading-[1.6] text-fg-muted">
          The fixture student is &quot;{ME}&quot;. Interactive states answer after 500ms (+120 points, rank moves up 2). Add
          &nbsp;<code>&amp;tap=B</code> to tap a tile on load and <code>&amp;everyone=1</code> for &quot;everyone answered&quot;.
        </p>
      </div>
    </Screen>
  );
}

function Preview() {
  const params = useSearchParams();
  const stateId = params.get("state");
  const assessment = params.get("assessment");
  const reader = params.get("reader");
  const tap = params.get("tap");
  const everyone = params.get("everyone") === "1";

  // Dev convenience for screenshots: tap an answer tile once the screen is up.
  useEffect(() => {
    if (!tap) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(`[data-answer="${tap.toLowerCase()}"]`)?.click();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [tap, stateId]);

  if (assessment) return <AssessmentState id={assessment} />;
  if (reader === "skeleton") return <ReaderSkeleton />;
  if (reader === "pre-class" || reader === "review") return <ReaderState key={reader} mode={reader} />;
  if (stateId === "skeleton") return <PlaySkeleton status="กำลังเชื่อมต่อบทเรียน" />;
  const state = PREVIEW_STATES.find((item) => item.id === stateId);
  if (!state) return <PreviewIndex />;
  return <PlayState key={state.id} state={state} everyone={everyone || state.id === "p7-mcq-everyone"} />;
}

export function LessonPreview() {
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <Preview />
    </Suspense>
  );
}
