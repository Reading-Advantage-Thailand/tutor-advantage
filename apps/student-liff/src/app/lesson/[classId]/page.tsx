"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, DoorOpen, Hourglass, Lock, Play, Radio, SearchX, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";
import { useLiff } from "@/components/providers/LiffProvider";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { useLiveAssessment } from "@/hooks/useLiveAssessment";
import LiveAssessmentStudent from "@/components/LiveAssessmentStudent";
import { preloadArcadeRuntime } from "@/components/lesson/gameRegistry";
import { getLessonConnectionState, getLessonErrorKind } from "@/components/lesson/lessonConnection";
import { PaymentRequiredScreen } from "@/components/lesson/PaymentRequiredScreen";
import {
  AppBar,
  BottomActionBar,
  Chip,
  ErrorState,
  IconTile,
  Notice,
  Screen,
  Spinner,
  StatusScreen,
  Surface,
  UserAvatar,
} from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { noOrphan } from "@/lib/format";
import { buildPlayUrl } from "@/components/lesson/lessonRoutes";
import { LobbySkeleton } from "./_components/LobbySkeleton";
import {
  getLobbyActivity,
  getLobbyActivityMode,
  shouldShowLiveAssessment,
  sortParticipantsMeFirst,
} from "./_components/lobbyModel";

interface PageProps {
  params: Promise<{ classId: string }>;
}

interface ClassInfo {
  name?: string;
  tutor?: {
    name?: string;
  };
  isEnrolled?: boolean;
  enrollmentStatus?: string | null;
}

type ClassLoadError = "notFound" | "offline" | "error";

/** Clear the optimistic "sending ready" spinner if the server never answers. */
const READY_PENDING_TIMEOUT_MS = 4000;

function classifyLoadError(err: unknown): ClassLoadError {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 404 || status === 403) return "notFound";
  if (typeof status === "number") return "error";
  return "offline";
}

export default function LessonLobbyPage({ params }: PageProps) {
  const { classId } = use(params);
  // "Connect again" remounts the lobby, which reopens the socket (and refetches the class).
  const [attempt, setAttempt] = useState(0);
  return <LessonLobby key={attempt} classId={classId} onReconnect={() => setAttempt((value) => value + 1)} />;
}

