"use client";

import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";

type FlashcardWord = {
  vocabulary?: string;
  word?: string;
  text?: string;
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
const getMeaning = (word: FlashcardWord) => word.definition?.th || word.translation || word.definition?.en || "ยังไม่มีคำแปล";

export function VocabularyFlashcardPhase({ words = [], hasAnswered, disabled, onComplete }: Props) {
  const cards = useMemo(() => words.slice(0, 12), [words]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, "again" | "good" | "easy">>({});

  const current = cards[index];
  const complete = hasAnswered || Object.keys(ratings).length >= cards.length;

  if (!current || complete) {
    return (
      <div className="phase-enter flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 rounded-[32px] border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10 p-7 text-center shadow-xl">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-500"><CheckCircle2 size={42} /></div>
        <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Mission complete</p><h2 className="mt-2 text-2xl font-black text-foreground">เก่งมาก! ทบทวนครบแล้ว</h2><p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">รอคุณครูเปิดผลและไป Phase ถัดไป</p></div>
        <div className="grid w-full grid-cols-3 gap-2"><div className="rounded-2xl bg-muted p-3"><p className="text-xl font-black text-foreground">{cards.length}</p><p className="text-[10px] font-bold text-muted-foreground">การ์ด</p></div><div className="rounded-2xl bg-emerald-500/10 p-3"><p className="text-xl font-black text-emerald-500">{Object.values(ratings).filter((rating) => rating !== "again").length}</p><p className="text-[10px] font-bold text-muted-foreground">จำได้</p></div><div className="rounded-2xl bg-amber-500/10 p-3"><p className="text-xl font-black text-amber-500">+{Object.values(ratings).filter((rating) => rating === "easy").length * 2}</p><p className="text-[10px] font-bold text-muted-foreground">โบนัส</p></div></div>
      </div>
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

  return (
    <div className="phase-enter flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto pb-2">
      <div className="rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/65">Phase 3 · Flashcards</p><h1 className="mt-1 text-2xl font-black">Word Quest</h1></div><div className="rounded-2xl bg-black/20 px-3 py-2 text-right"><p className="text-[9px] font-black uppercase text-white/60">Score</p><p className="text-xl font-black">{Object.values(ratings).filter((item) => item !== "again").length * 10}</p></div></div>
        <div className="mt-5 flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-white/15"><Sparkles size={23} /></div><div className="flex-1"><div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/65"><span>Mission progress</span><span>{Object.keys(ratings).length}/{cards.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-amber-300 transition-all duration-500" style={{ width: `${progress}%` }} /></div></div></div>
      </div>

      <button type="button" onClick={() => setFlipped((value) => !value)} className="group min-h-[300px] rounded-[32px] border border-indigo-500/20 bg-card p-1 text-center shadow-2xl transition-transform active:scale-[0.99]" aria-label="พลิกการ์ดคำศัพท์">
        <div className="flex min-h-[292px] flex-col items-center justify-center rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 px-7 text-white">
          <div className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-white/10 text-indigo-200">{flipped ? <Sparkles size={30} /> : <BookOpen size={30} />}</div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">{flipped ? "Meaning" : "Vocabulary"}</p>
          <p className={`mt-4 font-black leading-tight ${flipped ? "text-3xl text-amber-200" : "text-5xl text-white"}`}>{flipped ? getMeaning(current) : getWord(current, index)}</p>
          <p className="mt-6 text-xs font-bold text-white/40">แตะการ์ดเพื่อ {flipped ? "กลับไปดูคำศัพท์" : "เปิดดูความหมาย"}</p>
        </div>
      </button>

      <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); }} disabled={index === 0} className="inline-flex h-11 items-center gap-1 rounded-2xl border border-border bg-card px-3 text-xs font-black text-foreground disabled:opacity-35"><ChevronLeft size={16} /> ก่อนหน้า</button><button type="button" onClick={() => setFlipped((value) => !value)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-xs font-black text-white shadow-lg"><RotateCcw size={15} /> {flipped ? "ดูคำศัพท์" : "เปิดเฉลย"}</button><button type="button" onClick={() => { setIndex((value) => Math.min(cards.length - 1, value + 1)); setFlipped(false); }} disabled={index === cards.length - 1} className="inline-flex h-11 items-center gap-1 rounded-2xl border border-border bg-card px-3 text-xs font-black text-foreground disabled:opacity-35">ถัดไป <ChevronRight size={16} /></button></div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-lg"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-black text-foreground">จำได้แค่ไหน?</p><p className="text-[10px] font-bold text-muted-foreground">ให้คะแนนหลังดูเฉลย</p></div><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => rating("again")} disabled={!flipped || disabled} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-2 py-3 text-[11px] font-black text-rose-600 disabled:opacity-35">🔁 ทบทวนอีก</button><button type="button" onClick={() => rating("good")} disabled={!flipped || disabled} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-2 py-3 text-[11px] font-black text-amber-600 disabled:opacity-35">👍 จำได้</button><button type="button" onClick={() => rating("easy")} disabled={!flipped || disabled} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-3 text-[11px] font-black text-emerald-600 disabled:opacity-35">⚡ ง่ายมาก</button></div></div>
      <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-emerald-500" /> ทำครบแล้วกดระดับความมั่นใจทุกใบ</div>
    </div>
  );
}
