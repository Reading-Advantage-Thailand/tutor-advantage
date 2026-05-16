"use client";

import React, { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { playSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Users, Bell, UserMinus, ShieldCheck,
  BookOpen, Play, AlertCircle, Copy, Check, X,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PhaseManager } from "./PhaseManager";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { t } from "@/lib/i18n";

export default function TutorLobbyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = params.id as string;
  const articleId = searchParams.get("articleId") as string;

  const tutorId = "tutor-123";
  const [copiedPin, setCopiedPin] = useState(false);

  const {
    sessionData,
    participants,
    articleData,
    totalAnswered,
    allAnsweredData,
    error,
    changePhase,
    nudgeStudent,
    kickStudent,
    deleteSession,
  } = useLessonSocket(tutorId, articleId, classId);

  const readyCount = participants.filter((participant) => participant.isReady).length;
  const totalCount = participants.length;
  const isEveryoneReady = totalCount > 0 && readyCount === totalCount;

  const copyPin = async () => {
    if (!sessionData?.pin) return;
    try {
      await navigator.clipboard.writeText(sessionData.pin);
      setCopiedPin(true);
      playSound("tick");
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Clipboard may fail in some environments.
    }
  };

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
            <button
              onClick={copyPin}
              className="flex items-center gap-3 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 hover:border-primary/40 rounded-xl px-4 py-2.5 transition-all group cursor-pointer"
              title={t("lesson.interactive.copyPinTitle")}
            >
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Session PIN</p>
                <p className="text-2xl font-black text-primary pin-display">{sessionData.pin}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                {copiedPin ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-primary" />}
              </div>
            </button>

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
          <Card className="overflow-hidden border-border/60 shadow-lg">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
              <div className="flex items-center gap-2 mb-4 opacity-80">
                <BookOpen size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">{t("lesson.interactive.teaching")}</span>
              </div>
              <h2 className="text-xl font-bold leading-tight mb-2">
                {articleData?.title || t("lesson.interactive.lessonLoading")}
              </h2>
              <p className="text-sm opacity-90 line-clamp-2">
                {articleData?.translated_summary?.th?.[0] ||
                  articleData?.summary?.th?.[0] ||
                  (typeof articleData?.summary === "string" ? articleData.summary : "") ||
                  articleData?.description ||
                  t("lesson.interactive.noDescription")}
              </p>
            </div>
            <CardContent className="p-5 bg-card">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t("lesson.interactive.phasesCount")}</span>
                  <span className="font-bold text-foreground">{t("lesson.interactive.steps14")}</span>
                </div>
                <Separator className="bg-border" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t("lesson.interactive.contentType")}</span>
                  <Badge variant="secondary" className="font-semibold">Reading & Vocabulary</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-primary/5 dark:bg-primary/8">
            <CardContent className="p-5">
              <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> {t("lesson.interactive.tutorTips")}
              </h4>
              <ul className="text-xs text-muted-foreground space-y-2.5 list-none">
                {[t("lesson.interactive.tipWaitReady"), t("lesson.interactive.tipNudge"), t("lesson.interactive.tipReconnect")].map((tip) => (
                  <li key={tip} className="flex gap-2.5 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {participants.length === 0 ? (
              <div className="col-span-2 py-20 bg-card rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                  <Users className="text-muted-foreground" size={28} />
                </div>
                <h4 className="font-bold text-lg text-foreground">{t("lesson.interactive.emptyStudentsTitle")}</h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {t("lesson.interactive.emptyStudentsPrefix")} <span className="font-bold text-primary pin-display">{sessionData.pin}</span> {t("lesson.interactive.emptyStudentsSuffix")}
                </p>
              </div>
            ) : (
              participants.map((participant) => (
                <Card key={participant.studentId} className={`overflow-hidden border-2 transition-all duration-300 ${participant.isReady ? "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card"}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden border border-border">
                        <img src={participant.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.name}`} alt={participant.name} className="w-full h-full object-cover" />
                      </div>
                      {participant.isReady && (
                        <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-card">
                          <ShieldCheck size={10} color="white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{participant.name}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${participant.isReady ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {participant.isReady ? "Ready to Learn" : "Waiting..."}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {!participant.isReady && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-orange-500 hover:bg-orange-500/10 rounded-lg"
                          onClick={() => { nudgeStudent(participant.studentId); playSound("nudge"); }}
                          title={t("lesson.interactive.nudgeTitle")}
                        >
                          <Bell size={16} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg"
                        onClick={() => kickStudent(participant.studentId)}
                        title={t("lesson.interactive.kickTitle")}
                      >
                        <UserMinus size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="pt-6">
            <Button
              className={`w-full h-18 rounded-2xl text-lg font-bold gap-3 shadow-xl transition-all duration-300 ${
                isEveryoneReady
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-500/25 shimmer-cta"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              disabled={!isEveryoneReady}
              onClick={() => { changePhase(1); playSound("phaseChange"); }}
            >
              <Play fill="currentColor" className="h-6 w-6" />
              {isEveryoneReady ? t("lesson.interactive.startNow") : `${t("lesson.interactive.waitingReadyPrefix")} (${readyCount}/${totalCount})`}
            </Button>
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
