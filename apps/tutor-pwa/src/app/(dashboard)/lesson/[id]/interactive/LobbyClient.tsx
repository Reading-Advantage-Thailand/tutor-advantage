"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { playSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Users, Bell, UserMinus, ShieldCheck,
  BookOpen, Play, AlertCircle, X,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PhaseManager } from "./PhaseManager";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { t } from "@/lib/i18n";

export default function TutorLobbyClient({
  classId,
  articleId,
  classBookCycleId,
  bookId,
  socketUrl,
}: {
  classId: string;
  articleId: string;
  classBookCycleId?: string;
  bookId?: string;
  socketUrl: string;
}) {
  const router = useRouter();

  const tutorId = "tutor-123";

  const {
    sessionData,
    participants,
    articleData,
    totalAnswered,
    allAnsweredData,
    error,
    flagCounts,
    changePhase,
    nudgeStudent,
    kickStudent,
    deleteSession,
  } = useLessonSocket(tutorId, articleId, classId, socketUrl, classBookCycleId, bookId);

  const readyCount = participants.filter((participant) => participant.isReady).length;
  const totalCount = participants.length;
  const isEveryoneReady = totalCount > 0 && readyCount === totalCount;

  // Article image URL from GCS
  const articleImgId = (articleData as any)?.id as string | undefined;
  const articleImageUrl = articleImgId
    ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleImgId}.png`
    : null;

  if (sessionData && sessionData.currentPhase > 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/classes/${classId}`}>
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <ArrowLeft />
                </Button>
              </Link>
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
              articleData={articleData}
              flagCounts={flagCounts}
              changePhase={changePhase}
              onFinishSession={() => {
                deleteSession();
                router.push(`/dashboard/classes/${classId}`);
              }}
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
        <Link href={`/dashboard/classes/${classId}`}>
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
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/classes/${classId}`}>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-foreground">{t("lesson.interactive.lobbyTitle")}</h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 font-bold">
                  <span className="live-dot text-emerald-500" />
                  Live Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Class ID: {classId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <div className="flex items-center gap-2">
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
                className="rounded-xl gap-1.5"
                onClick={() => {
                  if (confirm(t("lesson.interactive.closeRoomConfirm"))) {
                    deleteSession();
                    router.push(`/dashboard/classes/${classId}`);
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t("lesson.interactive.closeRoom")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-5">
          {/* Article Hero Card */}
          <div className="overflow-hidden rounded-3xl border border-border/60 shadow-xl bg-card">
            {/* Image Banner */}
            <div className="relative h-44 bg-gradient-to-br from-indigo-500 to-violet-600 overflow-hidden">
              {articleImageUrl && (
                <img
                  src={articleImageUrl}
                  alt={articleData?.title || "article"}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Badges overlaid on image */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="bg-white/20 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={10} /> {t("lesson.interactive.teaching")}
                </span>
                {articleData?.cefr_level && (
                  <span className="bg-indigo-500/80 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                    CEFR {articleData.cefr_level}
                  </span>
                )}
              </div>
              {/* Title at bottom of image */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h2 className="text-white text-lg font-black leading-tight line-clamp-2 drop-shadow-lg">
                  {articleData?.title || t("lesson.interactive.lessonLoading")}
                </h2>
              </div>
            </div>
            {/* Article meta */}
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {articleData?.translated_summary?.th?.[0] ||
                  articleData?.summary?.th?.[0] ||
                  (typeof articleData?.summary === "string" ? articleData.summary : "") ||
                  articleData?.description ||
                  t("lesson.interactive.noDescription")}
              </p>
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground">{t("lesson.interactive.phasesCount")}</p>
                  <p className="font-black text-foreground text-sm">{t("lesson.interactive.steps14")}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground">{t("lesson.interactive.contentType")}</p>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">Reading & Vocab</p>
                </div>
                {articleData?.genre && (
                  <>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground">Genre</p>
                      <p className="font-bold text-foreground text-xs truncate">{articleData.genre}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-500" /> {t("lesson.interactive.tutorTips")}
            </h4>
            <ul className="text-xs text-muted-foreground space-y-2.5 list-none">
              {[t("lesson.interactive.tipWaitReady"), t("lesson.interactive.tipNudge"), t("lesson.interactive.tipReconnect")].map((tip) => (
                <li key={tip} className="flex gap-2.5 items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2.5">
              <Users className="text-primary" />
              {t("lesson.interactive.studentsInRoom")}
              <Badge variant="secondary" className="ml-1 text-xs font-bold">{totalCount}</Badge>
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("lesson.interactive.readiness")}</span>
              <span className={`font-bold ${isEveryoneReady ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                {readyCount} / {totalCount} {t("lesson.interactive.peopleUnit")}
              </span>
            </div>
          </div>

          <div className={`grid gap-4 ${participants.length === 0 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
            {participants.length === 0 ? (
              <div className="py-20 bg-card rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="text-indigo-500" size={28} />
                </div>
                <h4 className="font-bold text-lg text-foreground">{t("lesson.interactive.emptyStudentsTitle")}</h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {t("lesson.interactive.emptyStudentsLinkMessage")}
                </p>
              </div>
            ) : (
              participants.map((participant) => (
                <div
                  key={participant.studentId}
                  className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 ${
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

          <div className="pt-6">
            <button
              className={`w-full py-5 rounded-2xl text-lg font-black flex items-center justify-center gap-3 shadow-xl transition-all duration-300 ${
                isEveryoneReady
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-indigo-500/30 active:scale-[0.98] shimmer-cta"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              disabled={!isEveryoneReady}
              onClick={() => { changePhase(1); playSound("phaseChange"); }}
            >
              <Play fill="currentColor" className="h-6 w-6" />
              {isEveryoneReady ? t("lesson.interactive.startNow") : `${t("lesson.interactive.waitingReadyPrefix")} (${readyCount}/${totalCount})`}
            </button>
            {!isEveryoneReady && totalCount > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                {t("lesson.interactive.readyOnlyNote")}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
