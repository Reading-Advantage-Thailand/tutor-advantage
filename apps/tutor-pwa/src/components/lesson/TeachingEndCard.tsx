"use client";

import React from "react";
import { RotateCcw, ShieldAlert, Trophy } from "lucide-react";

/**
 * Where a teacher demo stops when its round ends, so the class never sees the
 * game jump to a new round by itself. The tutor replays when ready.
 *
 * Sits over the game's own art: a flat --scrim (no blur, README §2.8) and a
 * presenter card (rim, radius 16, popover shadow) with a 64px tone tile
 * (won: amber trophy, lost: neutral shield, never red on the projector), the
 * title in Kodchasan and one primary "เล่นอีกครั้ง" (56px, ledge).
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
    <div data-testid="teaching-end-card" className="absolute inset-0 z-[80] flex items-center justify-center bg-scrim p-6">
      <div
        style={{ zoom: scale }}
        className="w-full max-w-sm rounded-(--radius-dialog) border border-clay-rim bg-surface-elevated p-8 text-center text-fg shadow-popover"
      >
        <div
          className={`mx-auto flex size-16 items-center justify-center rounded-2xl ${lost ? "bg-tile-neutral text-icon-neutral" : "bg-tile-amber text-icon-amber"}`}
        >
          <Icon className="size-8" aria-hidden="true" />
        </div>
        <h2 className="mt-5 font-heading text-[1.75rem] leading-[1.3] font-semibold text-balance-th">{title}</h2>
        {detail ? <p className="mt-2 text-lg font-medium text-fg-muted">{detail}</p> : null}
        <button
          type="button"
          onClick={onReplay}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-(--radius-ctl) bg-brand-solid px-5 text-base font-semibold text-on-brand shadow-[0_var(--ledge)_0_var(--brand-solid-edge)] transition-[background-color,transform,box-shadow] duration-(--duration-press) ease-(--ease-out) hover:bg-brand-solid-pressed active:translate-y-px active:shadow-[0_1px_0_var(--brand-solid-edge)]"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          เล่นอีกครั้ง
        </button>
      </div>
    </div>
  );
}
