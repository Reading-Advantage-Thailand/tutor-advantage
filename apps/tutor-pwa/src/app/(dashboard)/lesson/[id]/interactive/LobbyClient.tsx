"use client";

/**
 * Live lesson room for the tutor: the waiting lobby (lesson, join QR/link,
 * student readiness, activity choice) and, once phase ≥ 1, the presenter
 * (PhaseManager). Runs inside LessonShell (slim bar, no app nav). This file
 * owns the socket, state and handlers; the lobby markup is LobbyView.
 */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Settings2, Users, type LucideIcon } from "lucide-react";
import {
  Chip,
  ConfirmDialog,
  ErrorState,
  LessonBarActions,
  useLessonExitGuard,
  useShellTitle,
} from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { useLiveAssessment } from "@/hooks/useLiveAssessment";
import LiveAssessmentControls from "@/components/LiveAssessmentControls";
import { playSound } from "@/lib/sounds";
import { t } from "@/lib/i18n";

import { PhaseManager } from "./PhaseManager";
import { sendLobbyNotifications } from "./actions";
import { formatLobbyNotificationFailure, getArticleCoverUrl, getArticleSummary, getCefrLabel } from "./lobbyHelpers";
import { LobbyFinishing, LobbySkeleton, LobbyView } from "./LobbyView";

