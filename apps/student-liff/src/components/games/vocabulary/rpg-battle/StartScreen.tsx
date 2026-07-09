import React, { useState, useEffect } from "react";
import { VocabularyItem } from "@/store/useGameStore";
import {
  Swords,
  BookOpen,
  Trophy,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { battleEnemies } from "@/lib/games/rpgBattleSelection";
import { Sprite } from "./Sprite";
import { useScopedI18n } from "@/locales/client";

interface StartScreenProps {
  vocabulary: VocabularyItem[];
  onStart: () => void;
}

type TabType = "briefing" | "rankings" | "vocabulary";

interface RankingEntry {
  userId: string;
  name: string;
  image: string | null;
  xp: number;
}

interface RankingsData {
  [enemyId: string]: RankingEntry[];
}

export function StartScreen({ vocabulary, onStart }: StartScreenProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const [activeTab, setActiveTab] = useState<TabType>("briefing");
  const [selectedEnemy, setSelectedEnemy] = useState(battleEnemies[0].id);
  const [rankings, setRankings] = useState<RankingsData>({});
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLoadingRankings(true);
      try {
        const response = await fetch("/api/v1/games/rpg-battle/ranking");
        const data = await response.json();
        if (response.ok && data.rankings) {
          setRankings(data.rankings);
        }
      } catch (error) {
        console.error("Error fetching rankings:", error);
      } finally {
        setIsLoadingRankings(false);
      }
    };

    if (activeTab === "rankings") {
      fetchRankings();
    }
  }, [activeTab]);

  const tabs = [
    {
      id: "briefing" as TabType,
      label: t("rpgBattle.tabs.briefing"),
      icon: Swords,
    },
    {
      id: "rankings" as TabType,
      label: t("rpgBattle.tabs.rankings"),
      icon: Trophy,
    },
    {
      id: "vocabulary" as TabType,
      label: t("rpgBattle.tabs.vocabulary"),
      icon: BookOpen,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-lg overflow-hidden">
      <div className="relative z-20 flex h-full flex-col">
        {/* Header Section */}
        <div className="px-6 py-4 flex-none">
          <div className="text-xs uppercase tracking-[0.3em] text-purple-300/60 mb-1 font-bold">
            RPG Battle
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {t("rpgBattle.battlePreparation")}
              </h2>
              <p className="text-sm text-slate-300 mt-0.5">
                {t("rpgBattle.reviewSpells")}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
              {t("common.ready")}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex-none px-6 pb-4">
          <div className="flex gap-2 bg-slate-900/60 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300",
                    isActive
                      ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                      : "bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-300",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 min-h-0 px-6 pb-6">
          {/* Briefing Tab */}
          {activeTab === "briefing" && (
            <div className="h-full grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              {/* Left: Theme Card */}
              <div className="relative flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-8 text-center backdrop-blur-md overflow-hidden group">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] -z-10 group-hover:bg-purple-500/30 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent opacity-50" />

                <div className="relative z-10 p-4">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-purple-400/20 animate-[spin_10s_linear_infinite]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border border-purple-400/10 animate-[spin_15s_linear_infinite_reverse]" />

                  <div className="relative z-20 h-28 w-28 rounded-full border-2 border-purple-400/30 bg-slate-900/80 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                    <div className="absolute inset-2 rounded-full border border-white/10" />
                    <Swords className="h-12 w-12 text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
                  </div>
                </div>

                <div className="relative z-10 mt-2 max-w-[240px]">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {t("rpgBattle.theBattleAwaits")}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {t("rpgBattle.battleDescription")}
                  </p>
                </div>
              </div>

              {/* Right: Instructions */}
              <div className="flex flex-col gap-4 h-full min-h-0">
                <div className="flex-1 flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-md overflow-hidden">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold mb-4">
                    <Shield className="h-3 w-3" />
                    {t("common.howToPlay")}
                  </div>

                  <div className="space-y-4 text-sm text-slate-300">
                    <div className="flex gap-3">
                      <div className="flex-none w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">
                          {t("rpgBattle.instructions.step1Title")}
                        </p>
                        <p className="text-sm text-slate-400">
                          {t("rpgBattle.instructions.step1Desc")}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-none w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                        2
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">
                          {t("rpgBattle.instructions.step2Title")}
                        </p>
                        <p className="text-sm text-slate-400">
                          {t("rpgBattle.instructions.step2Desc")}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-none w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                        3
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">
                          {t("rpgBattle.instructions.step3Title")}
                        </p>
                        <p className="text-sm text-slate-400">
                          {t("rpgBattle.instructions.step3Desc")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <p className="text-sm text-purple-300">
                        <Sparkles className="inline h-3 w-3 mr-1" />
                        <strong>{t("common.tip")}:</strong>{" "}
                        {t("rpgBattle.instructions.tip")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rankings Tab */}
          {activeTab === "rankings" && (
            <div className="h-full flex flex-col gap-4">
              {/* Enemy Selector */}
              <div className="flex-none grid grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                {battleEnemies.map((enemy) => {
                  const isSelected = selectedEnemy === enemy.id;
                  return (
                    <button
                      key={enemy.id}
                      onClick={() => setSelectedEnemy(enemy.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300",
                        isSelected
                          ? "bg-white/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-105"
                          : "bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10 opacity-70 hover:opacity-100",
                      )}
                    >
                      <div className="relative w-12 h-12">
                        <Sprite
                          src={enemy.sprite}
                          pose="idle"
                          alt={enemy.label}
                          size={48}
                          className={cn(
                            "transition-transform duration-300",
                            isSelected && "animate-[bounce_2s_infinite]",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-bold uppercase tracking-wider",
                          isSelected ? "text-white" : "text-slate-400",
                        )}
                      >
                        {enemy.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Rankings List */}
              <div className="flex-1 flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-md overflow-hidden min-h-0">
                <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
                    <Trophy className="h-3 w-3" />
                    {t("rpgBattle.topWarriors")} -{" "}
                    {battleEnemies.find((e) => e.id === selectedEnemy)?.label}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                  {isLoadingRankings ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                      {t("rpgBattle.loadingRankings")}
                    </div>
                  ) : rankings[selectedEnemy]?.length > 0 ? (
                    <div className="space-y-2">
                      {rankings[selectedEnemy].map((entry, index) => (
                        <div
                          key={entry.userId}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                        >
                          <div
                            className={cn(
                              "flex-none w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                              index === 0
                                ? "bg-yellow-500/20 text-yellow-400"
                                : index === 1
                                  ? "bg-slate-400/20 text-slate-300"
                                  : index === 2
                                    ? "bg-orange-600/20 text-orange-400"
                                    : "bg-slate-700/50 text-slate-400",
                            )}
                          >
                            {index + 1}
                          </div>
                          {entry.image && (
                            <img
                              src={entry.image}
                              alt={entry.name}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <span className="flex-1 font-semibold text-slate-200 text-sm">
                            {entry.name}
                          </span>
                          <span className="text-purple-400 font-bold text-sm">
                            {entry.xp} {t("common.xp")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
                      <Trophy className="h-8 w-8 mb-3 opacity-20" />
                      {t("rpgBattle.noRankings")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vocabulary Tab */}
          {activeTab === "vocabulary" && (
            <div className="h-full flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-md overflow-hidden max-h-[300px]">
              <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex-none">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
                  <BookOpen className="h-3 w-3" />
                  {t("rpgBattle.spellBook")} ({vocabulary.length}{" "}
                  {t("rpgBattle.spells")})
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 min-h-0">
                {vocabulary.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
                    <BookOpen className="h-8 w-8 mb-3 opacity-20" />
                    {t("rpgBattle.noVocabulary")}
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {vocabulary.slice(0, 50).map((item, index) => (
                      <div
                        key={`${item.term}-${index}`}
                        className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                      >
                        <span className="font-bold text-slate-200 text-sm group-hover:text-purple-300 transition-colors">
                          {item.term}
                        </span>
                        <span className="text-slate-400 text-sm font-medium">
                          {item.translation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Start Button */}
        <div className="flex-none border-t border-white/10 bg-slate-950/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center justify-end gap-6">
            <button
              onClick={onStart}
              className="relative group overflow-hidden pl-8 pr-10 py-3 rounded-full bg-purple-600 text-white font-bold text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transition-all active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="flex items-center gap-2 relative z-10">
                {t("common.startBattle")}
                <Swords className="h-4 w-4" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
