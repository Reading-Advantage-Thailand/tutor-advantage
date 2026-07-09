import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/locales/client";
import type { Difficulty } from "./DragonFlightGame";

type RankingEntry = {
  userId: string;
  name: string;
  image: string | null;
  xp: number;
};

type RankingData = Record<string, RankingEntry[]>;

interface RankingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiEndpoint?: string;
  difficulties?: Difficulty[];
  title?: string;
  roleLabel?: string;
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  translationNamespace?: "dragonFlight" | "castleDefense" | string;
}

export function RankingDialog({
  open,
  onOpenChange,
  apiEndpoint = "/api/v1/games/dragon-flight/ranking",
  difficulties = ["easy", "normal", "hard", "extreme"],
  title,
  roleLabel,
  emptyStateMessage,
  emptyStateSubMessage,
  translationNamespace = "dragonFlight",
}: RankingDialogProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const json = await res.json();
        setData(json.rankings);
      }
    } catch (error) {
      console.error("Failed to fetch rankings", error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    if (open) {
      fetchRankings();
    }
  }, [open, fetchRankings]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (index === 1) return <Medal className="h-5 w-5 text-slate-300" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return (
      <span className="text-sm font-bold text-white/50">#{index + 1}</span>
    );
  };

  const difficultiesList = difficulties;

  const DifficultyTab = ({ diff }: { diff: Difficulty }) => {
    const rankings = data?.[diff] || [];

    if (loading) {
      return (
        <div className="flex flex-col gap-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg bg-white/5 p-3"
            >
              <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (rankings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
          <Trophy className="h-12 w-12 mb-2 opacity-20" />
          <p>
            {emptyStateMessage ||
              t(`${translationNamespace}.ranking.noChampions`)}
          </p>
          <p className="text-xs">
            {emptyStateSubMessage ||
              t(`${translationNamespace}.ranking.beTheFirst`)}
          </p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="flex flex-col gap-2">
          {rankings.map((user, index) => (
            <div
              key={user.userId}
              className={cn(
                "flex items-center gap-4 rounded-xl border p-3 transition-colors",
                index === 0
                  ? "border-yellow-500/30 bg-yellow-500/10"
                  : "border-white/5 bg-white/5 hover:bg-white/10",
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center shrink-0">
                {getRankIcon(index)}
              </div>

              <Avatar className="h-10 w-10 border border-white/10">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="bg-slate-800 text-white text-xs">
                  {user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  {user.name}
                </div>
                <div className="text-xs text-white/50">
                  {roleLabel ||
                    t(`${translationNamespace}.ranking.dragonRider`)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-emerald-400">
                  {user.xp.toLocaleString()} XP
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {title || t(`${translationNamespace}.ranking.leaderboard`)}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="normal" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white/5">
            {difficultiesList.map((diff) => (
              <TabsTrigger
                key={diff}
                value={diff}
                className="uppercase text-[10px] data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50"
              >
                {/* Fallback to generic labels if needed, but reusing dragonFlight keys for now is checking existing i18n structure */}
                {t(`${translationNamespace}.difficulty.${diff}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {difficultiesList.map((diff) => (
            <TabsContent key={diff} value={diff} className="mt-4">
              <DifficultyTab diff={diff} />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
