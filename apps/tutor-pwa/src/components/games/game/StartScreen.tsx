import React, { useState } from "react";
import { VocabularyItem, Difficulty } from "@/store/useGameStore";
import {
  Wand2,
  BookOpen,
  Flame,
  Skull,
  Swords,
  Shield,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/locales/client";

interface StartScreenProps {
  vocabulary: VocabularyItem[];
  onStart: (difficulty: Difficulty) => void;
  onShowRanking: () => void;
}

export function StartScreen({
  vocabulary,
  onStart,
  onShowRanking,
}: StartScreenProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>("normal");

  const DIFFICULTIES: {
    id: Difficulty;
    label: string;
    color: string;
    icon: React.ElementType;
  }[] = [
    {
      id: "easy",
      label: t("magicDefense.difficulty.easy"),
      color: "text-emerald-400",
      icon: Shield,
    },
    {
      id: "normal",
      label: t("magicDefense.difficulty.normal"),
      color: "text-blue-400",
      icon: Swords,
    },
    {
      id: "hard",
      label: t("magicDefense.difficulty.hard"),
      color: "text-orange-400",
      icon: Flame,
    },
    {
      id: "extreme",
      label: t("magicDefense.difficulty.extreme"),
      color: "text-red-500",
      icon: Skull,
    },
  ];

  const handleStart = () => {
    setIsLoading(true);
    setTimeout(() => {
      onStart(selectedDifficulty);
    }, 500);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-slate-900/40 backdrop-blur-[2px]">
      <div className="relative z-20 flex h-full flex-col">
        {/* Header Section */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 flex-none">
          <div className="text-[10px] uppercase tracking-[0.3em] text-purple-300/60 mb-1 font-bold">
            Magic Defense
          </div>
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                {t("magicDefense.defenseBriefing")}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {t("magicDefense.reviewSpells")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onShowRanking}
                className="flex items-center gap-1.5 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 sm:px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-yellow-500 hover:bg-yellow-500/20 transition-colors"
              >
                <Trophy className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {t("magicDefense.leaderboard")}
                </span>
              </button>
              <div className="hidden sm:block rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
                {t("common.ready")}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 min-h-0 px-3 sm:px-6 pb-3 sm:pb-6 pt-1 sm:pt-2">
          <div className="grid gap-3 sm:gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] h-full">
            {/* Left Column: Briefing/Avatar Card — hidden on mobile */}
            <div className="hidden lg:flex relative flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-8 text-center backdrop-blur-md overflow-hidden group">
              {/* Background subtle glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] -z-10 group-hover:bg-purple-500/30 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent opacity-50" />

              <div className="relative z-10 p-4">
                {/* Decorative rings */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-purple-400/20 animate-[spin_10s_linear_infinite]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border border-purple-400/10 animate-[spin_15s_linear_infinite_reverse]" />

                {/* Theme Avatar */}
                <div className="relative z-20 h-28 w-28 rounded-full border-2 border-purple-400/30 bg-slate-900/80 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                  <div className="absolute inset-2 rounded-full border border-white/10" />
                  <Wand2 className="h-12 w-12 text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
                </div>
              </div>

              <div className="relative z-10 mt-2 max-w-[240px]">
                <h3 className="text-lg font-bold text-white mb-2">
                  {t("magicDefense.theSiegeBegins")}
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  {t("magicDefense.siegeDescription")}
                </p>
              </div>
            </div>

            {/* Right Column (full width on mobile): Vocabulary Preview & Difficulty */}
            <div className="flex flex-col gap-2 sm:gap-4 h-full min-h-0">
              {/* Difficulty Selector */}
              <div className="flex-none grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-slate-900/60 p-2 sm:p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                {DIFFICULTIES.map((diff) => {
                  const Icon = diff.icon;
                  const isSelected = selectedDifficulty === diff.id;
                  return (
                    <button
                      key={diff.id}
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-xl border transition-all duration-300",
                        isSelected
                          ? "bg-white/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-105"
                          : "bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10 opacity-70 hover:opacity-100",
                      )}
                    >
                      <Icon
                        className={cn("w-5 h-5 sm:w-6 sm:h-6", diff.color)}
                      />
                      <span
                        className={cn(
                          "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                          isSelected ? "text-white" : "text-slate-400",
                        )}
                      >
                        {diff.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Vocabulary List */}
              <div className="flex-1 flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-0 backdrop-blur-md overflow-hidden min-h-0">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">
                    <BookOpen className="h-3 w-3" />
                    {t("magicDefense.spellBook")}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                  {vocabulary.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
                      <BookOpen className="h-8 w-8 mb-3 opacity-20" />
                      {t("magicDefense.noVocabularyLoaded")}
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      {vocabulary.slice(0, 50).map((item, index) => (
                        <div
                          key={`${item.term}-${index}`}
                          className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                        >
                          <span className="font-bold text-slate-200 text-xs sm:text-sm group-hover:text-purple-300 transition-colors">
                            {item.term}
                          </span>
                          <span className="text-slate-400 text-xs sm:text-sm font-medium">
                            {item.translation}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Start Button */}
        <div className="flex-none border-t border-white/10 bg-slate-950/80 px-3 sm:px-6 py-3 sm:py-4 backdrop-blur-md">
          <div className="flex items-center justify-end gap-6">
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="relative group overflow-hidden pl-6 sm:pl-8 pr-8 sm:pr-10 py-2.5 sm:py-3 rounded-full bg-purple-600 text-white font-bold text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="flex items-center gap-2 relative z-10">
                {t("magicDefense.startDefense")}
                <Flame className="h-4 w-4 fill-current" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
