"use client";

import React from "react";
import { motion } from "framer-motion";

interface SparkleBurstProps {
  x: number;
  y: number;
  onComplete: () => void;
}

export function SparkleBurst({ x, y, onComplete }: SparkleBurstProps) {
  const particles = Array.from({ length: 10 });

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      data-testid="sparkle-burst"
    >
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: (Math.random() - 0.5) * 120,
            y: (Math.random() - 0.5) * 120,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="sparkle-particle absolute h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
          onAnimationComplete={i === 0 ? onComplete : undefined}
          data-testid="sparkle-particle"
        />
      ))}
    </div>
  );
}
