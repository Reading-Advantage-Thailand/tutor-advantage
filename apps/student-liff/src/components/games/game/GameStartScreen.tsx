"use client";

import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Gamepad2, Play, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { VocabularyItem } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";

export interface Instruction {
  step: number;
  text: React.ReactNode;
  icon?: LucideIcon;
}

export interface ControlHint {
  label: React.ReactNode;
  keys: React.ReactNode;
  color: string;
}

export interface GameStartScreenProps {
  gameTitle: React.ReactNode;
  vocabulary: VocabularyItem[];
  onStart: () => void;
  gameSubtitle?: React.ReactNode;
  instructions?: Instruction[];
  proTip?: React.ReactNode;
  controls?: ControlHint[];
  startButtonText?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export function GameStartScreen({
  gameTitle,
  vocabulary,
  onStart,
  gameSubtitle,
  instructions,
  proTip,
  controls,
  startButtonText = "Start Game",
  icon: TitleIcon = Gamepad2,
  children,
}: GameStartScreenProps) {
  const hasInstructions = Boolean(instructions && instructions.length > 0);
  const hasControls = Boolean(controls && controls.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background"
    >
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary">
              <TitleIcon className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                {gameTitle}
              </h2>
            </div>
          </div>
          {gameSubtitle ? (
            <div className="px-3 py-1 rounded-md border border-border bg-secondary text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {gameSubtitle}
            </div>
          ) : null}
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-secondary/50 p-6 space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-lg text-foreground">
                <Sparkles className="w-5 h-5" /> How to Play
              </h3>
              {hasInstructions ? (
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {instructions?.map((instruction, index) => {
                    const stepLabel = String(
                      instruction.step ?? index + 1,
                    ).padStart(2, "0");
                    return (
                      <li key={index} className="flex gap-3">
                        <span className="text-foreground font-semibold">
                          {stepLabel}.
                        </span>
                        <span>{instruction.text}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Follow the on-screen prompts to complete the challenge.
                </p>
              )}
            </div>

            {proTip ? (
              <div className="flex items-center gap-4 rounded-xl border border-border p-4 text-sm text-muted-foreground bg-secondary/30">
                <Sparkles className="w-5 h-5 shrink-0 text-foreground" />
                <p>
                  <span className="font-semibold text-foreground">Pro Tip:</span> {proTip}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-lg text-foreground">
                <BookOpen className="w-5 h-5" /> Vocabulary
              </h3>
              <span className="text-xs text-muted-foreground">
                {vocabulary.length} Items
              </span>
            </div>
            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border bg-background scrollbar-thin scrollbar-thumb-border">
              {vocabulary.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic">
                  No items loaded...
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {vocabulary.map((item, i) => (
                    <div
                      key={`${item.term}-${i}`}
                      className="flex flex-col gap-1 p-3 px-4 hover:bg-secondary transition-colors"
                    >
                      <span className="font-medium text-foreground leading-snug">
                        {item.term}
                      </span>
                      <span className="text-muted-foreground text-sm leading-snug">
                        {item.translation}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="p-6 sm:p-8 border-t border-border bg-card flex flex-col gap-6">
        {hasControls ? (
          <div className="hidden sm:flex items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs flex-wrap">
            {controls?.map((control, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-foreground" />
                {control.label}: {control.keys}
              </div>
            ))}
          </div>
        ) : (
          !children && (
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Awaiting Command
            </span>
          )
        )}

        <div className="flex w-full items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">{children}</div>

          <Button
            onClick={onStart}
            size="lg"
            className="px-12 rounded-full"
          >
            <Play className="w-4 h-4 fill-current mr-2" />
            {startButtonText}
          </Button>
        </div>
      </footer>
    </motion.div>
  );
}
