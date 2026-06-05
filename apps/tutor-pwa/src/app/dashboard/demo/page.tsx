"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Play, Sparkles, Gift } from "lucide-react";
import { t } from "@/lib/i18n";
import { getDemoLessons, type DemoLessonSummary } from "./actions";

const CEFR_COLORS: Record<string, string> = {
  A1: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  A2: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  B1: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  B2: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

export default function DemoLessonsPage() {
  const [lessons, setLessons] = useState<DemoLessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getDemoLessons();
        if (mounted) setLessons(data);
      } catch (err) {
        console.error("Failed to load demo lessons:", err);
        if (mounted) setError(t("demo.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{t("demo.title")}</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 font-bold">
              <Gift className="h-3 w-3" />
              {t("demo.freeBadge")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("demo.subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="my-4 p-4 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-5 h-40 animate-pulse bg-muted/40 rounded-xl" />
            </Card>
          ))
        ) : lessons.length === 0 ? (
          <Card className="border-border/60 md:col-span-2">
            <CardContent className="pt-6 text-center text-muted-foreground">
              {t("demo.empty")}
            </CardContent>
          </Card>
        ) : (
          lessons.map((lesson) => (
            <Card
              key={lesson.articleId}
              className="border-2 border-border/60 hover:border-violet-500/50 hover:shadow-lg transition-all duration-300 overflow-hidden group"
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant="outline"
                    className={`font-bold ${CEFR_COLORS[lesson.cefr] || "bg-muted text-muted-foreground border-border"}`}
                  >
                    CEFR {lesson.cefr}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    {t("demo.levelPrefix")} {lesson.level}
                  </span>
                </div>

                <div className="flex items-start gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-violet-500 shrink-0 mt-1" />
                  <h3 className="font-bold text-lg text-foreground leading-snug">{lesson.title}</h3>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{lesson.summary}</p>

                <Link
                  href={`/lesson/demo/interactive?articleId=${encodeURIComponent(lesson.articleId)}&demo=1`}
                  className="block"
                >
                  <Button className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white">
                    <Play className="h-4 w-4 fill-current" />
                    {t("demo.start")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {t("demo.infoTitle")}
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[t("demo.infoLine1"), t("demo.infoLine2"), t("demo.infoLine3")].map((line) => (
              <li key={line} className="flex gap-2.5 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
