import React from "react";

import { FloatingTextItem, FloatingTextOverlay } from "./FloatingText";
import { ComboIndicator } from "./ComboIndicator";

interface BattleSceneProps {
  player: React.ReactNode;
  enemy: React.ReactNode;
  playerHealth: React.ReactNode;
  enemyHealth: React.ReactNode;
  actionMenu: React.ReactNode;
  battleLog: React.ReactNode;
  backgroundImage?: string;
  turnIndicator?: React.ReactNode;
  floatingTexts?: FloatingTextItem[];
  streak?: number;
}

export function BattleScene({
  player,
  enemy,
  playerHealth,
  enemyHealth,
  actionMenu,
  battleLog,
  backgroundImage,
  turnIndicator,
  floatingTexts = [],
  streak = 0,
}: BattleSceneProps) {
  const stageStyle = backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  return (
    <section className="w-full p-4 md:p-6">
      <div
        data-testid="battle-stage"
        className="relative flex min-h-[280px] items-end justify-between gap-6 rounded-2xl bg-slate-800/60 backdrop-blur-sm p-4 md:p-6 shadow-2xl border border-slate-700/50 overflow-hidden"
        style={stageStyle}
      >
        <FloatingTextOverlay items={floatingTexts} />
        <ComboIndicator streak={streak} />

        <div className="flex flex-1 flex-col items-start gap-3">
          <div className="w-full">{playerHealth}</div>
          <div className="flex w-full items-end justify-start">{player}</div>
        </div>

        <div className="flex flex-1 flex-col items-end gap-3">
          <div className="w-full">{enemyHealth}</div>
          <div className="flex w-full items-end justify-end">{enemy}</div>
        </div>
      </div>

      <div
        data-testid="battle-ui"
        className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="min-h-[120px]">{actionMenu}</div>
        <div className="min-h-[120px] space-y-2">
          {turnIndicator}
          {battleLog}
        </div>
      </div>
    </section>
  );
}
