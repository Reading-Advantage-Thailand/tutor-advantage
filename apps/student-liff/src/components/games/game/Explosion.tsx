"use client";

import React from "react";
import { motion } from "framer-motion";

interface ExplosionProps {
  x: number;
  y: number;
  onComplete: () => void;
}

export function Explosion({ x, y, onComplete }: ExplosionProps) {
  const particles = Array.from({ length: 8 });

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {particles.map((_, i) => (
        <motion.div
          key={i}
          data-testid="explosion-particle"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 100,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute w-2 h-2 bg-yellow-500 rounded-full"
          onAnimationComplete={i === 0 ? onComplete : undefined}
        />
      ))}
    </div>
  );
}
