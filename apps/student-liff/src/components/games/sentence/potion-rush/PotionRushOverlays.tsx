"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";

import { orderWords } from "@/lib/games/potionRushOrders";
import { SENTENCE_REPLAY_LABEL, useSentencePrompt } from "@/lib/games/useSentencePrompt";
import { usePotionRushStore } from "@/store/usePotionRushStore";

const HINT_MS = 1_600;
const ROUND_SECONDS = 60;
const WAITING_FOR_CUSTOMER = "รอลูกค้าคนถัดไป...";
const DRAG_HINT = "ลากคำลงหม้อ";

/** Only whole seconds reach React, so the clock does not re-render the game every frame. */
export function RoundTimer() {
  const seconds = usePotionRushStore((state) => Math.max(0, Math.ceil(ROUND_SECONDS - state.gameTime)));
  return <>{seconds}s</>;
}

/** Long sentences step down in size so they still fit under the score line. */
function promptFontSize(text: string): number {
  if (text.length <= 60) return 18;
  if (text.length <= 110) return 16;
  return 14;
}

function OrderWords({
  words,
  placed,
  showAll,
  fontSize,
}: {
  words: string[];
  placed: number;
  showAll: boolean;
  fontSize: number;
}) {
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 font-black leading-snug" style={{ fontSize }}>
      {words.map((word, index) => {
        if (index < placed) {
          return (
            <span key={index} className="text-emerald-700">
              {word}
            </span>
          );
        }
        const isNext = index === placed;
        if (showAll) {
          return (
            <span key={index} className={isNext ? "text-slate-950 underline decoration-amber-500 decoration-[3px] underline-offset-4" : "text-slate-900"}>
              {word}
            </span>
          );
        }
        return (
          <span key={index} className={isNext ? "text-amber-600" : "text-slate-400"} aria-hidden="true">
            ___
          </span>
        );
      })}
    </p>
  );
}

/**
 * The one order on screen: the customer the player is working for, the words
 * already in that pot, and what comes next. A served order stays up in full for
 * a moment, with its recording if there is one.
 */
