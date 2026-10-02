"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FlashcardWord = {
  vocabulary?: string;
  word?: string;
  text?: string;
  audioUrl?: string;
  audio_url?: string;
  translation?: string;
  meaning?: string;
  definition?: { th?: string; en?: string };
};

type FlashcardTeachingGameProps = {
  words?: FlashcardWord[];
  participants: Array<{ studentId: string; name: string; pictureUrl?: string; score?: number }>;
  answered: number;
  onSpeak?: (text: string, audioUrl?: string) => void;
  preparationMode?: boolean;
};

const wordText = (word: FlashcardWord, index: number) => word.vocabulary || word.word || word.text || `Word ${index + 1}`;

const meaningText = (word: FlashcardWord) =>
  word.definition?.th || word.translation || word.meaning || word.definition?.en || t("lesson.live.flashcardNoTranslation");

/** Phase 2: the tutor flips vocabulary cards on the projector while students do the same on their phones. */
export function FlashcardTeachingGame({ words = [], participants, answered, onSpeak, preparationMode = false }: FlashcardTeachingGameProps) {
  const cards = useMemo(() => words.slice(0, 12), [words]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = cards[index];

  if (!current) {
    return (
      <div
        data-tour-target={preparationMode ? "phase-2-empty-state" : undefined}
        className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-hairline-strong bg-surface p-10 text-center"
      >
        <div data-tour-target={preparationMode ? "phase-2-student-status" : undefined}>
          <BookOpen aria-hidden="true" className="mx-auto mb-3 size-12 text-fg-subtle" />
          <h2 className="text-2xl font-semibold text-fg">{t("lesson.live.flashcardEmptyTitle")}</h2>
          <p className="mt-2 text-base text-fg-muted">{t("lesson.live.flashcardEmptyHelp")}</p>
        </div>
      </div>
    );
  }

  const progress = ((index + 1) / cards.length) * 100;
  const speakCurrent = () => {
    if (!onSpeak) return;
    onSpeak(wordText(current, index), current.audioUrl || current.audio_url);
  };
  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(cards.length - 1, next)));
    setFlipped(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <div className="mb-3 flex w-full max-w-3xl items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold text-fg">{t("lesson.live.flashcardTitle")}</h2>
          <p className="text-base text-fg-muted">
            {t("lesson.live.flashcardCard")}{" "}
            <span className="text-xl font-bold tabular-nums text-fg">
              {index + 1} / {cards.length}
            </span>
          </p>
        </div>

        <div className="relative w-full max-w-3xl">
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            data-tour-target="phase-2-flashcard-card"
            aria-label={t("lesson.live.flashcardFlip")}
            className={cn(
              "flex min-h-[min(46dvh,340px)] w-full flex-col items-center justify-center rounded-xl border-2 px-8 py-8 text-center shadow-card transition-colors",
              flipped ? "border-brand-soft-border bg-brand-soft" : "border-hairline bg-surface hover:border-hairline-strong",
            )}
          >
            <span className={cn("mb-4 inline-flex items-center gap-1.5 text-base font-medium", flipped ? "text-brand-fg" : "text-fg-muted")}>
              {flipped ? <Sparkles aria-hidden="true" className="size-5" /> : <BookOpen aria-hidden="true" className="size-5" />}
              {flipped ? t("lesson.live.flashcardMeaning") : t("lesson.live.flashcardWord")}
            </span>
            <span className={cn("font-bold leading-tight", flipped ? "text-4xl text-fg xl:text-5xl" : "text-5xl text-fg xl:text-7xl")}>
              {flipped ? meaningText(current) : wordText(current, index)}
            </span>
            <span className="mt-6 text-sm text-fg-subtle">
              {flipped ? t("lesson.live.flashcardTapToWord") : t("lesson.live.flashcardTapToMeaning")}
            </span>
          </button>
          {onSpeak ? (
            <button
              type="button"
              onClick={speakCurrent}
              data-tour-target={preparationMode ? "phase-2-flashcard-audio" : undefined}
              className="absolute right-4 top-4 inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-fg transition-colors hover:bg-brand-soft/70"
              aria-label={`${t("lesson.live.flashcardListen")} ${wordText(current, index)}`}
              title={t("lesson.live.flashcardListen")}
            >
              <Volume2 aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 w-full max-w-3xl">
          <div data-tour-target="phase-2-flashcard-progress" className="mb-1.5 flex justify-between text-sm text-fg-muted">
            <span>{t("lesson.live.flashcardProgress")}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-fill-muted">
            <div className="h-full rounded-full bg-brand-vivid transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-4 flex w-full max-w-3xl items-center justify-between gap-3">
          <Button variant="outline" size="lg" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft aria-hidden="true" /> {t("lesson.live.flashcardPrevious")}
          </Button>
          <Button variant="soft" size="lg" onClick={() => setFlipped((value) => !value)} data-tour-target="phase-2-flashcard-reveal">
            <RotateCcw aria-hidden="true" /> {flipped ? t("lesson.live.flashcardShowWord") : t("lesson.live.flashcardReveal")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => goTo(index + 1)}
            disabled={index === cards.length - 1}
            data-tour-target="phase-2-flashcard-next"
          >
            {t("lesson.live.flashcardNext")} <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-card lg:w-72">
        <div className="border-b border-hairline px-4 py-3">
          <p className="text-base font-semibold text-fg">{t("lesson.live.flashcardLiveTitle")}</p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-fg-muted">{t("lesson.live.flashcardLiveHelp")}</p>
        </div>
        <div data-tour-target={preparationMode ? "phase-2-student-status" : undefined} className="border-b border-hairline px-4 py-3 text-center">
          <p className="text-3xl font-bold tabular-nums text-fg">
            {answered}
            <span className="text-lg font-medium text-fg-muted">/{participants.length}</span>
          </p>
          <p className="text-sm text-fg-muted">{t("lesson.live.flashcardCompleted")}</p>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
          {participants.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-fg-muted">{t("lesson.live.rosterEmpty")}</li>
          ) : (
            participants.map((participant) => {
              // Participant scores are synchronized from the live lesson session.
              const done = answered > 0 && (participant.score || 0) > 0;
              return (
                <li key={participant.studentId} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      done ? "bg-success-bg text-success-fg" : "bg-fill-muted text-fg-subtle",
                    )}
                  >
                    {done ? <Check aria-hidden="true" className="size-4" /> : <Clock3 aria-hidden="true" className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-fg">{participant.name}</span>
                  <span className={cn("text-[0.8125rem]", done ? "font-medium text-success-fg" : "text-fg-subtle")}>
                    {done ? t("lesson.live.flashcardDone") : t("lesson.live.flashcardInProgress")}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </aside>
    </div>
  );
}
