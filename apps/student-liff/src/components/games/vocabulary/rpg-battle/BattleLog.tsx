import React from "react";
import { BattleLogEntry } from "@/store/useRPGBattleStore";

interface BattleLogProps {
  entries: BattleLogEntry[];
}

export function BattleLog({ entries }: BattleLogProps) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">Battle Log</span>
        <span className="text-xs text-slate-400">Latest actions</span>
      </div>

      <div className="mt-3 max-h-40 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">No actions yet.</p>
        ) : (
          <ul className="space-y-2" role="log" aria-live="polite">
            {entries.map((entry, index) => {
              const tone =
                entry.type === "player"
                  ? "text-emerald-400"
                  : entry.type === "enemy"
                    ? "text-rose-400"
                    : "text-slate-300";

              return (
                <li
                  key={`${entry.type}-${index}`}
                  className={`text-sm ${tone}`}
                >
                  {entry.text}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
