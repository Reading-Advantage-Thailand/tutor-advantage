"use client";

import React from "react";
import { Trophy, Target, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HUDProps {
  score: number;
  accuracy: number;
  combo: number;
  mana: number;
  timeRemaining: number;
}

export function HUD({ score, accuracy, combo, mana, timeRemaining }: HUDProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return (
    <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-start justify-between z-20 pointer-events-none">
      {/* Left: Score & Combo */}
      <div className="flex flex-col gap-2">
        <div className="min-w-0 rounded-lg border border-border bg-background/60 px-3 sm:px-5 py-2 sm:py-3 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-1 sm:gap-2 mb-0.5">
            <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-foreground" />
            <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Score
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground leading-none">
            {score}
          </div>
        </div>

        {/* Combo Counter */}
        <AnimatePresence>
          {combo > 1 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              key={combo}
              className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/10 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur-md shadow-sm"
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-foreground animate-pulse" />
                <div className="text-sm sm:text-lg font-bold text-foreground tracking-tight">
                  {combo}x
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Center: Title/Mana/Timer */}
      <div className="flex flex-col items-center gap-2 mt-1 sm:mt-2">
        {/* Mana Bar */}
        <div className="w-24 sm:w-64 h-1.5 sm:h-2 bg-secondary border border-border overflow-hidden relative backdrop-blur-sm rounded-full">
          <motion.div
            className="h-full bg-foreground shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            animate={{ width: `${mana}%` }}
          />
        </div>

        {/* Timer Display */}
        <div
          className={`text-xl sm:text-2xl font-bold tracking-widest ${timeRemaining <= 10 ? "text-destructive animate-pulse" : "text-foreground"}`}
        >
          {formattedTime}
        </div>
        {mana >= 100 && (
          <motion.div
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="hidden sm:block text-[10px] font-bold text-foreground uppercase tracking-widest animate-pulse"
          >
            Ready (Space)
          </motion.div>
        )}
      </div>

      {/* Right: Accuracy */}
      <div className="min-w-0 rounded-lg border border-border bg-background/60 px-3 sm:px-5 py-2 sm:py-3 backdrop-blur-md shadow-sm text-right">
        <div className="flex items-center justify-end gap-1 sm:gap-2 mb-0.5">
          <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Accuracy
          </div>
          <Target className="h-3 w-3 sm:h-4 sm:w-4 text-foreground" />
        </div>
        <div className="text-xl sm:text-2xl font-bold text-foreground leading-none">
          {Math.round(accuracy * 100)}%
        </div>
      </div>
    </div>
  );
}
