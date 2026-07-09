import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FloatingTextItem {
  id: string;
  text: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  type: "damage-player" | "damage-enemy" | "heal" | "crit";
}

interface FloatingTextOverlayProps {
  items: FloatingTextItem[];
}

export function FloatingTextOverlay({ items }: FloatingTextOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1.2, y: -40 }}
            exit={{ opacity: 0, scale: 0.8, y: -80 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
            }}
            className={cn(
              "absolute font-black text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap select-none",
              item.type === "damage-player" && "text-red-500",
              item.type === "damage-enemy" && "text-white stroke-black",
              item.type === "heal" && "text-green-400",
              item.type === "crit" && "text-yellow-400 text-3xl",
            )}
          >
            {item.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
