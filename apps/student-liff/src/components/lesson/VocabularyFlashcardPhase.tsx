"use client";

import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Sparkles, ThumbsUp, Volume2, Zap } from "lucide-react";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { Chip, ProgressBar } from "@/components/mobile";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { lessonCardClass, PhaseColumn } from "./PhaseBlocks";

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

// Self-ratings are words + icons; "again" is neutral, never red for a child.
const rateButtons = [
  { value: "again", icon: RotateCcw, label: "interactivePlay.flashcardAgain", tone: "border-field-border bg-surface text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]" },
  { value: "good", icon: ThumbsUp, label: "interactivePlay.flashcardGood", tone: "border-info-border bg-info-bg text-info-fg shadow-[0_var(--ledge-sm)_0_var(--info-border)]" },
  { value: "easy", icon: Zap, label: "interactivePlay.flashcardEasy", tone: "border-success-border bg-success-bg text-success-fg shadow-[0_var(--ledge-sm)_0_var(--success-border)]" },
] as const;

export function VocabularyFlashcardPhase({ words = [], hasAnswered, disabled, onComplete }: Props) {
  const cards = useMemo(() => words.slice(0, 12), [words]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // What the last flip says to screen readers. Cleared whenever the card changes,
  // so it is silent on mount and the next flip is always a fresh announcement.
  const [flipAnnouncement, setFlipAnnouncement] = useState("");
  const [ratings, setRatings] = useState<Record<number, "again" | "good" | "easy">>({});
  const { isSpeaking, speak } = useTtsPlayer();

  const current = cards[index];
  const complete = hasAnswered || Object.keys(ratings).length >= cards.length;
  const remembered = Object.values(ratings).filter((rating) => rating !== "again").length;

  if (!current || complete) {
    return (
      <PhaseColumn>
        <section role="status" className="rounded-[var(--radius-card)] border-[1.5px] border-success-border bg-success-bg pt-4 pr-2 pb-[18px] pl-[18px]">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13px] leading-[1.5] font-semibold text-success-fg">
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
                {t("interactivePlay.flashcardDoneEyebrow")}
              </p>
              <h2 className="mt-1 font-heading text-[22px] leading-[1.35] font-bold text-balance text-success-fg">{t("interactivePlay.flashcardDoneTitle")}</h2>
              <p className="mt-1 text-[15px] leading-[1.6] text-fg">{t("interactivePlay.flashcardDoneDescription")}</p>
            </div>
            <ReedyMini mood="cheer" size="xl" decorative />
          </div>
          <dl className="mt-3 mr-2.5 grid grid-cols-3 gap-2">
            {[
              { value: cards.length, label: t("interactivePlay.flashcardCards") },
              { value: remembered, label: t("interactivePlay.flashcardRemembered") },
              { value: `+${Object.values(ratings).filter((rating) => rating === "easy").length * 2}`, label: t("interactivePlay.flashcardBonus") },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse rounded-lg bg-surface px-3 py-2.5 text-center">
                <dt className="text-[13px] leading-[1.5] text-fg-muted">{stat.label}</dt>
                <dd className="text-[22px] leading-[1.3] font-semibold text-fg tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
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
      setFlipAnnouncement("");
    } else {
      onComplete(`Flashcard complete: ${cards.length}/${cards.length}; confident: ${Object.values(nextRatings).filter((item) => item !== "again").length}`);
    }
  };

  const progress = (Object.keys(ratings).length / cards.length) * 100;
  const wordText = getWord(current, index);
  const speakCurrent = () => {
    speak(wordText, current.audioUrl || current.audio_url);
  };
  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    setFlipAnnouncement(
      next
        ? `${t("interactivePlay.flashcardMeaningSide")}: ${getMeaning(current)}`
        : `${t("interactivePlay.flashcardWordSide")}: ${wordText}`,
    );
  };

  return (
    <PhaseColumn>
      {/* Mission header. The phase row above already shows the Layers tile and "บัตรคำศัพท์". */}
      <section className={cn(lessonCardClass, "px-[18px] pt-4 pb-[18px]")}>
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 font-heading text-lg leading-[1.4] font-semibold text-fg">{t("interactivePlay.flashcardTitle")}</h2>
          <Chip tone="brand" size="md">
            {t("interactivePlay.flashcardScore")} <span className="font-sans tabular-nums">{remembered * 10}</span>
          </Chip>
        </div>
        <div className="mt-3.5 flex items-center justify-between text-[13px] leading-[1.5] text-fg-muted">
          <span>{t("interactivePlay.flashcardProgress")}</span>
          <span className="font-semibold text-fg tabular-nums">{Object.keys(ratings).length}/{cards.length}</span>
        </div>
        <ProgressBar value={progress} size="sm" className="mt-1.5" label={t("interactivePlay.flashcardProgress")} />
      </section>

      {/* Card (tap to flip) + listen */}
      {/* Mobile screen readers do not re-read a focused button whose text changed, so a flip is announced here. */}
      <p role="status" className="sr-only">
        {flipAnnouncement}
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={flip}
          // No aria-label and no aria-pressed: the visible side label, word or meaning
          // and tap hint are the name, and they already say which side is showing.
          className={cn(
            "clay-press flex min-h-[280px] w-full flex-col items-center justify-center rounded-[var(--radius-card)] border-[1.5px] px-6 py-8 text-center",
            flipped
              ? "border-brand-soft-border bg-brand-soft shadow-[0_var(--ledge)_0_var(--brand-soft-border)]"
              : "border-clay-rim bg-surface shadow-[var(--shadow-tap)]",
          )}
        >
          <span aria-hidden="true" className={cn("flex size-14 items-center justify-center rounded-[18px]", flipped ? "bg-surface text-brand-fg" : "bg-tile-purple text-icon-purple")}>
            {flipped ? <Sparkles className="size-7" /> : <BookOpen className="size-7" />}
          </span>
          <span className={cn("mt-3 text-[13px] leading-[1.5] font-semibold", flipped ? "text-brand-soft-fg" : "text-fg-muted")}>
            {flipped ? t("interactivePlay.flashcardMeaningSide") : t("interactivePlay.flashcardWordSide")}
          </span>
          <span
            lang={flipped ? undefined : "en"}
            className={cn("mt-2 font-semibold break-words text-fg", flipped ? "text-[28px] leading-[1.5]" : "text-[42px] leading-[1.25]")}
          >
            {flipped ? getMeaning(current) : wordText}
          </span>
          <span className="mt-5 text-[13px] leading-[1.6] text-fg-muted">
            {flipped ? t("interactivePlay.flashcardTapToWord") : t("interactivePlay.flashcardTapToMeaning")}
          </span>
        </button>
        <button
          type="button"
          onClick={speakCurrent}
          className="clay-press absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full border-[1.5px] border-clay-rim bg-surface text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]"
          aria-label={`${t("interactivePlay.flashcardListenAria")} ${wordText}`}
        >
          <Volume2 aria-hidden="true" className={cn("size-5", isSpeaking && "text-brand-fg")} />
        </button>
      </div>

      {/* Below 360px the three buttons do not fit one row: "เปิดเฉลย" takes its own row on top. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3">
        <Button variant="outline" size="touch" className="px-3 max-[359px]:flex-1" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); setFlipAnnouncement(""); }} disabled={index === 0}>
          <ChevronLeft aria-hidden="true" /> {t("interactivePlay.flashcardPrev")}
        </Button>
        <Button variant="brand" size="touch" className="px-3 max-[359px]:order-first max-[359px]:basis-full" onClick={flip}>
          <RotateCcw aria-hidden="true" /> {flipped ? t("interactivePlay.flashcardShowWord") : t("interactivePlay.flashcardShowMeaning")}
        </Button>
        <Button variant="outline" size="touch" className="px-3 max-[359px]:flex-1" onClick={() => { setIndex((value) => Math.min(cards.length - 1, value + 1)); setFlipped(false); setFlipAnnouncement(""); }} disabled={index === cards.length - 1}>
          {t("interactivePlay.flashcardNext")} <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <section className={cn(lessonCardClass, "px-[18px] pt-4 pb-[18px]")}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2">
          <h3 className="font-heading text-base leading-[1.45] font-semibold text-fg">{t("interactivePlay.flashcardRateTitle")}</h3>
          <p className="text-xs leading-[1.5] text-fg-muted">{t("interactivePlay.flashcardRateHint")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {rateButtons.map((button) => (
            <button
              key={button.value}
              type="button"
              onClick={() => rating(button.value)}
              disabled={!flipped || disabled}
              // Below 360px the icon sits above the word, so "ทบทวนอีก" never breaks inside the word.
              className={cn("clay-press inline-flex min-h-12 items-center justify-center gap-1 rounded-[var(--radius-field)] border-[1.5px] px-2 py-2 text-sm leading-[1.6] font-semibold disabled:opacity-45 disabled:shadow-none max-[359px]:flex-col max-[359px]:gap-0.5 max-[359px]:px-1", button.tone)}
            >
              <button.icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
              <span className="whitespace-nowrap">{t(button.label)}</span>
            </button>
          ))}
        </div>
      </section>
      <p className="text-center text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.flashcardFooterHint")}</p>
    </PhaseColumn>
  );
}
