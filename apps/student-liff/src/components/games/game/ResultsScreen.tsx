import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Zap, AlertCircle } from "lucide-react";
import { VocabularyItem } from "@/store/useGameStore";
import { useScopedI18n } from "@/locales/client";

interface ResultsScreenProps {
  score: number;
  accuracy: number;
  xp: number;
  missedWords: VocabularyItem[];
  onRestart: () => void;
  onShowRanking: () => void;
}

export function ResultsScreen({
  score,
  accuracy,
  xp,
  missedWords,
  onRestart,
  onShowRanking,
}: ResultsScreenProps) {
  const t = useScopedI18n("pages.student.gamesPage");

  const uniqueMissedWords = useMemo(() => {
    return Array.from(new Set(missedWords.map((w) => JSON.stringify(w)))).map(
      (s) => JSON.parse(s),
    ) as VocabularyItem[];
  }, [missedWords]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-2xl bg-gradient-to-b from-background to-muted/50 border-2 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center font-bold tracking-tight">
            {t("common.gameOver")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-3 bg-primary/5 rounded-xl border border-primary/10">
              <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("common.score")}
              </span>
              <span className="text-xl font-bold">{score}</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-primary/5 rounded-xl border border-primary/10">
              <Target className="w-6 h-6 text-blue-500 mb-2" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("common.accuracy")}
              </span>
              <span className="text-xl font-bold">
                {Math.round(accuracy * 100)}%
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-primary/5 rounded-xl border border-primary/10">
              <Zap className="w-6 h-6 text-purple-500 mb-2" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("common.xpEarned")}
              </span>
              <span className="text-xl font-bold text-primary">
                {xp} {t("common.xp")}
              </span>
            </div>
          </div>

          {missedWords.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" />
                {t("common.wordsToReview")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                {uniqueMissedWords.map((word: VocabularyItem, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <span className="font-bold text-sm">{word.term}</span>
                    <span className="text-xs text-muted-foreground">
                      {word.translation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            <Button
              onClick={onRestart}
              className="w-full h-14 text-lg font-bold"
              size="lg"
            >
              {t("common.tryAgain")}
            </Button>

            <Button
              variant="outline"
              onClick={onShowRanking}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <Trophy className="mr-2 h-4 w-4" />
              {t("common.viewLeaderboard")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
