"use client";

import { motion } from "framer-motion";
import { Zap, Shield, Flame, Skull } from "lucide-react";
import type { Difficulty } from "@/lib/games/enchantedLibrary";
import { useScopedI18n } from "@/locales/client";

interface DifficultySelectorProps {
  selected: Difficulty;
  onSelect: (difficulty: Difficulty) => void;
}

const DIFFICULTY_INFO: Record<
  Difficulty,
  {
    label: string;
    xpMultiplier: number;
    icon: typeof Zap;
    color: string;
    glowColor: string;
  }
> = {
  easy: {
    label: "Easy",
    xpMultiplier: 1.0,
    icon: Zap,
    color: "text-green-400",
    glowColor: "shadow-green-500/20",
  },
  normal: {
    label: "Normal",
    xpMultiplier: 1.5,
    icon: Shield,
    color: "text-blue-400",
    glowColor: "shadow-blue-500/20",
  },
  hard: {
    label: "Hard",
    xpMultiplier: 2.0,
    icon: Flame,
    color: "text-orange-400",
    glowColor: "shadow-orange-500/20",
  },
  extreme: {
    label: "Extreme",
    xpMultiplier: 3.0,
    icon: Skull,
    color: "text-red-400",
    glowColor: "shadow-red-500/20",
  },
};

export function DifficultySelector({
  selected,
  onSelect,
}: DifficultySelectorProps) {
  const t = useScopedI18n("pages.student.gamesPage.enchantedLibrary");

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap">
        {t("difficulty.label")}:
      </span>
      <div className="flex gap-1.5">
        {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((difficulty) => {
          const info = DIFFICULTY_INFO[difficulty];
          const Icon = info.icon;
          const isSelected = selected === difficulty;

          return (
            <motion.button
              key={difficulty}
              onClick={() => onSelect(difficulty)}
              className={`relative px-2.5 py-1.5 rounded-lg border transition-all ${
                isSelected
                  ? `border-white/30 bg-white/10 ${info.glowColor} shadow-lg`
                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={`${info.label} - ${info.xpMultiplier}x XP`}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  className={`w-3.5 h-3.5 ${isSelected ? info.color : "text-white/40"}`}
                />
                <span
                  className={`font-bold text-[11px] whitespace-nowrap ${isSelected ? "text-white" : "text-white/60"}`}
                >
                  {info.label}
                </span>
              </div>
              {isSelected && (
                <motion.div
                  className={`absolute inset-0 rounded-lg border ${info.color.replace("text-", "border-")}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
