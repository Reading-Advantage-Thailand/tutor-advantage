"use client";

import React from "react";
import { RotateCcw, ShieldAlert, Trophy } from "lucide-react";

/**
 * Where a teacher demo stops when its round ends, so the class never sees the
 * game jump to a new round by itself. The tutor replays when ready.
 */
export function TeachingEndCard({
  title,
  detail,
  lost = false,
  scale = 1,
  onReplay,
}: {
  title: string;
  detail?: string;
  /** The round was lost (the castle fell): no trophy. */
  lost?: boolean;
  scale?: number;
  onReplay: () => void;
}) {
  const Icon = lost ? ShieldAlert : Trophy;
  return (
    <div
      data-testid="teaching-end-card"
      className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-6 text-white backdrop-blur-sm"
    >
      <div style={{ zoom: scale }} className="w-full max-w-sm rounded-[28px] border border-white/15 bg-slate-950/95 p-8 text-center shadow-2xl">
        <div className={`mx-auto flex size-16 items-center justify-center rounded-full text-slate-950 shadow-lg ${lost ? "bg-rose-300 shadow-rose-300/20" : "bg-amber-300 shadow-amber-300/20"}`}>
          <Icon className="size-8" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-black tracking-tight">{title}</h2>
        {detail ? <p className="mt-2 text-lg font-bold text-white/75">{detail}</p> : null}
        <button
          type="button"
          onClick={onReplay}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-base font-black text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 active:scale-[0.98]"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          เล่นอีกครั้ง
        </button>
      </div>
    </div>
  );
}
