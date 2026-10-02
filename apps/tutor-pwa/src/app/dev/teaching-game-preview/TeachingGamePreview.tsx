"use client";

import { TeachingGameStage } from "@/components/lesson/teachingGameRegistry";
import { FitToViewport } from "@/app/(dashboard)/lesson/[id]/interactive/presenter/FitToViewport";

const VOCABULARY = [
  { term: "forest", translation: "ป่า" },
  { term: "ancient", translation: "โบราณ" },
  { term: "journey", translation: "การเดินทาง" },
  { term: "crystal", translation: "คริสตัล" },
];

const SENTENCES = [
  { term: "The dragon flew over the forest", translation: "มังกรบินข้ามป่า" },
  { term: "We started a long journey", translation: "เราเริ่มการเดินทางที่ยาวไกล" },
];

/**
 * Mirrors the presenter shell (PhaseManager + GamePhaseStage) closely enough to
 * catch games that size themselves to the viewport instead of their stage.
 */
export function TeachingGamePreview({
  gameId,
  mode,
  fullscreen,
}: {
  gameId: string;
  mode: "teacher" | "tutorial";
  fullscreen: boolean;
}) {
  const stage = (
    <TeachingGameStage gameId={gameId} mode={mode} vocabulary={VOCABULARY} sentences={SENTENCES} fullscreen={fullscreen} />
  );

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex h-dvh w-screen flex-col overflow-hidden bg-app pb-28"
          : "relative flex min-h-dvh flex-1 flex-col bg-app"
      }
    >
      {!fullscreen ? (
        <div className="shrink-0 border-b border-hairline px-4 py-3 text-sm font-semibold text-fg lg:px-6">
          Presenter mock · {gameId} · {mode}
        </div>
      ) : null}
      <div
        data-testid="presenter-phase-content"
        className={
          fullscreen
            ? "flex h-full min-h-0 min-w-0 flex-1 flex-col px-6 pt-5"
            : "flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-4 pt-2 lg:px-6"
        }
      >
        <FitToViewport enabled={fullscreen}>
          <div className="flex min-h-0 flex-1 gap-4">
            <div className={fullscreen ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : "flex min-w-0 flex-1 flex-col gap-4"}>
              {!fullscreen ? <p className="text-xl font-semibold text-fg">Sentence game · teacher demo</p> : null}
              <div className={fullscreen ? "flex min-h-0 w-full flex-1 flex-col" : "w-full"} data-testid="presenter-game-stage">
                {stage}
              </div>
            </div>
            {!fullscreen ? (
              <div className="hidden w-[300px] shrink-0 rounded-xl border border-hairline bg-surface p-4 text-sm text-fg-muted lg:flex">
                Roster
              </div>
            ) : null}
          </div>
        </FitToViewport>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-[110] h-20 border-t border-hairline bg-surface/90 text-center text-xs leading-[5rem] text-fg-muted">
        Presenter dock
      </div>
    </div>
  );
}
