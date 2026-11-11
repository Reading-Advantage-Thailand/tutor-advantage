"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface SparkleBurstProps {
  x: number;
  y: number;
  onComplete: () => void;
}

const PARTICLE_COUNT = 10;
const SPREAD_PX = 120;
const DURATION_S = 0.6;
/** The burst goes even if the animation never reports its end. */
const REMOVE_AFTER_MS = 700;

const INITIAL = { x: 0, y: 0, opacity: 1, scale: 1 };
const TRANSITION = { duration: DURATION_S, ease: "easeOut" } as const;

export function SparkleBurst({ x, y, onComplete }: SparkleBurstProps) {
  // Picked once per burst. New targets on each render would restart the animation
  // on every game frame, and it would never end.
  const [targets] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: (Math.random() - 0.5) * SPREAD_PX,
      y: (Math.random() - 0.5) * SPREAD_PX,
      opacity: 0,
      scale: 0,
    })),
  );
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef.current(), REMOVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      data-testid="sparkle-burst"
    >
      {targets.map((target, i) => (
        <motion.div
          key={i}
          initial={INITIAL}
          animate={target}
          transition={TRANSITION}
          className="sparkle-particle absolute h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
          data-testid="sparkle-particle"
        />
      ))}
    </div>
  );
}
