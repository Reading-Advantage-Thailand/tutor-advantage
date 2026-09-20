"use client";

import React, { useState } from "react";
import { RuneMatchGame, type RuneMatchGameResult } from "@/components/games/vocabulary/rune-match/RuneMatchGame";

const TEST_VOCAB = [
  { id: "1", word: "forest", meaning: "ป่า", term: "forest", translation: "ป่า" },
  { id: "2", word: "ancient", meaning: "โบราณ", term: "ancient", translation: "โบราณ" },
  { id: "3", word: "journey", meaning: "การเดินทาง", term: "journey", translation: "การเดินทาง" },
  { id: "4", word: "crystal", meaning: "คริสตัล", term: "crystal", translation: "คริสตัล" },
  { id: "5", word: "dragon", meaning: "มังกร", term: "dragon", translation: "มังกร" },
  { id: "6", word: "shield", meaning: "โล่", term: "shield", translation: "โล่" },
];

export default function RuneMatchPreviewPage() {
  const [completedResult, setCompletedResult] = useState<RuneMatchGameResult | null>(null);
  const [mode, setMode] = useState<"normal" | "tutorial">("normal");
  const [restartOnComplete, setRestartOnComplete] = useState(false);

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 text-white p-4">
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-700 mb-4">
        <div>
          <h1 className="text-xl font-bold text-amber-400">Rune Match - Dev Preview & Verification</h1>
          <p className="text-xs text-slate-400">Manual verification test page for game completion and performance</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => {
              setCompletedResult(null);
              setMode(mode === "normal" ? "tutorial" : "normal");
            }}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700"
          >
            Mode: {mode.toUpperCase()}
          </button>
          <button
            onClick={() => setRestartOnComplete(!restartOnComplete)}
            className={`px-3 py-1.5 rounded border ${
              restartOnComplete ? "bg-amber-600 border-amber-400" : "bg-slate-800 border-slate-600"
            }`}
          >
            RestartOnComplete: {restartOnComplete ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      {completedResult && (
        <div className="w-full max-w-4xl mb-4 p-4 rounded-xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-between text-emerald-200">
          <div>
            <h2 className="font-bold text-lg text-emerald-400">🎉 Game Completed Successfully (onComplete Triggered)!</h2>
            <div className="flex gap-4 mt-1 text-sm">
              <span>Score: <b>{completedResult.score}</b></span>
              <span>XP: <b>{completedResult.xp}</b></span>
              <span>Accuracy: <b>{(completedResult.accuracy * 100).toFixed(0)}%</b></span>
              <span>Monster: <b>{completedResult.monsterType}</b></span>
            </div>
          </div>
          <button
            onClick={() => setCompletedResult(null)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
          >
            Play Again
          </button>
        </div>
      )}

      <main className="w-full max-w-4xl h-[650px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        <RuneMatchGame
          key={`${mode}-${restartOnComplete}`}
          vocabulary={TEST_VOCAB}
          tutorialMode={mode === "tutorial"}
          disableAutoFullscreen={true}
          restartOnComplete={restartOnComplete}
          onComplete={(result) => {
            console.log("RuneMatchGame onComplete called with:", result);
            setCompletedResult(result);
          }}
        />
      </main>
    </div>
  );
}
