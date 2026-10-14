"use client";

import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { Chip, ProgressBar } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PhaseColumn } from "./PhaseBlocks";

type FlashcardWord = {
  vocabulary?: string;
  word?: string;
  text?: string;
  audioUrl?: string;
  audio_url?: string;
  translation?: string;
  definition?: { th?: string; en?: string };
};

type Props = {
  words?: FlashcardWord[];
  hasAnswered: boolean;
  disabled?: boolean;
  onComplete: (summary: string) => void;
};

const getWord = (word: FlashcardWord, index: number) => word.vocabulary || word.word || word.text || `Word ${index + 1}`;
const getMeaning = (word: FlashcardWord) => word.definition?.th || word.translation || word.definition?.en || t("interactivePlay.flashcardNoMeaning");

const rateButtons = [
  { value: "again", emoji: "🔁", label: "interactivePlay.flashcardAgain", tone: "border-danger-border bg-danger-bg text-danger-fg" },
  { value: "good", emoji: "👍", label: "interactivePlay.flashcardGood", tone: "border-warning-border bg-warning-bg text-warning-fg" },
  { value: "easy", emoji: "⚡", label: "interactivePlay.flashcardEasy", tone: "border-success-border bg-success-bg text-success-fg" },
] as const;

export function VocabularyFlashcardPhase({ words = [], hasAnswered, disabled, onComplete }: Props) {
  const cards = useMemo(() => words.slice(0, 12), [words]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, "again" | "good" | "easy">>({});
  const { isSpeaking, speak } = useTtsPlayer();

  const current = cards[index];
  const complete = hasAnswered || Object.keys(ratings).length >= cards.length;
  const remembered = Object.values(ratings).filter((rating) => rating !== "again").length;

  if (!current || complete) {
    return (
      <PhaseColumn>
        <section role="status" className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-success-border bg-success-bg px-5 py-7 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface text-success-fg">
            <CheckCircle2 aria-hidden="true" className="size-9" />
          </span>
          <div>
            <p className="text-[13px] leading-[1.5] font-bold text-success-fg">{t("interactivePlay.flashcardDoneEyebrow")}</p>
            <h2 className="mt-1 text-[22px] leading-[1.4] font-extrabold text-fg">{t("interactivePlay.flashcardDoneTitle")}</h2>
            <p className="mt-1 text-[15px] leading-[1.6] text-fg-muted">{t("interactivePlay.flashcardDoneDescription")}</p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2">
            {[
              { value: cards.length, label: t("interactivePlay.flashcardCards") },
              { value: remembered, label: t("interactivePlay.flashcardRemembered") },
              { value: `+${Object.values(ratings).filter((rating) => rating === "easy").length * 2}`, label: t("interactivePlay.flashcardBonus") },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-surface p-3">
                <p className="text-xl leading-[1.4] font-extrabold text-fg tabular-nums">{stat.value}</p>
                <p className="text-xs leading-[1.5] text-fg-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      </PhaseColumn>
    );
  }

  const rating = (value: "again" | "good" | "easy") => {
    if (disabled) return;
    const nextRatings = { ...ratings, [index]: value };
    setRatings(nextRatings);
    if (index < cards.length - 1) {
      setIndex((currentIndex) => currentIndex + 1);
      setFlipped(false);
    } else {
      onComplete(`Flashcard complete: ${cards.length}/${cards.length}; confident: ${Object.values(nextRatings).filter((item) => item !== "again").length}`);
    }
  };

  const progress = (Object.keys(ratings).length / cards.length) * 100;
  const wordText = getWord(current, index);
  const speakCurrent = () => {
    speak(wordText, current.audioUrl || current.audio_url);
  };

  return (
    <PhaseColumn>
      {/* Mission header */}
      <section className="rounded-[var(--radius-card)] bg-tile-purple p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] leading-[1.5] font-bold text-icon-purple">{t("interactivePlay.flashcardEyebrow")}</p>
            <h2 className="text-xl leading-[1.4] font-extrabold text-fg">{t("interactivePlay.flashcardTitle")}</h2>
          </div>
          <Chip tone="neutral" size="md" className="bg-surface text-fg">
            {t("interactivePlay.flashcardScore")} {remembered * 10}
          </Chip>
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px] leading-[1.5] text-fg-muted">
          <span>{t("interactivePlay.flashcardProgress")}</span>
          <span className="tabular-nums">{Object.keys(ratings).length}/{cards.length}</span>
        </div>
        <ProgressBar value={progress} size="sm" className="mt-1.5" label={t("interactivePlay.flashcardProgress")} />
      </section>

      {/* Card (tap to flip) + listen */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={t("interactivePlay.flashcardFlipAria")}
          className={cn(
            "pressable flex min-h-[280px] w-full flex-col items-center justify-center rounded-[28px] border-2 px-6 py-8 text-center shadow-[var(--shadow-card)]",
            flipped ? "border-warning-border bg-warning-bg" : "border-hairline bg-surface",
          )}
        >
          <span aria-hidden="true" className={cn("flex size-14 items-center justify-center rounded-2xl", flipped ? "bg-surface text-warning-fg" : "bg-tile-purple text-icon-purple")}>
            {flipped ? <Sparkles className="size-7" /> : <BookOpen className="size-7" />}
          </span>
          <span className="mt-3 text-[13px] leading-[1.5] font-semibold text-fg-muted">
            {flipped ? t("interactivePlay.flashcardMeaningSide") : t("interactivePlay.flashcardWordSide")}
          </span>
          <span
            lang={flipped ? undefined : "en"}
            className={cn("mt-2 font-extrabold break-words text-fg", flipped ? "text-[28px] leading-[1.4]" : "text-[44px] leading-[1.2]")}
          >
            {flipped ? getMeaning(current) : wordText}
          </span>
          <span className="mt-5 text-[13px] leading-[1.5] text-fg-muted">
            {flipped ? t("interactivePlay.flashcardTapToWord") : t("interactivePlay.flashcardTapToMeaning")}
          </span>
        </button>
        <button
          type="button"
          onClick={speakCurrent}
          className="pressable absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full bg-fill-muted text-fg active:bg-press"
          aria-label={`${t("interactivePlay.flashcardListenAria")} ${wordText}`}
        >
          <Volume2 aria-hidden="true" className={cn("size-5", isSpeaking && "text-brand-fg")} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="touch" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); }} disabled={index === 0}>
          <ChevronLeft aria-hidden="true" /> {t("interactivePlay.flashcardPrev")}
        </Button>
        <Button variant="brand" size="touch" onClick={() => setFlipped((value) => !value)}>
          <RotateCcw aria-hidden="true" /> {flipped ? t("interactivePlay.flashcardShowWord") : t("interactivePlay.flashcardShowMeaning")}
        </Button>
        <Button variant="outline" size="touch" onClick={() => { setIndex((value) => Math.min(cards.length - 1, value + 1)); setFlipped(false); }} disabled={index === cards.length - 1}>
          {t("interactivePlay.flashcardNext")} <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <section className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] leading-[1.5] font-bold text-fg">{t("interactivePlay.flashcardRateTitle")}</h3>
          <p className="text-xs leading-[1.5] text-fg-muted">{t("interactivePlay.flashcardRateHint")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {rateButtons.map((button) => (
            <button
              key={button.value}
              type="button"
              onClick={() => rating(button.value)}
              disabled={!flipped || disabled}
              className={cn("pressable min-h-12 rounded-2xl border px-2 py-2 text-sm leading-[1.4] font-bold disabled:opacity-40", button.tone)}
            >
              <span aria-hidden="true">{button.emoji} </span>{t(button.label)}
            </button>
          ))}
        </div>
      </section>
      <p className="text-center text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.flashcardFooterHint")}</p>
    </PhaseColumn>
  );
}
