import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface ComboIndicatorProps {
  streak: number;
}

export function ComboIndicator({ streak }: ComboIndicatorProps) {
  if (streak < 2) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={streak}
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="absolute bottom-4 left-4 z-30 flex items-center gap-2"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-orange-500/50 rounded-full blur-xl animate-pulse" />
          <div className="relative flex items-center gap-1 bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-2 rounded-full border-2 border-orange-400 shadow-[0_0_15px_rgba(234,88,12,0.5)] transform -rotate-2">
            <Flame className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-[bounce_1s_infinite]" />
            <span className="font-black italic text-lg tracking-wider">
              COMBO
            </span>
            <span className="font-black text-2xl text-yellow-300 drop-shadow-md">
              x{streak}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
