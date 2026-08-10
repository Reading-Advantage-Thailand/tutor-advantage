"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Trophy } from "lucide-react";

type FlashcardWord = {
  vocabulary?: string;
  word?: string;
  text?: string;
  translation?: string;
  meaning?: string;
  definition?: { th?: string; en?: string };
};

type FlashcardTeachingGameProps = {
  words?: FlashcardWord[];
  participants: Array<{ studentId: string; name: string; pictureUrl?: string; score?: number }>;
  answered: number;
};

const wordText = (word: FlashcardWord, index: number) =>
  word.vocabulary || word.word || word.text || `Word ${index + 1}`;

const meaningText = (word: FlashcardWord) =>
  word.definition?.th || word.translation || word.meaning || word.definition?.en || "ยังไม่มีคำแปล";

export function FlashcardTeachingGame({ words = [], participants, answered }: FlashcardTeachingGameProps) {
  const cards = useMemo(() => words.slice(0, 12), [words]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = cards[index];

  if (!current) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-3xl border border-amber-400/30 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-10 text-center text-white shadow-2xl">
        <div>
          <BookOpen className="mx-auto mb-4 size-14 text-amber-300" />
          <h2 className="text-2xl font-black">ยังไม่มีคำศัพท์สำหรับ Flashcard</h2>
          <p className="mt-2 text-white/60">เพิ่มคำศัพท์ในบทเรียนก่อนเริ่ม Phase นี้</p>
        </div>
      </div>
    );
  }

  const progress = ((index + 1) / cards.length) * 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-5 text-white shadow-2xl lg:flex-row lg:p-7">
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <div className="mb-5 flex w-full max-w-2xl items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Phase 3 · Vocabulary Flashcards</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">ภารกิจจำคำศัพท์</h2>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-right backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Card</p>
            <p className="text-xl font-black">{index + 1} / {cards.length}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          className="group relative min-h-[320px] w-full max-w-2xl overflow-hidden rounded-[32px] border border-amber-300/30 bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 p-1 text-left shadow-[0_22px_70px_rgba(245,158,11,0.25)] transition-transform hover:scale-[1.01]"
          aria-label="พลิกการ์ดคำศัพท์"
        >
          <div className="flex h-full min-h-[312px] flex-col items-center justify-center rounded-[28px] bg-slate-950/85 px-8 text-center backdrop-blur-xl">
            <div className="mb-6 flex size-16 items-center justify-center rounded-3xl bg-amber-300/15 text-amber-300 shadow-inner">
              {flipped ? <Sparkles size={30} /> : <BookOpen size={30} />}
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/45">
              {flipped ? "Meaning" : "Vocabulary"}
            </p>
            <p className={`mt-4 font-black leading-tight ${flipped ? "text-3xl text-amber-200 sm:text-4xl" : "text-5xl text-white sm:text-6xl"}`}>
              {flipped ? meaningText(current) : wordText(current, index)}
            </p>
            <p className="mt-7 text-xs font-bold text-white/45">คลิกเพื่อ {flipped ? "กลับไปดูคำศัพท์" : "เปิดดูความหมาย"}</p>
          </div>
        </button>

        <div className="mt-5 w-full max-w-2xl">
          <div className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/50">
            <span>Mission progress</span><span>{Math.round(progress)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-5 flex w-full max-w-2xl items-center justify-between gap-3">
          <button type="button" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); }} disabled={index === 0} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-black transition hover:bg-white/20 disabled:opacity-30">
            <ChevronLeft size={18} /> ก่อนหน้า
          </button>
          <button type="button" onClick={() => setFlipped((value) => !value)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-amber-300 px-6 text-sm font-black text-slate-950 shadow-lg transition hover:bg-amber-200">
            <RotateCcw size={17} /> {flipped ? "ดูคำศัพท์" : "เปิดเฉลย"}
          </button>
          <button type="button" onClick={() => { setIndex((value) => Math.min(cards.length - 1, value + 1)); setFlipped(false); }} disabled={index === cards.length - 1} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-black transition hover:bg-white/20 disabled:opacity-30">
            ถัดไป <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl lg:w-72">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Trophy className="size-5 text-amber-300" /><h3 className="font-black">Live mission</h3></div>
          <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">Live</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/55">นักเรียนเปิดการ์ดและกดระดับความมั่นใจบนมือถือ เมื่อทำครบจะขึ้นสถานะที่นี่</p>
        <div className="my-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-3xl font-black text-amber-200">{answered}<span className="text-base text-white/45">/{participants.length}</span></p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/45">students completed</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {participants.length === 0 ? <p className="py-8 text-center text-xs font-bold text-white/40">รอนักเรียนเข้าห้อง...</p> : participants.map((participant) => {
            const done = answered > 0 && (participant.score || 0) > 0;
            return <div key={participant.studentId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"><div className={`flex size-8 items-center justify-center rounded-xl text-sm ${done ? "bg-emerald-400/20" : "bg-white/10"}`}>{done ? "✓" : "…"}</div><span className="min-w-0 flex-1 truncate text-xs font-bold text-white/80">{participant.name}</span><span className={`text-[10px] font-black ${done ? "text-emerald-300" : "text-white/35"}`}>{done ? "DONE" : "PLAYING"}</span></div>;
          })}
        </div>
      </aside>
    </div>
  );
}
