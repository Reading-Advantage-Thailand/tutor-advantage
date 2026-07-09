import { useEffect, useState } from "react";
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

/**
 * Phase 4 — Canonical difficulty keys. `medium` (not `normal`) is the
 * canonical value per Decision 4.3 §2 / B21-018 closure. The store-side
 * `Difficulty` type still includes `normal` (per-game Phase 5+ migration);
 * the dialog uses a local canonical tab list so the UI matches the server
 * contract (`leaderboardResponseSchema`) without rippling through
 * `useGameStore`.
 */
type TabDifficulty = "easy" | "medium" | "hard" | "extreme";

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
}

export function RankingDialog({ open, onOpenChange }: RankingDialogProps) {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRankings();
    }
  }, [open]);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/games/magic-defense/ranking");
      if (res.ok) {
        const json = await res.json();
        setData(json.rankings);
      }
    } catch (error) {
      console.error("Failed to fetch rankings", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-foreground" />;
    if (index === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (index === 2) return <Medal className="h-5 w-5 text-muted-foreground/60" />;
    return (
      <span className="text-xs font-bold text-muted-foreground/40">#{index + 1}</span>
    );
  };

  const difficulties: TabDifficulty[] = ["easy", "medium", "hard", "extreme"];

  const DifficultyTab = ({ diff }: { diff: TabDifficulty }) => {
    const rankings = data?.[diff] || [];

    if (loading) {
      return (
        <div className="flex flex-col gap-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-border bg-secondary/20 p-3"
            >
              <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
                <div className="h-3 w-16 bg-secondary/50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (rankings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Trophy className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">No rankings available.</p>
          <p className="text-xs">Be the first to set a score!</p>
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
                "flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50",
                index === 0 && "bg-secondary border-foreground/20"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center shrink-0">
                {getRankIcon(index)}
              </div>

              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="bg-secondary text-muted-foreground text-xs">
                  {user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {user.name}
                </div>
                <div className="text-xs text-muted-foreground">Candidate</div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-foreground">
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
      <DialogContent className="sm:max-w-md bg-background border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Trophy className="h-5 w-5" />
            Hall of Records
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="medium" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-secondary">
            {difficulties.map((diff) => (
              <TabsTrigger
                key={diff}
                value={diff}
                className="text-[10px] font-semibold uppercase tracking-wider"
              >
                {diff}
              </TabsTrigger>
            ))}
          </TabsList>

          {difficulties.map((diff) => (
            <TabsContent key={diff} value={diff} className="mt-4">
              <DifficultyTab diff={diff} />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
