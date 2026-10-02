"use client";

/**
 * Live lesson room for the tutor: the waiting lobby (lesson, join QR/link,
 * student readiness, activity choice) and, once phase ≥ 1, the presenter
 * (PhaseManager). Runs inside LessonShell (slim bar, no app nav).
 */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Check,
  Copy,
  Lightbulb,
  Play,
  QrCode,
  Settings2,
  Trash2,
  UserMinus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconTile,
  LessonBarActions,
  LessonDock,
  ProgressBar,
  Spinner,
  UserAvatar,
  useShellTitle,
} from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { useLiveAssessment } from "@/hooks/useLiveAssessment";
import LiveAssessmentControls from "@/components/LiveAssessmentControls";
import { playSound } from "@/lib/sounds";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PhaseManager } from "./PhaseManager";
import { sendLobbyNotifications } from "./actions";
import { formatLobbyNotificationFailure, getArticleCoverUrl, getArticleSummary, getCefrLabel } from "./lobbyHelpers";

function LobbyPanel({ className, children, ...rest }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-xl border border-hairline bg-surface shadow-card", className)} {...rest}>
      {children}
    </section>
  );
}

function LessonCover({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-tile-brand sm:w-44">
        <BookOpen aria-hidden="true" className="size-10 text-icon-brand" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full rounded-lg bg-fill-muted object-cover sm:w-44"
    />
  );
}