export default function TutorLobbyClient({
  tutorId,
  classId,
  articleId,
  classBookCycleId,
  bookId,
  socketUrl,
  demo = false,
  referralLink = null,
}: {
  tutorId: string;
  classId: string;
  articleId: string;
  classBookCycleId?: string;
  bookId?: string;
  socketUrl: string;
  demo?: boolean;
  referralLink?: string | null;
}) {
  const router = useRouter();

  // In demo mode there is no real class to return to.
  const backHref = demo ? "/dashboard/demo" : `/dashboard/classes/${classId}`;

  const {
    socket,
    sessionData,
    participants,
    articleData,
    totalAnswered,
    allAnsweredData,
    questionEnded,
    error,
    connectionLost,
    flagCounts,
    changePhase,
    syncActiveSentence,
    endQuestion,
    endGame,
    startGameVote,
    lockGameVote,
    startGameIntro,
    advanceGameIntro,
    nudgeStudent,
    kickStudent,
    deleteSession,
    finishSession,
  } = useLessonSocket(tutorId, articleId, classId, socketUrl, classBookCycleId, bookId, demo);
  const assessment = useLiveAssessment(socket, sessionData?.sessionId, sessionData?.currentPhase);
  const assessmentSupported = assessment.state?.supported !== false;
  const activitySelectionReady = assessment.state !== null;
  const lessonSelected = !assessment.state || assessment.state.mode === "LESSON";
  const assessmentSelected = Boolean(assessment.state?.supported && assessment.state.mode !== "LESSON");

  const readyCount = participants.filter((participant) => participant.isReady).length;
  const totalCount = participants.length;
  const isEveryoneReady = totalCount > 0 && readyCount === totalCount;
  // Demo is a solo walkthrough — the tutor can start without waiting for students.
  const canStart = demo || isEveryoneReady;
  const canDevStart = process.env.NODE_ENV === "development" && !canStart;
  const tutorTips: Array<[LucideIcon, string]> = [
    [BarChart3, t("lesson.interactive.tipWaitReady")],
    [Users, t("lesson.interactive.tipNudge")],
    [Settings2, t("lesson.interactive.tipReconnect")],
  ];
  const [bypassEmptyStudentGuard, setBypassEmptyStudentGuard] = React.useState(false);
  const [isSendingLobbyNotification, setIsSendingLobbyNotification] = React.useState(false);
  const [lobbyNotificationStatus, setLobbyNotificationStatus] = React.useState<string | null>(null);
  const [isFinishingSession, setIsFinishingSession] = React.useState(false);
  const [closeRoomOpen, setCloseRoomOpen] = React.useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = React.useState(false);
  const startPhasePendingRef = React.useRef(false);
  const [isStartingPhase, setIsStartingPhase] = React.useState(false);

  const articleTitle = articleData?.title || "";
  const isLive = Boolean(sessionData && sessionData.currentPhase > 0);
  // Leaving mid-lesson is not a stray click away from losing the room.
  useLessonExitGuard(
    React.useCallback(() => {
      if (!isLive || demo) return false;
      setExitConfirmOpen(true);
      return true;
    }, [demo, isLive]),
  );
  useShellTitle(
    isLive
      ? articleTitle || t("lesson.live.lessonFallbackTitle")
      : articleTitle
        ? `${t("lesson.live.lobbyTitle")} · ${articleTitle}`
        : t("lesson.live.lobbyTitle"),
  );

  const startPhase = React.useCallback(
    (bypassStudentGuard = false) => {
      if (startPhasePendingRef.current || !lessonSelected) return;
      startPhasePendingRef.current = true;
      setIsStartingPhase(true);
      if (bypassStudentGuard) setBypassEmptyStudentGuard(true);
      playSound("phaseChange");
      void changePhase(1).finally(() => {
        startPhasePendingRef.current = false;
        setIsStartingPhase(false);
      });
    },
    [changePhase, lessonSelected],
  );

  const startSelectedActivity = React.useCallback(async () => {
    if (!canStart || isStartingPhase || assessment.busy) return;
    if (lessonSelected) {
      startPhase();
      return;
    }
    if (!assessment.state || assessment.state.status !== "LOBBY" || assessment.state.paused) return;
    playSound("phaseChange");
    await assessment.control({ action: "start", revision: assessment.state.revision });
  }, [assessment, canStart, isStartingPhase, lessonSelected, startPhase]);

  const handleFinishAndNavigate = React.useCallback(async () => {
    if (isFinishingSession) return;
    setIsFinishingSession(true);
    const finished = await finishSession();
    if (finished) {
      router.push(backHref);
      return;
    }
    setIsFinishingSession(false);
  }, [backHref, finishSession, isFinishingSession, router]);

  const handleSendLobbyNotification = async () => {
    setIsSendingLobbyNotification(true);
    setLobbyNotificationStatus(null);
    try {
      const result = await sendLobbyNotifications(classId, articleData?.title || "บทเรียนวันนี้");
      setLobbyNotificationStatus(
        result.sent > 0
          ? `${t("lesson.live.lineSentPrefix")} ${result.sent}/${result.eligible} ${t("lesson.interactive.peopleUnit")}`
          : formatLobbyNotificationFailure(result.failures),
      );
    } catch (sendError) {
      setLobbyNotificationStatus(sendError instanceof Error ? sendError.message : t("lesson.live.lineFailed"));
    } finally {
      setIsSendingLobbyNotification(false);
    }
  };

  if (isFinishingSession) {
    return <LobbyFinishing label={t("lesson.live.finishing")} />;
  }

  // ── Live presenter ───────────────────────────────────────────────────────
  if (sessionData && sessionData.currentPhase > 0) {
    return (
      <>
        <LessonBarActions>
          <Chip tone={demo ? "info" : "success"} dot>
            {demo ? t("lesson.live.demoChip") : t("lesson.live.liveChip")}
          </Chip>
        </LessonBarActions>
        <PhaseManager
          sessionData={sessionData}
          currentPhase={sessionData.currentPhase}
          participants={participants}
          totalAnswered={totalAnswered}
          allAnsweredData={allAnsweredData}
          questionEnded={questionEnded}
          articleData={articleData ?? undefined}
          flagCounts={flagCounts}
          changePhase={changePhase}
          syncActiveSentence={syncActiveSentence}
          endQuestion={endQuestion}
          endGame={endGame}
          connectionLost={connectionLost}
          startGameVote={startGameVote}
          lockGameVote={lockGameVote}
          startGameIntro={startGameIntro}
          advanceGameIntro={advanceGameIntro}
          kickStudent={kickStudent}
          bypassEmptyStudentGuard={bypassEmptyStudentGuard}
          exitConfirmOpen={exitConfirmOpen}
          onFinishSession={() => {
            void handleFinishAndNavigate();
          }}
        />
        <ConfirmDialog
          open={exitConfirmOpen}
          onOpenChange={setExitConfirmOpen}
          title={t("lesson.live.exitConfirmTitle")}
          description={t("lesson.live.exitConfirmDescription")}
          confirmLabel={t("lesson.live.exitStepOut")}
          cancelLabel={t("lesson.live.keepTeaching")}
          onConfirm={() => {
            setExitConfirmOpen(false);
            router.push(backHref);
          }}
        >
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              setExitConfirmOpen(false);
              void handleFinishAndNavigate();
            }}
          >
            {t("lesson.live.finishLessonShort")}
          </Button>
        </ConfirmDialog>
      </>
    );
  }

  if (error) {
    // A room closed elsewhere is not a failure to create one, and reloading would open a new room.
    const sessionCancelled = error === t("app.lessonSessionCancelled");
    return (
      <div className="flex min-h-[var(--lesson-viewport-h)] items-center justify-center p-4">
        <ErrorState
          title={sessionCancelled ? error : t("lesson.interactive.sessionCreateError")}
          description={sessionCancelled ? t("lesson.live.sessionCancelledHelp") : error}
          onRetry={sessionCancelled ? undefined : () => window.location.reload()}
          retryLabel={t("lesson.live.retry")}
          action={
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              {t("lesson.interactive.backToClass")}
            </Link>
          }
          className="max-w-md"
        />
      </div>
    );
  }

  if (!sessionData) {
    return <LobbySkeleton label={t("lesson.interactive.preparingRoom")} />;
  }

  // ── Lobby ────────────────────────────────────────────────────────────────
  const coverUrl = getArticleCoverUrl(articleData);
  const summary = getArticleSummary(articleData) || t("lesson.interactive.noDescription");
  const cefr = getCefrLabel(articleData);
  const startDisabled =
    !activitySelectionReady ||
    !canStart ||
    isStartingPhase ||
    assessment.busy ||
    // "Paused" is about the assessment. It must not block starting the lesson.
    (assessmentSelected && (Boolean(assessment.state?.paused) || assessment.state?.status !== "LOBBY"));
  const assessmentModeLabel = (pre: string, post: string) => (assessment.state?.mode === "PRE" ? pre : post);
  const startLabel = !activitySelectionReady
    ? t("lesson.live.loadingActivity")
    : isStartingPhase || assessment.busy
      ? t("lesson.live.starting")
      : assessmentSelected && assessment.state?.status === "RUNNING"
        ? assessmentModeLabel(t("lesson.live.assessmentRunningPre"), t("lesson.live.assessmentRunningPost"))
        : assessmentSelected && assessment.state?.status === "FINISHED"
          ? t("lesson.live.chooseNextActivity")
          : !demo && !isEveryoneReady
            ? `${t("lesson.live.waitingReady")} (${readyCount}/${totalCount})`
            : assessmentSelected
              ? assessmentModeLabel(t("lesson.live.startAssessmentPre"), t("lesson.live.startAssessmentPost"))
              : demo
                ? t("lesson.interactive.startDemo")
                : t("lesson.live.startLesson");
  const readyPct = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

  return (
    <>
      <LobbyView
        demo={demo}
        articleTitle={articleTitle}
        coverUrl={coverUrl}
        summary={summary}
        cefr={cefr}
        genre={articleData?.genre}
        participants={participants}
        readyCount={readyCount}
        totalCount={totalCount}
        isEveryoneReady={isEveryoneReady}
        readyPct={readyPct}
        referralLink={referralLink}
        isSendingLobbyNotification={isSendingLobbyNotification}
        lobbyNotificationStatus={lobbyNotificationStatus}
        onSendNotification={handleSendLobbyNotification}
        activity={
          assessmentSupported ? (
            <LiveAssessmentControls state={assessment.state} busy={assessment.busy} error={assessment.error} onControl={assessment.control} />
          ) : null
        }
        tutorTips={tutorTips}
        onNudge={(participant) => {
          nudgeStudent(participant.studentId);
          playSound("nudge");
        }}
        onKick={(participant) => kickStudent(participant.studentId)}
        onDevDelete={process.env.NODE_ENV === "development" ? () => deleteSession() : undefined}
        onCloseRoom={() => setCloseRoomOpen(true)}
        startLabel={startLabel}
        startDisabled={startDisabled}
        starting={isStartingPhase || assessment.busy}
        onStart={() => {
          void startSelectedActivity();
        }}
        onDevStart={canDevStart && lessonSelected ? () => startPhase(true) : undefined}
      />

      <ConfirmDialog
        open={closeRoomOpen}
        onOpenChange={setCloseRoomOpen}
        title={t("lesson.interactive.closeRoomConfirm")}
        description={t("lesson.live.closeRoomDescription")}
        confirmLabel={t("lesson.live.closeRoom")}
        cancelLabel={t("lesson.live.closeRoomCancel")}
        tone="danger"
        onConfirm={() => {
          setCloseRoomOpen(false);
          deleteSession();
          router.push(backHref);
        }}
      />
    </>
  );
}
