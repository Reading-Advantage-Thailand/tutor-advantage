"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { playSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Users, Bell, UserMinus, ShieldCheck,
  BookOpen, Play, AlertCircle, X, Copy, CheckCircle2, QrCode,
  Lightbulb, BarChart3, Settings2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { PhaseManager } from "./PhaseManager";
import { sendLobbyNotifications } from "./actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Sidebar } from "@/components/layout/sidebar";
import { t } from "@/lib/i18n";
import { useLiveAssessment } from "@/hooks/useLiveAssessment";
import LiveAssessmentControls from "@/components/LiveAssessmentControls";

// Keep every invite action in one place so the waiting area stays aligned and
// tutors do not have to scan two separate cards before starting a class.
function LobbyInviteCard({
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
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-emerald-500/25 bg-card/95 shadow-lg shadow-emerald-950/10 lg:min-h-0">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-emerald-500/15 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent px-4 py-3 sm:px-5">
        <div className="size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
          <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{t("lesson.interactive.inviteTitle")}</p>
          <p className="text-[11px] text-muted-foreground">{t("lesson.interactive.inviteHelp")}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {referralLink ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
            <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-emerald-950/20">
              <QRCodeSVG value={referralLink} size={96} level="M" includeMargin={false} />
            </div>
            <div className="flex w-full items-center gap-2">
              <input
                readOnly
                value={referralLink}
                aria-label="ลิงก์เชิญนักเรียนเข้าห้อง"
                className="h-8 min-w-0 flex-1 truncate rounded-lg border border-input bg-muted px-3 font-mono text-xs text-foreground"
              />
              <button
                type="button"
                onClick={handleCopy}
                title={t("lesson.interactive.inviteCopy")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input transition-colors hover:bg-muted"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <p aria-live="polite" className="min-h-3 text-[10px] font-semibold leading-3 text-emerald-600 dark:text-emerald-400">
              {copied ? t("lesson.interactive.inviteCopied") : ""}
            </p>
          </div>
        ) : (
          <div className="flex min-h-28 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-4 text-center">
            <QrCode className="mb-2 size-7 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">กำลังเตรียมลิงก์เชิญนักเรียน</p>
          </div>
        )}

        <div className="mt-2 shrink-0 border-t border-border/60 pt-2">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Bell size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">เรียกนักเรียนผ่าน LINE</p>
              <p className="truncate text-[11px] text-muted-foreground">ส่งปุ่มเข้าเรียนให้นักเรียนในคลาส</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full border-emerald-500/45 bg-emerald-500/5 text-xs font-bold text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
            disabled={isSending}
            onClick={() => void onSendNotification()}
          >
            <Bell className="mr-2 h-3.5 w-3.5" />
            {isSending ? "กำลังส่ง LINE..." : "เรียกนักเรียนเข้าเรียน"}
          </Button>
          {notificationStatus && (
            <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-relaxed text-muted-foreground">
              {notificationStatus}
            </p>
          )}
        </div>
      </div>
    </section>
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
  const startPhasePendingRef = React.useRef(false);
  const [isStartingPhase, setIsStartingPhase] = React.useState(false);

  const startPhase = React.useCallback((bypassStudentGuard = false) => {
    if (startPhasePendingRef.current || !lessonSelected) return;
    startPhasePendingRef.current = true;
    setIsStartingPhase(true);
    if (bypassStudentGuard) setBypassEmptyStudentGuard(true);
    playSound("phaseChange");
    void changePhase(1).finally(() => {
      startPhasePendingRef.current = false;
      setIsStartingPhase(false);
    });
  }, [changePhase, lessonSelected]);

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
          ? `ส่ง LINE แล้ว ${result.sent}/${result.eligible} คน`
          : formatLobbyNotificationFailure(result.failures),
      );
    } catch (error) {
      setLobbyNotificationStatus(error instanceof Error ? error.message : "ส่ง LINE ไม่สำเร็จ");
    } finally {
      setIsSendingLobbyNotification(false);
    }
  };

  // Article image URL from GCS
  const primaryImageUrl = Array.isArray((articleData as any)?.image_urls)
    ? (articleData as any).image_urls.find((url: unknown) => typeof url === "string" && url.length > 0)
    : null;
  const articleImgId = (articleData as any)?.id as string | undefined;
  const articleImageUrl = primaryImageUrl || (articleImgId
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleImgId}.png`
    : null);

  if (sessionData && sessionData.currentPhase > 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => { void handleFinishAndNavigate(); }}
                disabled={isFinishingSession}
                aria-label="Finish lesson and return"
              >
                <ArrowLeft />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t("lesson.interactive.teachingPrefix")} {articleData?.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("lesson.interactive.phasePrefix")} {sessionData.currentPhase}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Badge className="bg-primary text-primary-foreground px-4 py-1.5 text-sm font-bold gap-2">
                <span className="live-dot" />
                Live Teaching
              </Badge>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-xl border border-border p-8 min-h-[70vh]">
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
              onFinishSession={() => { void handleFinishAndNavigate(); }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-destructive/5 flex-col gap-4 p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t("lesson.interactive.sessionCreateError")}</h2>
        <p className="text-muted-foreground max-w-md">{error}</p>
        <Link href={backHref}>
          <Button variant="outline" className="mt-2">{t("lesson.interactive.backToClass")}</Button>
        </Link>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background flex-col gap-4">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">{t("lesson.interactive.preparingRoom")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[radial-gradient(circle_at_78%_-12%,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.1),transparent_28%)] bg-background pb-8">
      <div className="fixed inset-y-0 left-0 z-40 hidden xl:flex">
        <Sidebar />
      </div>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 px-3 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8">
        <div id="lobby-top" className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 xl:ml-72 xl:mr-8 xl:max-w-none">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
            <Link href={backHref}>
              <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl hover:bg-muted sm:size-10" aria-label={t("lesson.interactive.backToClass")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                <h1 className="truncate text-sm font-black leading-5 text-foreground sm:text-base">{t("lesson.interactive.lobbyTitle")}</h1>
                {demo ? (
                  <Badge variant="outline" className="hidden gap-1.5 border-violet-500/20 bg-violet-500/10 font-bold text-violet-600 dark:text-violet-400 sm:inline-flex">
                    {t("lesson.interactive.demoBadge")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="hidden gap-1.5 border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                    <span className="live-dot text-emerald-500" />
                    Live Active
                  </Badge>
                )}
              </div>
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                {demo ? t("lesson.interactive.demoSubtitle") : `Class ID: ${classId}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="rounded-xl border border-border/60 bg-card/70 p-0.5"><ThemeToggle /></div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 font-bold text-xs"
                  onClick={() => deleteSession()}
                >
                  [DEV] Delete
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="h-9 rounded-xl px-2.5 text-xs sm:h-10 sm:px-3 sm:text-sm"
                onClick={() => {
                  if (confirm(t("lesson.interactive.closeRoomConfirm"))) {
                    deleteSession();
                    router.push(backHref);
                  }
                }}
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">{t("lesson.interactive.closeRoom")}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] grid-cols-1 items-stretch gap-4 p-3 sm:gap-5 sm:p-5 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-6 xl:ml-72 xl:mr-8 xl:max-w-none">
          {/* Row 1: lesson context and the activity choice */}
          <section className={`relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-slate-950/10 ${assessmentSupported ? "lg:col-span-8 lg:h-[22rem]" : "lg:col-span-12"}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600">
              {articleImageUrl && (
                <img
                  src={articleImageUrl}
                  alt={articleData?.title || "article"}
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
            </div>
            <div className={`relative flex min-h-[324px] flex-col justify-end ${assessmentSupported ? "lg:h-full" : "sm:min-h-[350px]"}`}>
              <div className="space-y-3 p-5 sm:p-6 lg:p-7">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-950/20 backdrop-blur">
                    <BookOpen size={10} /> {t("lesson.interactive.teaching")}
                  </span>
                  {articleData?.content_provider !== "PRIMARY_ADVANTAGE" && articleData?.cefr_level && (
                    <span className="rounded-full bg-indigo-500/80 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                      CEFR {String(articleData.cefr_level).replace(/^CEFR\s*/i, "")}
                    </span>
                  )}
                </div>
                <div className="max-w-xl">
                  <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-3xl lg:text-[2rem]">
                    {articleData?.title || t("lesson.interactive.lessonLoading")}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/80">
                    {(articleData?.translated_summary as any)?.th?.[0] ||
                      (articleData?.summary as any)?.th?.[0] ||
                      (typeof articleData?.summary === "string" ? articleData.summary : "") ||
                      articleData?.description ||
                      t("lesson.interactive.noDescription")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-300/30 bg-blue-500/25 px-2.5 py-1 text-[11px] font-semibold text-blue-100">Reading &amp; Vocab</span>
                  {articleData?.genre && <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">{articleData.genre}</span>}
                  <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">Early Learning</span>
                </div>
              </div>
              <div className="grid grid-cols-2 border-t border-white/15 bg-slate-950/55 backdrop-blur-md sm:grid-cols-4">
                <div className="min-w-0 px-3 py-3 text-center sm:px-2.5">
                  <p className="text-[11px] text-white/55">{t("lesson.interactive.phasesCount")}</p>
                  <p className="mt-1 truncate text-sm font-black text-white">{t("lesson.interactive.steps14")}</p>
                </div>
                <div className="min-w-0 border-l border-white/10 px-3 py-3 text-center sm:px-2.5">
                  <p className="text-[11px] text-white/55">{t("lesson.interactive.contentType")}</p>
                  <p className="mt-1 truncate text-xs font-bold text-blue-200">Reading &amp; Vocab</p>
                </div>
                <div className="min-w-0 border-t border-white/10 px-3 py-3 text-center sm:border-l sm:border-t-0 sm:px-2.5">
                  <p className="text-[11px] text-white/55">Genre</p>
                  <p className="mt-1 truncate text-xs font-bold text-white/90">{articleData?.genre || "—"}</p>
                </div>
                <div className="min-w-0 border-l border-white/10 border-t px-3 py-3 text-center sm:border-t-0 sm:px-2.5">
                  <p className="text-[11px] text-white/55">ระดับผู้เรียน</p>
                  <p className="mt-1 truncate text-xs font-bold text-emerald-200">{articleData?.cefr_level ? String(articleData.cefr_level).replace(/^CEFR\s*/i, "") : articleData?.content_provider === "PRIMARY_ADVANTAGE" ? "Elementary" : "—"}</p>
                </div>
              </div>
            </div>
          </section>

          {assessmentSupported && <div id="lobby-activity" className="lg:col-span-4 lg:h-[22rem]"><LiveAssessmentControls state={assessment.state} busy={assessment.busy} error={assessment.error} onControl={assessment.control} /></div>}

          {/* Row 2: every way to join, paired with the room roster */}
          {!demo && (
            <div id="lobby-invite" className="lg:col-span-4 lg:h-[22rem]">
              <LobbyInviteCard
                referralLink={referralLink}
                isSending={isSendingLobbyNotification}
                notificationStatus={lobbyNotificationStatus}
                onSendNotification={handleSendLobbyNotification}
              />
            </div>
          )}

          <section id="lobby-students" className={`flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg shadow-slate-950/5 lg:h-[22rem] ${demo ? "lg:col-span-12" : "lg:col-span-8"}`}>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5 sm:px-5">
              <h3 className="flex items-center gap-2.5 text-base font-bold text-foreground sm:text-lg">
                <Users className="size-5 text-primary" />
                {t("lesson.interactive.studentsInRoom")}
                <Badge variant="secondary" className="ml-1 text-xs font-bold">{totalCount}</Badge>
              </h3>
              <div className="flex items-end gap-1.5 text-sm sm:items-center sm:gap-2">
                <span className="hidden text-muted-foreground sm:inline">{t("lesson.interactive.readiness")}</span>
                <span className={`font-bold ${isEveryoneReady ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {readyCount} / {totalCount} {t("lesson.interactive.peopleUnit")}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4">
            <div className={`grid content-start items-start auto-rows-max gap-3 ${participants.length === 0 ? 'h-full min-h-[14rem] grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
            {participants.length === 0 ? (
              <div className="flex h-full min-h-[14rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 shadow-inner shadow-indigo-500/10">
                  <Users className="text-indigo-500" size={28} />
                </div>
                <h4 className="font-bold text-lg text-foreground">
                  {demo ? t("lesson.interactive.demoEmptyTitle") : t("lesson.interactive.emptyStudentsTitle")}
                </h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {demo ? t("lesson.interactive.demoEmptyMessage") : t("lesson.interactive.emptyStudentsLinkMessage")}
                </p>
              </div>
            ) : (
              participants.map((participant) => (
                <div
                  key={participant.studentId}
                  className={`group relative h-fit self-start flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 ${
                    participant.isReady
                      ? "border-emerald-400/60 bg-emerald-500/5 shadow-md shadow-emerald-500/10"
                      : "border-dashed border-border bg-card"
                  }`}
                >
                  {/* Avatar with ring */}
                  <div className="relative">
                    {participant.isReady && (
                      <div className="absolute -inset-1.5 rounded-full border-4 border-emerald-400 animate-pulse" />
                    )}
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-white shadow-md">
                      <img
                        src={participant.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.name}`}
                        alt={participant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {participant.isReady && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-card shadow">
                        <ShieldCheck size={10} color="white" />
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <p className="font-bold text-xs text-foreground text-center truncate w-full px-1">{participant.name}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${participant.isReady ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {participant.isReady ? "✓ Ready" : "Waiting…"}
                  </p>

                  {/* Action buttons — always visible */}
                  <div className="flex items-center gap-1">
                    {!participant.isReady && (
                      <button
                        className="h-7 w-7 rounded-lg text-orange-500 hover:bg-orange-500/10 flex items-center justify-center transition-colors"
                        onClick={() => { nudgeStudent(participant.studentId); playSound("nudge"); }}
                        title={t("lesson.interactive.nudgeTitle")}
                      >
                        <Bell size={13} />
                      </button>
                    )}
                    <button
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors"
                      onClick={() => kickStudent(participant.studentId)}
                      title={t("lesson.interactive.kickTitle")}
                    >
                      <UserMinus size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
            </div>
            </div>
          </section>

          {/* Row 3: one clear, full-width action for the selected activity */}
          <section className="rounded-2xl border border-border/70 bg-card p-2 shadow-lg shadow-slate-950/5 lg:col-span-12">
            <button
              className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-base font-black shadow-md transition-all duration-300 sm:text-lg ${
                activitySelectionReady && canStart && (!assessmentSelected || assessment.state?.status === "LOBBY") && !assessment.state?.paused
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-indigo-500/30 active:scale-[0.98] shimmer-cta"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              disabled={!activitySelectionReady || !canStart || isStartingPhase || assessment.busy || Boolean(assessment.state?.paused) || (assessmentSelected && assessment.state?.status !== "LOBBY")}
              onClick={() => { void startSelectedActivity(); }}
            >
              <Play fill="currentColor" className="h-6 w-6" />
              {!activitySelectionReady
                ? "กำลังโหลดกิจกรรม…"
                : isStartingPhase || assessment.busy
                ? "กำลังเริ่ม…"
                : assessmentSelected && assessment.state?.status === "RUNNING"
                  ? `กำลังทำแบบประเมิน${assessment.state.mode === "PRE" ? "ก่อนเรียน" : "หลังเรียน"}`
                  : assessmentSelected && assessment.state?.status === "FINISHED"
                    ? "เลือกกิจกรรมถัดไป"
                    : !demo && !isEveryoneReady
                      ? `${t("lesson.interactive.waitingReadyPrefix")} (${readyCount}/${totalCount})`
                      : assessmentSelected
                        ? `เริ่มแบบประเมิน${assessment.state?.mode === "PRE" ? "ก่อนเรียน" : "หลังเรียน"}`
                        : demo
                          ? t("lesson.interactive.startDemo")
                          : t("lesson.interactive.startNow")}
            </button>
            {!demo && !isEveryoneReady && totalCount > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                * เริ่มกิจกรรมได้เมื่อนักเรียนทุกคนกด Ready แล้วเท่านั้น
              </p>
            )}
            {canDevStart && lessonSelected && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2 border-amber-400/70 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                onClick={() => startPhase(true)}
              >
                DEV: เข้าเรียนทันที (ไม่ต้องรอนักเรียน)
              </Button>
            )}
            {demo && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                {t("lesson.interactive.demoSoloNote")}
              </p>
            )}
          </section>

        <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-4 shadow-lg shadow-indigo-950/5 lg:col-span-12 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3 lg:w-56 lg:shrink-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
                <Lightbulb size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-foreground">{t("lesson.interactive.tutorTips")}</h4>
                <p className="mt-1 text-xs text-muted-foreground">เคล็ดลับเริ่มห้องเรียนให้ราบรื่น</p>
              </div>
            </div>
            <ul className="grid flex-1 gap-2.5 text-xs text-muted-foreground sm:grid-cols-3">
              {tutorTips.map(([Icon, tip]) => (
                <li key={tip} className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/45 p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"><Icon size={15} /></span>
                  <span className="leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

function formatLobbyNotificationFailure(failures?: Record<string, number>) {
  const [reason, count = 0] = Object.entries(failures || {})[0] || [];
  if (reason === "PREFERENCE_DISABLED") return `นักเรียนปิดการแจ้งเตือน ${count} คน`;
  if (reason === "LINE_NOT_LINKED") return `นักเรียนยังไม่ได้เชื่อม LINE ${count} คน`;
  if (reason === "LINE_API_400") return "LINE ไม่พบผู้รับใน OA นี้ — ให้ตรวจว่า LINE Login และ Messaging API อยู่ใน Provider เดียวกัน และนักเรียน add friend OA แล้ว";
  if (reason?.startsWith("LINE_API_")) return `LINE ปฏิเสธการส่ง (${reason.replace("LINE_API_", "HTTP ")})`;
  if (reason === "LINE_NOT_CONFIGURED") return "ยังไม่ได้ตั้งค่า LINE Messaging API ใน backend";
  return "ยังส่ง LINE ไม่ได้ — ไม่พบผู้รับที่ส่งได้";
}