// Every way to join in one card: QR, link and a LINE reminder.
function JoinCard({
  referralLink,
  isSending,
  notificationStatus,
  onSendNotification,
}: {
  referralLink: string | null;
  isSending: boolean;
  notificationStatus: string | null;
  onSendNotification: () => void | Promise<void>;
}) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  return (
    <LobbyPanel id="lobby-invite" aria-labelledby="lobby-join-title" className="order-2 flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <IconTile icon={QrCode} tone="brand" />
        <div className="min-w-0">
          <h2 id="lobby-join-title" className="text-base font-semibold text-fg">
            {t("lesson.live.joinTitle")}
          </h2>
          <p className="text-[0.8125rem] text-fg-muted">{t("lesson.live.joinHelp")}</p>
        </div>
      </div>

      {referralLink ? (
        <>
          <div className="mx-auto rounded-xl border border-hairline bg-white p-3">
            <QRCodeSVG value={referralLink} size={176} level="M" includeMargin={false} aria-label={t("lesson.live.joinLinkLabel")} />
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={referralLink}
              aria-label={t("lesson.live.joinLinkLabel")}
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 truncate rounded-lg border border-field-border bg-surface-muted px-3 text-sm text-fg-muted"
            />
            <Button variant="outline" onClick={handleCopy} aria-label={t("lesson.live.copyLink")}>
              {copied ? <Check aria-hidden="true" className="text-success-fg" /> : <Copy aria-hidden="true" />}
              <span className="hidden sm:inline xl:hidden 2xl:inline">{copied ? t("lesson.live.linkCopied") : t("lesson.live.copyLink")}</span>
            </Button>
          </div>
          <p aria-live="polite" className="sr-only">
            {copied ? t("lesson.live.linkCopied") : ""}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-hairline-strong px-4 py-8 text-center">
          <Spinner className="text-fg-subtle" />
          <p className="text-sm text-fg-muted">{t("lesson.live.joinLinkPreparing")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <p className="text-sm font-medium text-fg">{t("lesson.live.lineTitle")}</p>
        <p className="-mt-1.5 text-[0.8125rem] text-fg-muted">{t("lesson.live.lineHelp")}</p>
        <Button variant="soft" disabled={isSending} loading={isSending} onClick={() => void onSendNotification()}>
          {!isSending ? <Bell aria-hidden="true" /> : null}
          {isSending ? t("lesson.live.lineSending") : t("lesson.live.lineSend")}
        </Button>
        {notificationStatus ? (
          <p role="status" className="text-[0.8125rem] leading-relaxed text-fg-muted">
            {notificationStatus}
          </p>
        ) : null}
      </div>
    </LobbyPanel>
  );
}

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
    flagCounts,
    changePhase,
    syncActiveSentence,
    endQuestion,
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
  const startPhasePendingRef = React.useRef(false);
  const [isStartingPhase, setIsStartingPhase] = React.useState(false);

  const articleTitle = articleData?.title || "";
  const isLive = Boolean(sessionData && sessionData.currentPhase > 0);
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
          startGameVote={startGameVote}
          lockGameVote={lockGameVote}
          startGameIntro={startGameIntro}
          advanceGameIntro={advanceGameIntro}
          bypassEmptyStudentGuard={bypassEmptyStudentGuard}
          onFinishSession={() => {
            void handleFinishAndNavigate();
          }}
        />
      </>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[var(--lesson-viewport-h)] items-center justify-center p-4">
        <ErrorState
          title={t("lesson.interactive.sessionCreateError")}
          description={error}
          onRetry={() => window.location.reload()}
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
    return (
      <div className="flex min-h-[var(--lesson-viewport-h)] flex-col items-center justify-center gap-3 p-4 text-center">
        <Spinner className="text-brand-fg [&_svg]:size-8" />
        <p className="text-base font-medium text-fg-muted">{t("lesson.interactive.preparingRoom")}</p>
      </div>
    );
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
    Boolean(assessment.state?.paused) ||
    (assessmentSelected && assessment.state?.status !== "LOBBY");
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
      <LessonBarActions>
        {demo ? (
          <Chip tone="info">{t("lesson.live.demoChip")}</Chip>
        ) : (
          <Chip tone="success" dot className="hidden sm:inline-flex">
            {t("lesson.live.lobbyLiveChip")}
          </Chip>
        )}
        {process.env.NODE_ENV === "development" ? (
          <Button variant="ghost" size="sm" onClick={() => deleteSession()} className="hidden text-fg-subtle md:inline-flex">
            <Trash2 aria-hidden="true" />
            {t("lesson.live.devDelete")}
          </Button>
        ) : null}
        <Button variant="destructive" size="sm" onClick={() => setCloseRoomOpen(true)}>
          <X aria-hidden="true" />
          <span className="hidden sm:inline">{t("lesson.live.closeRoom")}</span>
          <span className="sr-only sm:hidden">{t("lesson.live.closeRoom")}</span>
        </Button>
      </LessonBarActions>

      <div className="flex min-h-[var(--lesson-viewport-h)] flex-col">
        {/* Phones/tablets: lesson → join → students → activity → tips.
            Desktop: lesson + students on the left, join/activity/tips on the right. */}
        <div className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-4 px-4 pb-6 pt-4 md:px-6 md:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:grid-rows-[auto_1fr] lg:gap-5">
            <LobbyPanel aria-labelledby="lobby-lesson-title" className="order-1 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5 lg:col-start-1 lg:row-start-1">
              <LessonCover src={coverUrl} title={articleTitle} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-sm text-fg-muted">{t("lesson.live.lessonCardEyebrow")}</p>
                <h1 id="lobby-lesson-title" className="text-2xl font-bold leading-tight text-fg">
                  {articleTitle || t("lesson.interactive.lessonLoading")}
                </h1>
                <p className="line-clamp-2 text-[0.9375rem] leading-relaxed text-fg-muted">{summary}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Chip tone="brand" icon={BookOpen}>
                    {t("lesson.live.stepsCount")}
                  </Chip>
                  {cefr ? (
                    <Chip>
                      {t("lesson.live.levelLabel")} {cefr}
                    </Chip>
                  ) : null}
                  {articleData?.genre ? (
                    <Chip>
                      {t("lesson.live.genreLabel")} {String(articleData.genre)}
                    </Chip>
                  ) : null}
                </div>
              </div>
            </LobbyPanel>

            <LobbyPanel id="lobby-students" aria-labelledby="lobby-students-title" className="order-3 flex flex-col lg:col-start-1 lg:row-start-2 lg:self-start">
              <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="lobby-students-title" className="flex items-center gap-2 text-lg font-semibold text-fg">
                    <Users aria-hidden="true" className="size-5 text-brand-fg" />
                    {t("lesson.live.rosterReadyTitle")}
                  </h2>
                  <p className="text-sm text-fg-muted">
                    {t("lesson.live.readyCount")}{" "}
                    <span className={cn("text-xl font-bold tabular-nums", isEveryoneReady ? "text-success-fg" : "text-fg")}>
                      {readyCount}/{totalCount}
                    </span>{" "}
                    {t("lesson.interactive.peopleUnit")}
                  </p>
                </div>
                <ProgressBar value={readyPct} label={t("lesson.live.rosterReadyTitle")} />
              </div>

              {participants.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title={demo ? t("lesson.interactive.demoEmptyTitle") : t("lesson.interactive.emptyStudentsTitle")}
                  description={demo ? t("lesson.interactive.demoEmptyMessage") : t("lesson.interactive.emptyStudentsLinkMessage")}
                />
              ) : (
                <ul className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                  {participants.map((participant) => (
                    <li
                      key={participant.studentId}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3",
                        participant.isReady ? "border-success-border bg-success-bg" : "border-hairline bg-surface",
                      )}
                    >
                      <UserAvatar name={participant.name} src={participant.pictureUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem] font-semibold text-fg">{participant.name}</p>
                        <p
                          className={cn(
                            "flex items-center gap-1 text-[0.8125rem]",
                            participant.isReady ? "font-medium text-success-fg" : "text-fg-muted",
                          )}
                        >
                          {participant.isReady ? <Check aria-hidden="true" className="size-3.5" /> : null}
                          {participant.isReady ? t("lesson.live.statusReady") : t("lesson.live.statusWaiting")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {!participant.isReady ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              nudgeStudent(participant.studentId);
                              playSound("nudge");
                            }}
                            aria-label={`${t("lesson.interactive.nudgeTitle")} ${participant.name}`}
                            title={t("lesson.interactive.nudgeTitle")}
                          >
                            <Bell aria-hidden="true" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => kickStudent(participant.studentId)}
                          aria-label={`${t("lesson.live.removeTitle")} ${participant.name}`}
                          title={t("lesson.live.removeTitle")}
                          className="text-fg-subtle hover:text-danger-fg"
                        >
                          <UserMinus aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </LobbyPanel>

          {/* Right column on desktop (display: contents below lg so the cards interleave) */}
          <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            {!demo ? (
              <JoinCard
                referralLink={referralLink}
                isSending={isSendingLobbyNotification}
                notificationStatus={lobbyNotificationStatus}
                onSendNotification={handleSendLobbyNotification}
              />
            ) : null}
            {assessmentSupported ? (
              <div id="lobby-activity" className="order-4">
                <LiveAssessmentControls state={assessment.state} busy={assessment.busy} error={assessment.error} onControl={assessment.control} />
              </div>
            ) : null}
            <LobbyPanel aria-labelledby="lobby-tips-title" className="order-5 p-4">
              <h2 id="lobby-tips-title" className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Lightbulb aria-hidden="true" className="size-4 text-icon-amber" />
                {t("lesson.live.tipsTitle")}
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {tutorTips.map(([Icon, tip]) => (
                  <li key={tip} className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-fg-muted">
                    <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                    {tip}
                  </li>
                ))}
              </ul>
            </LobbyPanel>
          </div>
        </div>

        {/* Start dock: always visible at the bottom edge */}
        <LessonDock className="mt-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 md:px-2">
            <div className="min-w-0 text-sm text-fg-muted">
              {demo ? (
                t("lesson.interactive.demoSoloNote")
              ) : (
                <>
                  <span className="font-semibold text-fg">
                    {t("lesson.live.readyCount")} {readyCount}/{totalCount} {t("lesson.interactive.peopleUnit")}
                  </span>
                  {!isEveryoneReady ? (
                    <span className="hidden sm:inline">
                      {" · "}
                      {totalCount === 0 ? t("lesson.live.startHintEmpty") : t("lesson.live.startHint")}
                    </span>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {canDevStart && lessonSelected ? (
                <Button variant="outline" size="lg" onClick={() => startPhase(true)} className="hidden md:inline-flex">
                  {t("lesson.live.devStartAnyway")}
                </Button>
              ) : null}
              <Button
                size="xl"
                className="w-full sm:w-auto sm:min-w-56"
                disabled={startDisabled}
                loading={isStartingPhase || assessment.busy}
                onClick={() => {
                  void startSelectedActivity();
                }}
              >
                {!(isStartingPhase || assessment.busy) ? <Play aria-hidden="true" fill="currentColor" /> : null}
                {startLabel}
              </Button>
            </div>
          </div>
        </LessonDock>
      </div>

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
