"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Shield, Swords, Target, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { Button } from "@/components/ui/button";

export interface GameStat {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
}

export interface GameEndScreenProps {
  status: "victory" | "defeat" | "complete";
  score: number;
  xp: number;
  accuracy: number;
  onRestart: () => void;
  onExit?: () => void;
  customStats?: GameStat[];
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  restartButtonText?: React.ReactNode;
  showLeaderboardLink?: boolean;
  gameId?: string;
  gameName?: string;
}

const STATUS_STYLES: Record<
  GameEndScreenProps["status"],
  {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    containerBorder: string;
    iconShell: string;
    titleColor: string;
    xpShell: string;
  }
> = {
  victory: {
    title: "Victory!",
    subtitle: "Objectives reached.",
    icon: Trophy,
    containerBorder: "border-border",
    iconShell: "bg-foreground text-background",
    titleColor: "text-foreground",
    xpShell: "border-border bg-secondary text-foreground",
  },
  defeat: {
    title: "Failure",
    subtitle: "System offline.",
    icon: Swords,
    containerBorder: "border-destructive/30",
    iconShell: "bg-destructive text-white",
    titleColor: "text-destructive",
    xpShell: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  complete: {
    title: "Complete",
    subtitle: "Process finalized.",
    icon: Shield,
    containerBorder: "border-border",
    iconShell: "bg-foreground text-background",
    titleColor: "text-foreground",
    xpShell: "border-border bg-secondary text-foreground",
  },
};

export function GameEndScreen({
  status,
  score,
  xp,
  accuracy,
  onRestart,
  onExit,
  customStats,
  title,
  subtitle,
  restartButtonText = "Restart",
  showLeaderboardLink = false,
  gameId,
  gameName,
}: GameEndScreenProps) {
  const { recordSession } = useLeaderboard();
  const safeAccuracy = Number.isFinite(accuracy)
    ? Math.max(0, Math.min(accuracy, 1))
    : 0;
  const accuracyPercent = Math.round(safeAccuracy * 100);
  const statusStyle = STATUS_STYLES[status];
  const StatusIcon = statusStyle.icon;
  const extraStats = customStats?.slice(0, 2) ?? [];

  useEffect(() => {
    if (xp > 0 && gameId && gameName) {
      recordSession(gameId, gameName, score, xp, safeAccuracy);
    }
  }, [xp, gameId, gameName, score, safeAccuracy, recordSession]);

  const statCards: GameStat[] = [
    { label: "Score", value: score, icon: Trophy },
    { label: "Accuracy", value: `${accuracyPercent}%`, icon: Target },
    ...extraStats,
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className={`w-full max-w-lg rounded-xl border ${statusStyle.containerBorder} bg-card p-8 shadow-xl`}
      >
        <header className="text-center space-y-3">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${statusStyle.iconShell}`}
          >
            <StatusIcon className="h-8 w-8" />
          </div>
          <h2 className={`text-4xl font-bold tracking-tight ${statusStyle.titleColor}`}>
            {title ?? statusStyle.title}
          </h2>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            {subtitle ?? statusStyle.subtitle}
          </p>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {statCards.map((stat, index) => {
            const StatIcon = stat.icon;
            return (
              <div
                key={index}
                className="rounded-lg border border-border bg-secondary/30 p-4 text-center"
              >
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1 mb-1">
                  {StatIcon ? <StatIcon className="h-3 w-3" /> : null}
                  {stat.label}
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
              </div>
            );
          })}
          <div
            className={`sm:col-span-2 rounded-lg border p-4 text-center font-semibold ${statusStyle.xpShell}`}
          >
            XP Earned: {xp}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={onRestart}
            className="flex-1 h-12 rounded-lg"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> {restartButtonText}
          </Button>
          {onExit ? (
            <Button
              variant="outline"
              onClick={onExit}
              className="flex-1 h-12 rounded-lg"
            >
              Exit
            </Button>
          ) : null}
        </div>
        {showLeaderboardLink && gameId && gameName ? (
          <div className="mt-6 flex justify-center">
            <Link
              href="/student/leaderboard"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              View Leaderboard
            </Link>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
