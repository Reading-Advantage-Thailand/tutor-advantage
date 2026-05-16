"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';
import { playSound } from '@/lib/sounds';
import { t } from '@/lib/i18n';
import Image from 'next/image';

// ── Phase Config (Look at Screen) ────────────────────────────────────────────
const PHASE_CONFIG: Record<number, { emoji: string; label: string; color: string; bg: string; border: string; gradientFrom: string; gradientTo: string; tip: string }> = {
  1: { emoji: '📖', label: 'แนะนำบทเรียน', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', gradientFrom: 'from-indigo-500', gradientTo: 'to-violet-600', tip: 'คุณครูกำลังแนะนำบทเรียนวันนี้' },
  2: { emoji: '📝', label: 'คำศัพท์ใหม่', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', gradientFrom: 'from-violet-500', gradientTo: 'to-purple-600', tip: 'ดูคำศัพท์สำคัญบนจอของครู' },
  3: { emoji: '👀', label: 'อ่านบทความ', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', gradientFrom: 'from-sky-500', gradientTo: 'to-blue-600', tip: 'อ่านบทความพร้อมคุณครู' },
  4: { emoji: '🔍', label: 'โฟกัสคำศัพท์', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', gradientFrom: 'from-amber-400', gradientTo: 'to-orange-500', tip: 'สังเกตคำศัพท์ที่ไฮไลต์บนจอ' },
  5: { emoji: '🧠', label: 'อ่านเชิงลึก', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', gradientFrom: 'from-emerald-500', gradientTo: 'to-teal-600', tip: 'ฟังคุณครูอธิบายความหมาย' },
  6: { emoji: '⭐', label: 'ประโยคสำคัญ', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', gradientFrom: 'from-rose-500', gradientTo: 'to-pink-600', tip: 'จดจำประโยคสำคัญเหล่านี้' },
  9: { emoji: '🎵', label: 'ฟังการออกเสียง', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', gradientFrom: 'from-teal-500', gradientTo: 'to-cyan-600', tip: 'ฟังการออกเสียงที่ถูกต้อง' },
};

// ── Mobile Live Leaderboard ───────────────────────────────────────────────────
function MobileLeaderboard({ participants, studentId }: {
  participants: { studentId: string; name: string; pictureUrl?: string; score?: number }[];
  studentId: string;
}) {
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  const myRank = sorted.findIndex(p => p.studentId === studentId) + 1;
  if (sorted.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Leaderboard</span>
        </div>
        {myRank > 0 && (
          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
            คุณ #{myRank}
          </span>
        )}
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {sorted.map((p, i) => {
          const rank = i + 1;
          const isMe = p.studentId === studentId;
          const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
          return (
            <div key={p.studentId || i} className={[
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 border-2 transition-all duration-300',
              isMe ? 'border-indigo-300 bg-indigo-50' : rank === 1 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-white',
            ].join(' ')}>
              <div className="w-6 text-center shrink-0">
                {rankEmoji ? <span className="text-base leading-none">{rankEmoji}</span> : <span className="text-[10px] font-black text-slate-400">#{rank}</span>}
              </div>
              <div className="size-8 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-slate-100 flex items-center justify-center">
                {p.pictureUrl ? <img src={p.pictureUrl} alt={p.name} className="size-full object-cover" /> : <span className="text-[9px] font-black text-slate-500">{(p.name || '?').slice(0, 2)}</span>}
              </div>
              <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-indigo-700' : 'text-slate-700'}`}>{isMe ? 'คุณ' : p.name}</span>
              {isMe && <span className="text-[9px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full shrink-0">ME</span>}
              <div className="text-right shrink-0">
                <p className={`text-sm font-black tabular-nums ${isMe ? 'text-indigo-600' : rank <= 3 ? 'text-amber-600' : 'text-slate-700'}`}>{p.score || 0}</p>
                <p className="text-[9px] text-slate-400 leading-none">pts</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function PlayLessonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const { profile, isReady: liffReady } = useLiff();

  const studentId = profile?.userId || "anonymous";
  const name = profile?.displayName || "Student";

  const {
    sessionData,
    articleData,
    participants,
    error,
    hasAnswered,
    isEveryoneReady,
    aiFeedback,
    submitAnswer,
    kicked
  } = useLessonSocket(classId || undefined, studentId, name, profile?.pictureUrl);

  const [typedAnswer, setTypedAnswer] = useState('');
  const [showEveryoneReady, setShowEveryoneReady] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [prevPhase, setPrevPhase] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEveryoneReady) {
      const timer = setTimeout(() => setShowEveryoneReady(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowEveryoneReady(false);
    }
  }, [isEveryoneReady]);

  useEffect(() => {
    if (sessionData && prevPhase !== null && sessionData.currentPhase !== prevPhase) {
      playSound('phaseChange');
    }
    if (sessionData) setPrevPhase(sessionData.currentPhase);
    setIsSubmitting(false);
  }, [sessionData, prevPhase]);

  useEffect(() => { if (hasAnswered) setIsSubmitting(false); }, [hasAnswered]);

  useEffect(() => {
    if (sessionData && sessionData.currentPhase === 0 && classId) {
      router.push(`/lesson/${classId}`);
    }
  }, [sessionData, classId, router]);

  useEffect(() => {
    if (!hasAnswered && !isSubmitting) setSelectedChoice(null);
  }, [hasAnswered, isSubmitting]);

  // ─── Loading / Error States ────────────────────────────────────────────────

  if (!liffReady) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center max-w-[280px] w-full">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-2xl">📚</span>
          </div>
          <div className="flex gap-1.5 justify-center mt-2">
            {[0, 1, 2].map(i => <div key={i} className="size-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
          <p className="font-black text-slate-700 text-sm mt-3">{t("interactivePlay.openingLesson")}</p>
        </div>
      </div>
    );
  }

  if (kicked) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">😢</div>
        <h2 className="text-xl font-black text-slate-800 mb-2">{kicked}</h2>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">{t("interactivePlay.lessonEnded")}</p>
        <button onClick={() => router.push('/dashboard')} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all">
          {t("interactivePlay.backHome")}
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xl p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-black text-rose-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center max-w-[280px] w-full">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-2xl">📚</span>
          </div>
          <p className="font-black text-slate-800 text-sm">{t("interactivePlay.connectingLesson")}</p>
          <div className="flex gap-1.5 justify-center mt-3">
            {[0, 1, 2].map(i => <div key={i} className="size-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleMcqClick = (answer: string) => {
    playSound('select');
    setIsSubmitting(true);
    setSelectedChoice(answer);
    const currentPhase = sessionData?.currentPhase;
    let questionText = t("interactivePlay.defaultQuestion");
    let expected = "";
    if (currentPhase === 7) {
      const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
      const q = articleData?.multipleChoiceQuestions?.[idx];
      questionText = q?.question || questionText;
      expected = q?.answer || expected;
    } else if (currentPhase === 10) {
      const idx = sessionData?.phaseSelectedIndices?.[10] || 0;
      const w = articleData?.words?.[idx];
      questionText = `${t("interactivePlay.vocabMeaningPrefix")} "${w?.vocabulary || w?.word || w?.text}" ${t("interactivePlay.vocabMeaningSuffix")}`;
      expected = w?.definition?.th || w?.translation || "";
    } else if (currentPhase === 11) {
      const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
      const s = articleData?.sentences?.[idx];
      const targetStr = typeof s === 'object' ? s.sentences : s;
      const words = String(targetStr).split(' ');
      questionText = words.slice(0, words.length - 1).join(' ') + ' _____';
      expected = words[words.length - 1].replace(/[.,!?]/g, '');
    } else if (currentPhase === 12) {
      const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
      const s = articleData?.sentences?.[idx];
      const targetStr = typeof s === 'object' ? s.sentences : s;
      questionText = `${t("interactivePlay.orderSentencePrefix")} ${idx + 1}`;
      expected = String(targetStr);
    }
    submitAnswer(answer, questionText, expected);
  };

  const handleTextSubmit = () => {
    if (typedAnswer.trim()) {
      playSound('submit');
      setIsSubmitting(true);
      setSelectedChoice(typedAnswer);
      const currentPhase = sessionData?.currentPhase;
      const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
      const saqQuestion = articleData?.shortAnswerQuestions?.[idx];
      submitAnswer(typedAnswer, saqQuestion?.question, saqQuestion?.answer);
      setTypedAnswer('');
    }
  };

  const currentPhase = sessionData.currentPhase;
  const isLookAtScreenPhase = [1, 2, 3, 4, 5, 6, 9].includes(currentPhase);
  const articleId = (articleData as any)?.id as string | undefined;
  const articleTitle = (articleData as any)?.title as string | undefined;
  const articleImageUrl = articleId ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${articleId}` : null;

  // MCQ option configs (EduPop colors)
  const mcqOptions = [
    { label: 'A', bg: 'bg-rose-500', shadow: 'shadow-[0_6px_0_rgb(190,18,60)]', activeShadow: 'active:shadow-[0_0px_0_rgb(190,18,60)]' },
    { label: 'B', bg: 'bg-sky-500', shadow: 'shadow-[0_6px_0_rgb(3,105,161)]', activeShadow: 'active:shadow-[0_0px_0_rgb(3,105,161)]' },
    { label: 'C', bg: 'bg-amber-400', shadow: 'shadow-[0_6px_0_rgb(161,98,7)]', activeShadow: 'active:shadow-[0_0px_0_rgb(161,98,7)]' },
    { label: 'D', bg: 'bg-emerald-500', shadow: 'shadow-[0_6px_0_rgb(4,120,87)]', activeShadow: 'active:shadow-[0_0px_0_rgb(4,120,87)]' },
  ];

  const getScoreColor = (s: number) => s >= 4 ? 'text-emerald-600' : s >= 2 ? 'text-amber-600' : 'text-rose-600';
  const getScoreStroke = (s: number) => s >= 4 ? '#10b981' : s >= 2 ? '#f59e0b' : '#f43f5e';
  const getScoreStars = (s: number) => '⭐'.repeat(Math.max(0, Math.round(s)));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white text-xs font-black">✦</span>
          </div>
          <span className="font-black text-sm text-slate-800">{t("interactivePlay.title")}</span>
        </div>
        {currentPhase > 0 && (
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
            <div className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Phase {currentPhase}</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col p-4 items-center justify-center relative overflow-hidden">

        {/* ─── Phase 0: Waiting Room ─── */}
        {currentPhase === 0 && (
          <div className="phase-enter w-full max-w-sm flex flex-col gap-4">
            {/* Article hero / gradient banner */}
            {articleImageUrl ? (
              <div className="w-full h-40 rounded-3xl overflow-hidden shadow-xl relative">
                <img src={articleImageUrl} alt="article" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">บทเรียนวันนี้</p>
                  <p className="text-white font-black text-sm leading-snug mt-0.5">{articleTitle || ''}</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-40 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 flex flex-col items-center justify-center shadow-xl gap-2 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                <span className="text-5xl relative z-10">📚</span>
                <p className="text-white font-black text-base relative z-10">บทเรียนวันนี้</p>
              </div>
            )}

            {/* Profile card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-200 shrink-0 shadow-sm bg-indigo-50">
                <Image
                  src={profile?.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
                  alt={name}
                  width={56} height={56}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 truncate text-base">{name}</p>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full inline-block mt-1.5 border border-indigo-100">{t("interactivePlay.studentRole")}</span>
              </div>
            </div>

            {/* Waiting status + classmates */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-5 text-center">
              <div className="flex justify-center gap-1.5 mb-3">
                {[0, 1, 2].map(i => <div key={i} className="size-2.5 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: `${i * 0.25}s` }} />)}
              </div>
              <p className="font-bold text-slate-600 text-sm">{t("interactivePlay.waitingTeacher")}</p>

              {participants.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">เพื่อนในห้อง ({participants.length})</p>
                  <div className="flex justify-center flex-wrap gap-2">
                    {participants.slice(0, 9).map((p, i) => (
                      <div key={i} className="flex flex-col items-center gap-1" title={p.name}>
                        <div className="size-9 rounded-xl overflow-hidden border-2 border-white shadow-md bg-slate-100 flex items-center justify-center">
                          {p.pictureUrl ? <img src={p.pictureUrl} alt={p.name} className="size-full object-cover" /> : <span className="text-[9px] font-bold text-slate-500">{p.name.slice(0, 2)}</span>}
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 truncate max-w-[36px]">{p.name.split(' ')[0]}</span>
                      </div>
                    ))}
                    {participants.length > 9 && (
                      <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">+{participants.length - 9}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm bg-white active:scale-95 transition-all"
            >
              {t("interactivePlay.backToHome")}
            </button>
          </div>
        )}

        {/* ─── Phase 1–6, 9: Look at Screen ─── */}
        {isLookAtScreenPhase && (() => {
          const cfg = PHASE_CONFIG[currentPhase];
          if (!cfg) return null;
          return (
            <div className="phase-enter w-full max-w-sm flex flex-col gap-4">
              {/* Big phase card */}
              <div className={`${cfg.bg} border-2 ${cfg.border} rounded-3xl p-8 text-center shadow-xl`}>
                <div className="text-7xl mb-4" style={{ animation: 'bounce 2s infinite' }}>{cfg.emoji}</div>
                <div className={`inline-flex items-center gap-1.5 bg-white/60 border ${cfg.border} rounded-full px-3 py-1 mb-3`}>
                  <span className={`size-1.5 rounded-full animate-pulse ${cfg.color.replace('text-', 'bg-')}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>Phase {currentPhase}</span>
                </div>
                <h2 className={`text-2xl font-black ${cfg.color} mb-2`}>{cfg.label}</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{cfg.tip}</p>
              </div>

              {/* Look at screen instruction */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-4 flex items-center gap-3">
                <div className={`size-11 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center text-xl shrink-0`}>👆</div>
                <div>
                  <p className="font-black text-slate-800 text-sm">{t("interactivePlay.lookAtScreen")}</p>
                  <p className={`${cfg.color} text-xs font-bold mt-0.5`}>{cfg.label}</p>
                </div>
              </div>

              {/* Article title pill */}
              {articleTitle && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-center gap-2.5">
                  <span className="text-base shrink-0">📄</span>
                  <p className="text-xs font-semibold text-slate-500 truncate">{articleTitle}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── Phase 14: Final Leaderboard ─── */}
        {currentPhase === 14 && (() => {
          const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
          const studentIndex = sorted.findIndex(p => p.studentId === studentId);
          const rank = studentIndex !== -1 ? studentIndex + 1 : 0;
          const score = rank > 0 ? sorted[studentIndex]?.score || 0 : 0;
          const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎖️';
          const rankGrad = rank === 1 ? 'from-amber-400 to-yellow-500' : rank === 2 ? 'from-slate-400 to-slate-500' : rank === 3 ? 'from-orange-400 to-amber-500' : 'from-indigo-500 to-violet-600';
          let rankTitle = t("interactivePlay.greatJob");
          if (rank === 1) rankTitle = t("interactivePlay.rankFirst");
          else if (rank === 2) rankTitle = t("interactivePlay.rankSecond");
          else if (rank === 3) rankTitle = t("interactivePlay.rankThird");

          return (
            <div className="phase-enter w-full max-w-sm flex flex-col gap-4 overflow-y-auto max-h-[calc(100dvh-80px)] pb-4">
              {/* Rank hero */}
              <div className={`bg-gradient-to-br ${rankGrad} rounded-3xl p-7 text-center shadow-2xl text-white relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }} />
                <div className="relative z-10">
                  <div className="text-7xl mb-3 animate-bounce" style={{ animationDuration: '1.5s' }}>{rankEmoji}</div>
                  <h2 className="text-2xl font-black mb-1">{rankTitle}</h2>
                  <p className="text-white/80 text-sm font-medium">อันดับ {rank > 0 ? rank : '-'} จาก {participants.length} คน</p>
                </div>
              </div>

              {/* Score */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-6 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("interactivePlay.totalScore")}</p>
                <p className="text-6xl font-black text-indigo-600 mt-2">{score}</p>
                <p className="text-slate-400 font-medium text-sm">คะแนน</p>
              </div>

              {/* Final mini leaderboard */}
              {sorted.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ผลการแข่งขัน</p>
                  <div className="space-y-2">
                    {sorted.map((p, i) => {
                      const r = i + 1;
                      const isMe = p.studentId === studentId;
                      const rEmoji = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;
                      return (
                        <div key={p.studentId || i} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${isMe ? 'bg-indigo-50 border-2 border-indigo-200' : 'bg-slate-50 border border-slate-100'}`}>
                          <span className="w-6 text-center text-sm shrink-0">{rEmoji || `#${r}`}</span>
                          <div className="size-7 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-sm shrink-0 flex items-center justify-center">
                            {p.pictureUrl ? <img src={p.pictureUrl} alt={p.name} className="size-full object-cover" /> : <span className="text-[9px] font-bold text-slate-500">{(p.name || '?').slice(0, 2)}</span>}
                          </div>
                          <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-indigo-700' : 'text-slate-700'}`}>{isMe ? 'คุณ' : p.name}</span>
                          {isMe && <span className="text-[9px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full shrink-0">ME</span>}
                          <span className={`text-sm font-black tabular-nums ${isMe ? 'text-indigo-600' : 'text-slate-700'}`}>{p.score || 0}</span>
                          <span className="text-[9px] text-slate-400">pts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completed */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <h4 className="font-black text-emerald-700 text-sm mb-1">{t("interactivePlay.lessonCompletedTitle")}</h4>
                <p className="text-emerald-600 text-xs leading-relaxed">{t("interactivePlay.lessonCompletedDescription")}</p>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 active:scale-95 transition-all"
              >
                {t("interactivePlay.backHome")}
              </button>
            </div>
          );
        })()}

        {/* ─── MCQ Phases (7, 10, 11, 12) ─── */}
        {[7, 10, 11, 12].includes(currentPhase) && (
          <div className="phase-enter w-full max-w-md flex-1 flex flex-col gap-3 min-h-0">
            {hasAnswered ? (
              /* After answering: show result + leaderboard */
              <div className="flex flex-col items-stretch gap-3 w-full h-full overflow-y-auto pb-2">
                {selectedChoice && (
                  <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-md p-4 text-center shrink-0">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-6xl font-black text-indigo-700">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 text-center shrink-0">
                    <div className="text-3xl mb-2">🎉</div>
                    <h2 className="font-black text-emerald-700 text-lg">{t("interactivePlay.everyoneAnswered")}</h2>
                    <p className="text-emerald-600 text-sm mt-1">{t("interactivePlay.watchTeacherAnswer")}</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shrink-0 shadow-sm">
                    <div className="text-2xl mb-1">✅</div>
                    <h2 className="font-black text-slate-800 text-base">{t("interactivePlay.answerSubmitted")}</h2>
                    <p className="text-slate-500 text-sm mt-0.5">{t("interactivePlay.waitingFriends")}</p>
                  </div>
                )}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </div>
            ) : (
              /* Before answering: show question + MCQ buttons */
              <>
                {/* Question card */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden shrink-0">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5">
                    <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">❓ คำถาม</span>
                  </div>
                  <div className="px-4 py-4 text-center font-bold text-slate-800 text-sm leading-relaxed">
                    {(() => {
                      if (currentPhase === 7) {
                        const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
                        return articleData?.multipleChoiceQuestions?.[idx]?.question || t("interactivePlay.defaultQuestion");
                      } else if (currentPhase === 10) {
                        const idx = sessionData?.phaseSelectedIndices?.[10] || 0;
                        const w = articleData?.words?.[idx];
                        return `${t("interactivePlay.vocabMeaningPrefix")} "${w?.vocabulary || w?.word || w?.text}" ${t("interactivePlay.vocabMeaningSuffix")}`;
                      } else if (currentPhase === 11) {
                        const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
                        const s = articleData?.sentences?.[idx];
                        const targetStr = typeof s === 'object' ? s.sentences : s;
                        const words = String(targetStr).split(' ');
                        return `${t("interactivePlay.fillBlankPrefix")} ${words.slice(0, words.length - 1).join(' ')} _____`;
                      } else if (currentPhase === 12) {
                        const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
                        return `${t("interactivePlay.orderSentencePrefix")} ${idx + 1}`;
                      }
                      return t("interactivePlay.defaultQuestion");
                    })()}
                  </div>
                </div>

                {/* 2×2 MCQ grid */}
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {mcqOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleMcqClick(opt.label)}
                      className={`btn-3d ${opt.bg} ${opt.shadow} ${opt.activeShadow} active:translate-y-1.5 rounded-2xl flex flex-col items-center justify-center text-white font-black min-h-[100px] gap-1 transition-transform select-none`}
                    >
                      <span className="text-5xl">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Short Answer (8, 13) ─── */}
        {(currentPhase === 8 || currentPhase === 13) && (
          <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto py-2">

            {aiFeedback ? (
              /* AI Feedback result */
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-black uppercase tracking-wider">🤖 {t("interactivePlay.aiEvaluation")}</span>
                </div>
                <div className="p-5 flex flex-col items-center gap-4">
                  {/* Score ring */}
                  <div className="relative size-28">
                    <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={getScoreStroke(aiFeedback.score)}
                        strokeWidth="10" strokeLinecap="round"
                        strokeDasharray="264"
                        strokeDashoffset={264 - (264 * aiFeedback.score / 5)}
                        style={{ animation: 'score-ring-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-black ${getScoreColor(aiFeedback.score)}`}>{aiFeedback.score}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{t("interactivePlay.fullScore")}</span>
                    </div>
                  </div>
                  {/* Stars */}
                  <p className="text-xl">{getScoreStars(aiFeedback.score) || '—'}</p>
                  {/* Feedback card */}
                  <div className={`w-full rounded-2xl p-4 border-l-4 ${aiFeedback.score >= 4 ? 'bg-emerald-50 border-emerald-400' : aiFeedback.score >= 2 ? 'bg-amber-50 border-amber-400' : 'bg-rose-50 border-rose-400'}`}>
                    <p className="text-sm font-semibold text-slate-700 leading-relaxed">{aiFeedback.feedback}</p>
                  </div>
                  {/* Waiting */}
                  <p className="text-xs font-bold text-slate-400 flex items-center gap-2 animate-pulse">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute size-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative size-2 rounded-full bg-indigo-500" />
                    </span>
                    {t("interactivePlay.waitingNextPage")}
                  </p>
                </div>
              </div>

            ) : (hasAnswered || isSubmitting) ? (
              /* Submitted — waiting for AI */
              <>
                {selectedChoice && (
                  <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-md p-4 shrink-0">
                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-sm font-semibold text-slate-700 leading-relaxed break-words">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 text-center shrink-0">
                    <div className="text-2xl mb-2">🎉</div>
                    <h2 className="font-black text-emerald-700">{t("interactivePlay.submittedDone")}</h2>
                    <p className="text-emerald-600 text-xs mt-1">{t("interactivePlay.waitingAiScore")}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex size-2">
                        <span className="animate-ping absolute size-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative size-2 rounded-full bg-violet-500" />
                      </span>
                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">{t("interactivePlay.sendingAi")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-violet-50 border border-violet-100 overflow-hidden relative shrink-0">
                        <div className="absolute inset-0 skeleton opacity-40" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 rounded-full skeleton opacity-40" />
                        <div className="h-2.5 w-5/6 rounded-full skeleton opacity-40" />
                        <div className="h-2.5 w-2/3 rounded-full skeleton opacity-40" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-bold animate-pulse mt-3">{t("interactivePlay.aiChecking")}</p>
                  </div>
                )}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </>

            ) : (
              /* Input form */
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 flex items-center gap-2">
                  <span className="text-white text-sm">✏️</span>
                  <span className="text-white text-xs font-black uppercase tracking-wider">Short Answer</span>
                </div>
                <div className="p-5">
                  <p className="text-sm font-bold text-slate-800 leading-relaxed mb-4">
                    {(() => {
                      const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
                      return articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.textAnswerFallback");
                    })()}
                  </p>
                  <textarea
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    className="w-full border-2 border-slate-200 bg-slate-50 text-slate-800 rounded-2xl p-4 min-h-[120px] max-h-[35dvh] text-sm leading-relaxed focus:border-violet-400 focus:outline-none mb-3 resize-y transition-colors"
                    placeholder={t("interactivePlay.textAnswerPlaceholder")}
                  />
                  {/* Progress bars */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-400">{typedAnswer.length} {t("interactivePlay.characterUnit")}</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-1.5 w-6 rounded-full transition-all duration-300 ${typedAnswer.length > i * 40 ? 'bg-violet-400' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!typedAnswer.trim()}
                    className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-black text-base py-4 rounded-2xl shadow-lg shadow-violet-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {t("interactivePlay.submitAnswer")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default function PlayLessonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center max-w-[280px] w-full">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-2xl">📚</span>
          </div>
          <p className="text-slate-500 text-sm">{t("interactivePlay.preparingData")}</p>
        </div>
      </div>
    }>
      <PlayLessonContent />
    </Suspense>
  );
}
