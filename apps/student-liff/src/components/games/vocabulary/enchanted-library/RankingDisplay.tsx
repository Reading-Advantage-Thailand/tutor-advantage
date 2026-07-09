"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Award, User } from "lucide-react";
import { useState } from "react";
import type { Difficulty } from "@/lib/games/enchantedLibrary";

interface RankingEntry {
  userId: string;
  name: string;
  image: string | null;
  xp: number;
}

interface RankingDisplayProps {
  rankings: Record<Difficulty, RankingEntry[]>;
  currentUserId?: string;
  currentDifficulty?: Difficulty;
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  extreme: "Extreme",
};

export function RankingDisplay({
  rankings,
  currentUserId,
  currentDifficulty = "normal",
}: RankingDisplayProps) {
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>(currentDifficulty);

  const currentRankings = rankings[selectedDifficulty] || [];

  return (
    <div className="w-full max-w-3xl mx-auto bg-white/95 rounded-2xl shadow-2xl p-6">
      <div className="flex items-center justify-center gap-3 mb-6">
        <Trophy className="w-8 h-8 text-yellow-500" />
        <h2 className="text-2xl font-bold text-amber-900">Leaderboard</h2>
      </div>

      {/* Difficulty Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((difficulty) => (
          <button
            key={difficulty}
            onClick={() => setSelectedDifficulty(difficulty)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              selectedDifficulty === difficulty
                ? "bg-amber-500 text-white shadow-md"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </button>
        ))}
      </div>

      {/* Rankings List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {currentRankings.length === 0 ? (
          <div className="text-center py-8 text-amber-600">
            <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No rankings yet for this difficulty.</p>
            <p className="text-sm mt-1">Be the first to play!</p>
          </div>
        ) : (
          currentRankings.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId;
            const rank = index + 1;

            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                  isCurrentUser
                    ? "bg-gradient-to-r from-amber-200 to-yellow-200 border-2 border-amber-400 shadow-md"
                    : "bg-amber-50 hover:bg-amber-100"
                }`}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-12 text-center">
                  {rank <= 3 ? (
                    <div className="flex justify-center">
                      {rank === 1 && (
                        <Trophy className="w-6 h-6 text-yellow-500" />
                      )}
                      {rank === 2 && (
                        <Medal className="w-6 h-6 text-gray-400" />
                      )}
                      {rank === 3 && (
                        <Medal className="w-6 h-6 text-amber-600" />
                      )}
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-amber-700">
                      #{rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {entry.image ? (
                    <img
                      src={entry.image}
                      alt={entry.name}
                      className="w-10 h-10 rounded-full border-2 border-amber-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-300 flex items-center justify-center border-2 border-amber-400">
                      <User className="w-6 h-6 text-amber-700" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-semibold truncate ${isCurrentUser ? "text-amber-900" : "text-amber-800"}`}
                  >
                    {entry.name}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs">(You)</span>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div className="flex-shrink-0">
                  <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {entry.xp.toLocaleString()} XP
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