export function OrderBanner({
  top,
  left,
  right,
  slotCentres,
  promptEnabled,
  fontScale = 1,
}: {
  top: number;
  left: number;
  right: number;
  /** Where each customer stands, in px from the banner's left edge. */
  slotCentres: [number, number, number];
  /** False in tutor demos: the text stays up and nothing plays on its own. */
  promptEnabled: boolean;
  fontScale?: number;
}) {
  const slot = usePotionRushStore((state) => state.focusedSlot);
  const request = usePotionRushStore((state) => state.customers[state.focusedSlot]?.request ?? null);
  const customerState = usePotionRushStore((state) => state.customers[state.focusedSlot]?.state ?? null);
  const placed = usePotionRushStore((state) => state.cauldrons[state.focusedSlot]?.currentWords.length ?? 0);

  const isActive = customerState === "WAITING" || customerState === "LEAVING_HAPPY";
  const isServed = customerState === "LEAVING_HAPPY";
  const promptItem = isActive ? request : null;
  const prompt = useSentencePrompt(promptItem, { enabled: promptEnabled });
  const words = useMemo(() => (promptItem ? orderWords(promptItem.term) : []), [promptItem]);

  // Hear the sentence once more when it has just been finished.
  const { replay } = prompt;
  useEffect(() => {
    if (isServed && promptEnabled) replay();
  }, [isServed, promptEnabled, replay]);

  const fontSize = promptFontSize(promptItem?.term ?? "") * fontScale;
  const showEnglishNow = prompt.kind === "peek" && !prompt.hidden;
  const canHearAgain = prompt.kind === "thai" && Boolean(promptItem?.audioUrl) && !isServed;

  return (
    <div className="pointer-events-none absolute z-20" style={{ top, left, right }} data-testid="potion-order-banner">
      <div className="relative rounded-2xl border-[3px] border-amber-400 bg-white/95 px-3 py-1.5 text-center text-slate-900 shadow-lg shadow-black/30">
        {!promptItem && <p className="py-1 text-sm font-bold text-slate-500">{WAITING_FOR_CUSTOMER}</p>}

        {promptItem && isServed && (
          <>
            <p className="font-black leading-snug text-emerald-700" style={{ fontSize }}>
              ✓ {promptItem.term}
            </p>
            {prompt.kind === "thai" && (
              <p className="font-bold leading-snug text-slate-600" style={{ fontSize: 14 * fontScale }}>
                {prompt.text}
              </p>
            )}
          </>
        )}

        {promptItem && !isServed && (
          <>
            {prompt.kind === "thai" && (
              <p className="font-black leading-snug text-slate-950" style={{ fontSize: promptFontSize(prompt.text) * fontScale }}>
                {prompt.text}
                {canHearAgain && (
                  <button
                    type="button"
                    onClick={replay}
                    aria-label="ฟังอีกครั้ง"
                    className="pointer-events-auto ml-1.5 inline-flex size-7 items-center justify-center rounded-full bg-amber-100 align-middle text-amber-700"
                  >
                    <Volume2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </p>
            )}
            {prompt.hidden && (
              <button
                type="button"
                onClick={replay}
                className="pointer-events-auto mb-0.5 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-black text-amber-950"
              >
                <Volume2 className="size-4" aria-hidden="true" />
                {SENTENCE_REPLAY_LABEL}
              </button>
            )}
            <OrderWords
              words={words}
              placed={placed}
              showAll={showEnglishNow}
              fontSize={prompt.kind === "thai" ? Math.min(fontSize, 16 * fontScale) : fontSize}
            />
          </>
        )}

        {promptItem && (
          <span
            aria-hidden="true"
            className="absolute top-full size-0 -translate-x-1/2 border-x-[9px] border-t-[11px] border-x-transparent border-t-amber-400"
            style={{ left: slotCentres[slot] }}
          />
        )}
      </div>
    </div>
  );
}

/** A short message above the hold slots: a missed drop, or coming back to the game. */
export function GameHint({ top }: { top: number }) {
  const hint = usePotionRushStore((state) => state.hint);
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);

  useEffect(() => {
    if (!hint) return;
    setVisibleSeq(hint.seq);
    const timer = setTimeout(() => setVisibleSeq(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);

  if (!hint || visibleSeq !== hint.seq) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center" style={{ top }} role="status">
      <span className="rounded-full bg-slate-950/90 px-4 py-1.5 text-sm font-black text-white shadow-lg">{hint.text}</span>
    </div>
  );
}

/** Before the first word goes in: a finger showing the drag from the belt to the pot. */
export function DragHint({
  from,
  potCentres,
}: {
  from: { x: number; y: number };
  /** Where each pot is, in px inside the game area. */
  potCentres: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
}) {
  const isActive = usePotionRushStore((state) => state.gameState === "PLAYING" && state.placedWords === 0);
  const slot = usePotionRushStore((state) => state.focusedSlot);
  if (!isActive) return null;

  const to = potCentres[slot];
  return (
    <motion.div
      key={slot}
      data-testid="potion-drag-hint"
      className="pointer-events-none absolute z-30 flex flex-col items-center"
      style={{ x: "-50%" }}
      initial={{ left: from.x, top: from.y, opacity: 0 }}
      animate={{
        left: [from.x, from.x, to.x, to.x],
        top: [from.y, from.y, to.y, to.y],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1], repeat: Infinity, repeatDelay: 0.5, delay: 0.8 }}
    >
      <span className="text-4xl drop-shadow-lg" aria-hidden="true">
        👆
      </span>
      <span className="mt-1 whitespace-nowrap rounded-full bg-slate-950/90 px-3 py-1 text-xs font-black text-white">{DRAG_HINT}</span>
    </motion.div>
  );
}
