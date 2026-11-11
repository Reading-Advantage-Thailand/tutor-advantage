"use client";

import React from "react";
import { motion } from "framer-motion";

type BookPickupVariant = "glow" | "close";

interface BookPickupBurstProps {
  x: number;
  y: number;
  spriteUrl: string;
  frameIndex: number;
  variant: BookPickupVariant;
  onComplete: () => void;
}

export function BookPickupBurst({
  x,
  y,
  spriteUrl,
  frameIndex,
  variant,
  onComplete,
}: BookPickupBurstProps) {
  // The sheet holds 3 frames in a row; percentages keep it right at any image size.
  const backgroundPosition = `${frameIndex * 50}% 0%`;
  const glow = variant === "glow";

  return (
    <div
      className="absolute pointer-events-none"
      // Centred on the book, not hanging from its corner.
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
      data-variant={variant}
      aria-hidden="true"
      data-testid="book-pickup-burst"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.4 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={
          glow
            ? "relative h-14 w-14 rounded-2xl bg-yellow-200/20 shadow-[0_0_25px_rgba(250,204,21,0.75)]"
            : "relative h-14 w-14 rounded-2xl bg-slate-800/30 shadow-[0_0_12px_rgba(15,23,42,0.35)]"
        }
        onAnimationComplete={onComplete}
      >
        <div
          className={
            glow
              ? "absolute inset-2 rounded-xl bg-yellow-100/20"
              : "absolute inset-2 rounded-xl bg-slate-950/40"
          }
        />
        <div
          className={
            glow
              ? "absolute inset-2 rounded-xl drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]"
              : "absolute inset-2 rounded-xl opacity-80"
          }
          style={{
            backgroundImage: `url(${spriteUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition,
            backgroundSize: "300% 100%",
          }}
          data-frame-index={frameIndex}
          data-testid="burst-sprite"
        />
      </motion.div>
    </div>
  );
}
