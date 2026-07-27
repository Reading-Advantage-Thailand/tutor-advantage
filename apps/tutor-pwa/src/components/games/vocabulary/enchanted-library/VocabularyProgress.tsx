import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Book, Star } from "lucide-react";
import type { VocabularyItem } from "@/store/useGameStore";

interface VocabularyProgressProps {
  vocabulary: VocabularyItem[];
  progress: Map<string, number>;
  isOpen: boolean;
  onClose: () => void;
}

export function VocabularyProgress({
  vocabulary,
  progress,
  isOpen,
  onClose,
}: VocabularyProgressProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[90%] bg-gradient-to-b from-amber-100 to-amber-200 border-l-4 border-amber-300 shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b border-amber-300/50 flex items-center justify-between bg-white/30">
              <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                <Book className="w-6 h-6 text-amber-700" />
                My Grimoire
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-black/10 rounded-full transition-colors text-amber-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {vocabulary.map((item, i) => {
                const count = progress.get(item.term) || 0;
                return (
                  <div
                    key={i}
                    className="bg-white/60 p-3 rounded-xl border border-white flex items-center justify-between shadow-sm"
                    data-testid={`vocab-row-${item.term}`}
                  >
                    <div>
                      <div className="font-bold text-amber-900">
                        {item.term}
                      </div>
                      <div className="text-sm text-amber-700">
                        {item.translation}
                      </div>
                    </div>
                    <div className="flex gap-1 text-amber-400 drop-shadow-sm">
                      <Star
                        className={`w-5 h-5 ${count >= 1 ? "fill-yellow-400 text-yellow-500" : "text-slate-300"}`}
                        data-testid="star"
                        data-filled={count >= 1}
                      />
                      <Star
                        className={`w-5 h-5 ${count >= 2 ? "fill-yellow-400 text-yellow-500" : "text-slate-300"}`}
                        data-testid="star"
                        data-filled={count >= 2}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white/30 border-t border-amber-300/50 text-center text-xs text-amber-800 font-medium uppercase tracking-wider">
              Collect all words twice!
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
