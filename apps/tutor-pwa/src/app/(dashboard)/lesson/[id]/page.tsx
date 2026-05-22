"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Play, Settings, Sparkles, Users, Zap } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n";

export default function LessonDetailPage() {
  const params = useParams();
  const classId = params.id as string;

  const steps = [
    {
      step: 1,
      icon: <BookOpen className="h-5 w-5" />,
      title: t("lesson.selectLesson"),
      desc: t("lesson.selectLessonStepDescription"),
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/15",
      borderColor: "border-blue-500/20",
    },
    {
      step: 2,
      icon: <Zap className="h-5 w-5" />,
      title: t("lesson.shareClassLink"),
      desc: t("lesson.shareClassLinkDescription"),
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      borderColor: "border-amber-500/20",
    },
    {
      step: 3,
      icon: <Play className="h-5 w-5" />,
      title: t("lesson.teach"),
      desc: t("lesson.teachDescription"),
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      borderColor: "border-emerald-500/20",
    },
  ];

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {t("lesson.manageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("lesson.manageSubtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <Link href={`/lesson/${classId}/select`} className="block group">
          <Card className="cursor-pointer border-2 border-primary/20 hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 h-full overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
            <CardContent className="p-7 flex flex-col items-center justify-center text-center min-h-[220px]">
              <div className="w-18 h-18 rounded-2xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Play className="h-9 w-9 text-primary fill-primary/20" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t("lesson.startTeaching")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("lesson.startTeachingDescription")}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                <Zap className="h-3.5 w-3.5" />
                <span>{t("lesson.openLiveRoom")}</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/classes/${classId}`} className="block group">
          <Card className="cursor-pointer border-2 border-border/60 hover:border-primary/50 hover:shadow-lg transition-all duration-300 h-full overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/10 to-transparent" />
            <CardContent className="p-7 flex flex-col items-center justify-center text-center min-h-[220px]">
              <div className="w-18 h-18 rounded-2xl bg-muted flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Settings className="h-9 w-9 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t("lesson.classSettings")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("lesson.classSettingsDescription")}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                <Users className="h-3.5 w-3.5" />
                <span>{t("lesson.manageClass")}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="border-border/40 bg-card/50 dark:bg-card/80 overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{t("lesson.howToUse")}</h3>
        </div>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((item) => (
              <div
                key={item.step}
                className={`relative rounded-xl border ${item.borderColor} bg-card p-5 transition-all hover:shadow-md`}
              >
                <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
                  <span className={`text-xs font-black ${item.color}`}>{item.step}</span>
                </div>

                <div className={`mb-2 ${item.color}`}>{item.icon}</div>
                <h4 className="font-bold text-foreground text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