function LessonLobby({ classId, onReconnect }: { classId: string; onReconnect: () => void }) {
  const router = useRouter();
  const { profile, isReady: liffReady, error: liffError, errorCode: liffErrorCode, retry: retryLiff } = useLiff();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [fetchingClass, setFetchingClass] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<ClassLoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [readyPending, setReadyPending] = useState(false);

  const studentId = profile?.userId || "";
  const studentName = profile?.displayName || "Student";
  const pictureUrl = profile?.pictureUrl;
  const classHref = `/classes/${classId}`;

  // Use socket for lobby
  const {
    socket,
    sessionData,
    participants,
    error,
    paymentRequired,
    toggleReady,
    nudgeMessage,
    kicked
  } = useLessonSocket(classInfo?.isEnrolled ? classId : undefined, studentId, studentName, pictureUrl);
  const assessment = useLiveAssessment(socket, sessionData?.sessionId, sessionData?.currentPhase);

  const myParticipant = participants.find(p => p.studentId === studentId);
  const isReady = myParticipant?.isReady || false;

  useEffect(() => {
    if (liffReady && classId) {
      studentApi.getClassDetails(classId)
        .then(data => {
          if (!data.class?.isEnrolled || data.class?.enrollmentStatus !== "ACTIVE") {
            setAccessDenied(t("lessonLobby.paymentRequired"));
            setClassInfo(data.class);
            setFetchingClass(false);
            return;
          }
          setClassInfo(data.class);
          setFetchingClass(false);
        })
        .catch(err => {
          console.warn("Failed to fetch class info:", err);
          setLoadError(classifyLoadError(err));
          setFetchingClass(false);
        });
    }
  }, [liffReady, classId, reloadKey]);

  // Handle auto-redirect when phase changes (Lesson Starts). replace, not push:
  // otherwise Android back from the lesson lands here and bounces straight back.
  useEffect(() => {
    if (sessionData && sessionData.currentPhase > 0) {
      router.replace(buildPlayUrl(classId));
    }
  }, [sessionData, router, classId]);

  // Warm the live-lesson route and the arcade runtime while students wait.
  const enrolled = Boolean(classInfo?.isEnrolled);
  useEffect(() => {
    if (!enrolled) return;
    router.prefetch("/interactive/play");
    const timer = window.setTimeout(() => void preloadArcadeRuntime(), 1500);
    return () => window.clearTimeout(timer);
  }, [enrolled, router]);

  // Teacher nudge: sound (as before) + a toast instead of a fixed banner.
  useEffect(() => {
    if (nudgeMessage) {
      playSound('nudged');
      toast(t("lessonLobby.nudgeTitle"), {
        description: nudgeMessage,
        icon: <Bell aria-hidden="true" className="size-4" />,
        duration: 5000,
      });
    }
  }, [nudgeMessage]);

  // The ready state only changes when the server broadcasts participants;
  // show a spinner until then (and block double taps).
  useEffect(() => {
    setReadyPending(false);
  }, [isReady]);
  useEffect(() => {
    if (!readyPending) return;
    const timer = window.setTimeout(() => setReadyPending(false), READY_PENDING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [readyPending]);

  if (!liffReady) {
    return <LobbySkeleton fallbackHref={classHref} />;
  }

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={classHref} />
        <ErrorState kind={liffErrorCode === "network" ? "offline" : "error"} onRetry={retryLiff} className="flex-1 justify-center" />
      </Screen>
    );
  }

  if (fetchingClass) {
    return <LobbySkeleton fallbackHref={classHref} />;
  }

  const homeLink = (
    <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
      {t("lessonLobby.backHome")}
    </Link>
  );

  if (kicked) {
    return (
      <Screen>
        <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref="/dashboard" />
        <StatusScreen
          icon={DoorOpen}
          tone="red"
          title={kicked}
          description={t("lessonLobby.contactTutorIfMistake")}
          primaryAction={homeLink}
        />
      </Screen>
    );
  }

  if (!classInfo) {
    return (
      <Screen>
        <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={classHref} />
        {loadError === "notFound" ? (
          <StatusScreen
            icon={SearchX}
            tone="neutral"
            title={t("lessonLobby.classNotFoundTitle")}
            description={t("lessonLobby.classNotFoundDescription")}
            primaryAction={homeLink}
          />
        ) : (
          <ErrorState
            kind={loadError === "offline" ? "offline" : "error"}
            title={loadError === "offline" ? undefined : t("lessonLobby.loadErrorTitle")}
            description={loadError === "offline" ? undefined : t("lessonLobby.loadErrorDescription")}
            onRetry={() => {
              setLoadError(null);
              setFetchingClass(true);
              setReloadKey((value) => value + 1);
            }}
            className="flex-1 justify-center"
          />
        )}
      </Screen>
    );
  }

  if (accessDenied) {
    return (
      <Screen>
        <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={classHref} />
        <StatusScreen
          icon={Lock}
          tone="amber"
          title={accessDenied}
          description={t("lessonLobby.enrollmentInactive")}
          primaryAction={
            <Link href={`/payment?classId=${classId}`} className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
              {t("lessonLobby.goPayment")}
            </Link>
          }
        />
      </Screen>
    );
  }

  if (paymentRequired) {
    return <PaymentRequiredScreen data={paymentRequired} classId={classId} title={t("lessonLobby.lobbyTitle")} />;
  }

  if (assessment.state && shouldShowLiveAssessment(assessment.state, sessionData?.currentPhase)) {
    return <main className="live-assessment-page">
      <LiveAssessmentStudent key={`${assessment.state.sessionId}-${assessment.state.mode}`} state={assessment.state} busy={assessment.busy} error={assessment.error} onAnswer={assessment.answer} lessonName={classInfo.name} tutorName={classInfo.tutor?.name} />
    </main>;
  }

  const readyCount = participants.filter(p => p.isReady).length;
  const selectedActivity = getLobbyActivityMode(assessment.state);
  const activity = getLobbyActivity(selectedActivity, isReady);
  const connection = getLessonConnectionState(error, Boolean(sessionData));
  const errorKind = getLessonErrorKind(error);
  const canToggleReady = Boolean(sessionData) && !error;

  const handleReadyToggle = () => {
    setReadyPending(true);
    toggleReady();
  };

  return (
    <Screen>
      <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={classHref} />

      <div className="flex flex-col gap-5 px-4 pt-3 pb-6">
        {/* Class hero */}
        <section className="rounded-[var(--radius-card)] bg-hero p-5 text-hero-fg shadow-[var(--shadow-card)]">
          <Chip tone="onBrand" icon={Radio}>{t("lessonLobby.liveBadge")}</Chip>
          <h2 className="mt-3 text-xl leading-[1.4] font-extrabold text-balance">{noOrphan(classInfo.name)}</h2>
          <p className="mt-1 text-sm leading-[1.5] text-pretty text-hero-fg-muted">
            {t("lessonLobby.tutorPrefix")} {classInfo.tutor?.name || t("lessonLobby.defaultTutor")}
          </p>
        </section>

        {/* The selected activity stays visible while students ready up in the normal Lobby. */}
        <Surface tone="brand" className="flex items-center gap-3" aria-label={t("lessonLobby.activityEyebrow")}>
          <IconTile icon={Play} tone="brand" size="lg" className="bg-surface" />
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-[13px] leading-[1.5] font-semibold text-brand-fg">{t("lessonLobby.activityEyebrow")}</p>
            <h3 className="text-base leading-[1.45] font-bold text-fg">{activity.title}</h3>
            <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{activity.description}</p>
          </div>
        </Surface>

        {/* Classmates */}
        <section aria-labelledby="lobby-classmates">
          <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
            <h2 id="lobby-classmates" className="flex items-center gap-2 text-[17px] leading-[1.5] font-bold text-fg">
              {t("lessonLobby.classmates")}
              <span className="rounded-full bg-fill-muted px-2 py-0.5 text-xs leading-[1.4] font-semibold text-fg-muted tabular-nums">
                {participants.length}
              </span>
            </h2>
            <Chip tone="brand" size="md" icon={Check}>
              {t("lessonLobby.readyPrefix")} {readyCount}/{participants.length}
            </Chip>
          </div>

          {participants.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border-2 border-dashed border-hairline px-5 py-8 text-center">
              <p aria-hidden="true" className="text-[32px] leading-none">👋</p>
              <p className="mt-3 text-sm leading-[1.6] text-fg-muted">{t("lessonLobby.waitingClassmates")}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
              {sortParticipantsMeFirst(participants, studentId).map((p) => {
                const isMe = p.studentId === studentId;
                return (
                  <li key={p.studentId} className="flex min-w-0 flex-col items-center gap-1.5">
                    <div className="relative">
                      <UserAvatar
                        src={p.pictureUrl}
                        name={p.name}
                        size="lg"
                        decorative
                        className={cn(
                          "ring-3 ring-offset-2 ring-offset-app transition-shadow",
                          isMe ? "ring-brand-vivid" : p.isReady ? "ring-brand-soft-border" : "ring-transparent",
                        )}
                      />
                      {p.isReady ? (
                        <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-brand-solid text-white ring-2 ring-app">
                          <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </div>
                    <p className={cn("w-full truncate text-center text-[13px] leading-[1.5] font-semibold", isMe ? "text-brand-fg" : "text-fg")}>
                      {isMe ? t("lessonLobby.me") : p.name}
                      {p.isReady ? <span className="sr-only"> · {t("lessonLobby.readyPrefix")}</span> : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Status */}
        {connection === "fatal" && errorKind === "notStarted" ? (
          // The usual state before the tutor starts: not a network failure.
          <Notice
            tone="info"
            icon={Hourglass}
            role="status"
            title={t("lessonLobby.notStartedTitle")}
            description={t("lessonLobby.notStartedDescription")}
            action={
              <Button variant="brand" size="touch" onClick={onReconnect}>
                {t("lessonLobby.checkAgainCta")}
              </Button>
            }
          />
        ) : connection === "fatal" ? (
          <Notice
            tone="danger"
            icon={WifiOff}
            role="alert"
            title={t("lessonLobby.connectFailedTitle")}
            description={errorKind === "server" && error ? error : t("lessonLobby.connectFailedDescription")}
            action={
              <Button variant="brand" size="touch" onClick={onReconnect}>
                {t("lessonLobby.reconnectCta")}
              </Button>
            }
          />
        ) : connection === "reconnecting" ? (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4">
            <Spinner size="sm" className="text-warning-fg" />
            <div className="min-w-0">
              <p className="text-sm leading-[1.5] font-bold text-warning-fg">{t("lessonLobby.reconnecting")}</p>
              <p className="text-[13px] leading-[1.6] text-fg-muted">{t("lessonLobby.reconnectingDescription")}</p>
            </div>
          </div>
        ) : !sessionData ? (
          <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-surface p-4">
            <Spinner size="sm" className="text-brand-fg" />
            <p className="text-sm leading-[1.5] text-fg-muted">{t("lessonLobby.connectingLesson")}</p>
          </div>
        ) : (
          <Notice
            tone={isReady ? "success" : "brand"}
            role="status"
            title={
              selectedActivity === "LESSON"
                ? isReady ? t("lessonLobby.waitingTutor") : t("lessonLobby.readyInstruction")
                : activity.description
            }
          />
        )}
      </div>

      <BottomActionBar>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!canToggleReady && connection === "ok" ? (
            <p className="text-center text-[13px] leading-[1.5] text-fg-muted">{t("lessonLobby.readyHintConnecting")}</p>
          ) : null}
          <Button
            variant={isReady ? "brandSoft" : "brand"}
            size="cta"
            className="w-full"
            onClick={handleReadyToggle}
            disabled={!canToggleReady}
            loading={readyPending}
          >
            {isReady ? t("lessonLobby.cancelReady") : t("lessonLobby.readyCta")}
          </Button>
        </div>
      </BottomActionBar>
    </Screen>
  );
}
