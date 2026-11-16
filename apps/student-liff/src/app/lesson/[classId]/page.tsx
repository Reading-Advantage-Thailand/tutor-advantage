"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, DoorOpen, Hand, Hourglass, Lock, Play, Radio, SearchX, WifiOff } from "lucide-react";
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
  EmptyState,
  ErrorState,
  IconTile,
  Notice,
  Screen,
  SectionHeader,
  Spinner,
  StatusScreen,
  Surface,
  UserAvatar,
} from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { noOrphan } from "@/lib/format";
import { buildPlayUrl } from "@/components/lesson/lessonRoutes";
import { HeroOverlap, ToneHero, classLevelTone } from "@/components/mobile/Hero";
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
  /** CEFR band of the class (GET /classes/:id sends it); colours the lobby hero. */
  cefr?: string | null;
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
    kicked,
    removedByTutor,
    roomInterrupted,
    rejoin,
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
      toast.message(t("lessonLobby.nudgeTitle"), {
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
        <div className="px-4 pt-4">
          <ErrorState card kind={liffErrorCode === "network" ? "offline" : "error"} onRetry={retryLiff} />
        </div>
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
    // A room that ended without the lesson finishing can come back.
    const canRejoin = removedByTutor || roomInterrupted;
    return (
      <Screen>
        <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref="/dashboard" />
        <StatusScreen
          icon={DoorOpen}
          tone={canRejoin ? "neutral" : "red"}
          title={removedByTutor ? t("lessonLobby.removedTitle") : kicked}
          description={
            removedByTutor
              ? t("lessonLobby.removedDescription")
              : roomInterrupted
                ? t("interactivePlay.roomInterruptedDescription")
                : t("lessonLobby.contactTutorIfMistake")
          }
          primaryAction={
            canRejoin ? (
              <Button variant="brand" size="cta" className="w-full" onClick={rejoin}>
                {t("lessonLobby.rejoin")}
              </Button>
            ) : homeLink
          }
          secondaryAction={
            canRejoin ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "cta" }), "w-full text-fg-muted")}>
                {t("lessonLobby.backHome")}
              </Link>
            ) : undefined
          }
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
            variant="notFound"
            title={t("lessonLobby.classNotFoundTitle")}
            description={t("lessonLobby.classNotFoundDescription")}
            primaryAction={homeLink}
          />
        ) : (
          <div className="px-4 pt-4">
            <ErrorState
              card
              kind={loadError === "offline" ? "offline" : "error"}
              title={loadError === "offline" ? undefined : t("lessonLobby.loadErrorTitle")}
              description={loadError === "offline" ? undefined : t("lessonLobby.loadErrorDescription")}
              onRetry={() => {
                setLoadError(null);
                setFetchingClass(true);
                setReloadKey((value) => value + 1);
              }}
            />
          </div>
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

  const tone = classLevelTone(classInfo.cefr);

  const status =
    connection === "fatal" && errorKind === "notStarted" ? (
      // The usual state before the tutor starts: not a network failure.
      <Notice
        tone="info"
        icon={Hourglass}
        role="status"
        title={t("lessonLobby.notStartedTitle")}
        description={t("lessonLobby.notStartedDescription")}
        action={
          <Button variant="brandSoft" size="touch" onClick={onReconnect}>
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
          <Button variant="brandSoft" size="touch" onClick={onReconnect}>
            {t("lessonLobby.reconnectCta")}
          </Button>
        }
      />
    ) : connection === "reconnecting" ? (
      <div
        role="status"
        className="flex items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-warning-border bg-warning-bg px-4 py-3.5"
      >
        <Spinner size="md" className="text-warning-fg" />
        <div className="min-w-0">
          <p className="text-[15px] leading-[1.5] font-semibold text-warning-fg">{t("lessonLobby.reconnecting")}</p>
          <p className="text-sm leading-[1.6] text-warning-fg">{t("lessonLobby.reconnectingDescription")}</p>
        </div>
      </div>
    ) : !sessionData ? (
      <div
        role="status"
        className="flex items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]"
      >
        <Spinner size="md" className="text-brand-fg" />
        <p className="text-[15px] leading-[1.6] text-fg-muted">{t("lessonLobby.connectingLesson")}</p>
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
    );

  return (
    <Screen>
      <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={classHref} tone={tone} />

      {/* Class hero in the class's band colour (patterns.md S5.1): live chip, class name, tutor. */}
      <ToneHero tone={tone} aria-labelledby="lobby-class-title">
        <Chip tone="paper" size="md" icon={Radio}>
          {t("lessonLobby.liveBadge")}
        </Chip>
        <h2 id="lobby-class-title" className="t-title-l mt-3 text-balance">
          {noOrphan(classInfo.name)}
        </h2>
        <p className="mt-2.5 flex min-w-0 items-center gap-2 text-[15px] leading-[1.6] font-semibold">
          <UserAvatar name={classInfo.tutor?.name || t("lessonLobby.defaultTutor")} size="sm" ring="surface" decorative />
          <span className="truncate">
            {t("lessonLobby.tutorPrefix")} {classInfo.tutor?.name || t("lessonLobby.defaultTutor")}
          </span>
        </p>
      </ToneHero>

      <HeroOverlap>
        {/* The selected activity stays visible while students ready up in the normal Lobby. */}
        <Surface padding="lg" className="flex items-center gap-3.5" aria-label={t("lessonLobby.activityEyebrow")}>
          <IconTile icon={Play} tone="brand" size="lg" />
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-sm leading-[1.6] font-medium text-brand-fg">{t("lessonLobby.activityEyebrow")}</p>
            <h3 className="t-title-s text-fg">{activity.title}</h3>
            <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{thaiCopy(activity.description)}</p>
          </div>
        </Surface>

        {/* Status next: whether the room is open decides what the student can do. */}
        {status}

        {/* Classmates */}
        <section aria-labelledby="lobby-classmates" className="flex flex-col gap-1">
          {/* Wraps on narrow phones: the ready chip drops under the title, which never truncates. */}
          <SectionHeader
            id="lobby-classmates"
            title={t("lessonLobby.classmates")}
            count={participants.length}
            wrap
            trailing={
              <Chip tone="brand" size="md" icon={Check} className="font-sans tabular-nums">
                {t("lessonLobby.readyPrefix")} {readyCount}/{participants.length}
              </Chip>
            }
          />

          {participants.length === 0 ? (
            <EmptyState
              card
              icon={Hand}
              tone="amber"
              headingLevel="h3"
              title={t("lessonLobby.waitingClassmates")}
              className="py-8"
            />
          ) : (
            <Surface padding="lg">
              <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
                {sortParticipantsMeFirst(participants, studentId).map((p) => {
                  const isMe = p.studentId === studentId;
                  return (
                    <li key={p.studentId} className="flex min-w-0 flex-col items-center gap-2">
                      <div className="relative">
                        <UserAvatar
                          src={p.pictureUrl}
                          name={p.name}
                          size="lg"
                          decorative
                          className={cn(
                            "ring-3 ring-offset-2 ring-offset-surface transition-shadow",
                            isMe ? "ring-brand-vivid" : p.isReady ? "ring-brand-soft-border" : "ring-transparent",
                          )}
                        />
                        {p.isReady ? (
                          <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-brand-solid text-on-brand ring-2 ring-surface">
                            <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={cn(
                          "w-full truncate text-center text-sm leading-[1.5] font-semibold",
                          isMe ? "text-brand-fg" : "text-fg",
                        )}
                      >
                        {isMe ? t("lessonLobby.me") : p.name}
                        {p.isReady ? <span className="sr-only"> · {t("lessonLobby.readyPrefix")}</span> : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Surface>
          )}
        </section>
      </HeroOverlap>

      <BottomActionBar>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!canToggleReady && connection === "ok" ? (
            <p className="text-center text-sm leading-[1.6] text-fg-muted">{t("lessonLobby.readyHintConnecting")}</p>
          ) : null}
          <Button
            variant={isReady ? "brandSoft" : "brand"}
            size="cta-lg"
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
