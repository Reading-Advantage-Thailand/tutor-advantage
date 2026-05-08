"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';
import { playSound } from '@/lib/sounds';

export default function PlayLessonPage() {
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
  } = useLessonSocket(null, studentId, name, classId || undefined);

  const [typedAnswer, setTypedAnswer] = useState('');
  const [showEveryoneReady, setShowEveryoneReady] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [prevPhase, setPrevPhase] = useState<number | null>(null);

  useEffect(() => {
    if (isEveryoneReady) {
      const timer = setTimeout(() => setShowEveryoneReady(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowEveryoneReady(false);
    }
  }, [isEveryoneReady]);

  // Play sound on phase change
  useEffect(() => {
    if (sessionData && prevPhase !== null && sessionData.currentPhase !== prevPhase) {
      playSound('phaseChange');
    }
    if (sessionData) setPrevPhase(sessionData.currentPhase);
  }, [sessionData?.currentPhase]);

  useEffect(() => {
    if (sessionData && sessionData.currentPhase === 0 && classId) {
      router.push(`/lesson/${classId}`);
    }
  }, [sessionData?.currentPhase, classId, router]);

  useEffect(() => {
    if (!hasAnswered) setSelectedChoice(null);
  }, [hasAnswered]);

  // ─── Loading States ────────────────────────────────────────
  if (!liffReady) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-muted-foreground font-medium text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (kicked) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{kicked}</h2>
        <p className="text-muted-foreground mb-8">บทเรียนสิ้นสุดลงแล้ว</p>
        <button onClick={() => router.push('/dashboard')} className="w-full max-w-xs h-12 bg-primary text-primary-foreground rounded-xl font-bold transition-all active:scale-95 shadow-md">
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <span className="text-4xl mb-4 block">❌</span>
          <p className="text-destructive font-bold text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Connecting...</p>
        </div>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────
  const handleMcqClick = (answer: string) => {
    playSound('select');
    setSelectedChoice(answer);
    const currentPhase = sessionData?.currentPhase;
    let questionText = "เลือกคำตอบที่ถูกต้อง";
    let expected = "";

    if (currentPhase === 7) {
      const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
      const q = articleData?.multipleChoiceQuestions?.[idx];
      questionText = q?.question || questionText;
      expected = q?.answer || expected;
    } else if (currentPhase === 10) {
      const idx = sessionData?.phaseSelectedIndices?.[10] || 0;
      const w = articleData?.words?.[idx];
      questionText = `ความหมายของคำว่า "${w?.vocabulary || w?.word || w?.text}" คืออะไร?`;
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
      questionText = `เรียงประโยคให้ถูกต้องสำหรับประโยคที่ ${idx + 1}`;
      expected = String(targetStr);
    }

    submitAnswer(answer, questionText, expected);
  };

  const handleTextSubmit = () => {
    if (typedAnswer.trim()) {
      playSound('submit');
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

  const phaseNames: Record<number, string> = {
    1: 'Intro', 2: 'Vocab Preview', 3: 'First Reading', 4: 'Vocab Focus',
    5: 'Deep Reading', 6: 'Key Sentences', 9: 'Translation',
  };

  // MCQ button configs
  const mcqButtons = [
    { label: 'A', bg: 'bg-red-500', activeBg: 'active:bg-red-600', shadow: 'shadow-[0_6px_0_rgb(185,28,28)]', activeShadow: 'active:shadow-[0_0px_0_rgb(185,28,28)]' },
    { label: 'B', bg: 'bg-blue-500', activeBg: 'active:bg-blue-600', shadow: 'shadow-[0_6px_0_rgb(29,78,216)]', activeShadow: 'active:shadow-[0_0px_0_rgb(29,78,216)]' },
    { label: 'C', bg: 'bg-yellow-500', activeBg: 'active:bg-yellow-600', shadow: 'shadow-[0_6px_0_rgb(161,98,7)]', activeShadow: 'active:shadow-[0_0px_0_rgb(161,98,7)]' },
    { label: 'D', bg: 'bg-green-500', activeBg: 'active:bg-green-600', shadow: 'shadow-[0_6px_0_rgb(21,128,61)]', activeShadow: 'active:shadow-[0_0px_0_rgb(21,128,61)]' },
  ];

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Compact Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
          <span className="font-bold text-sm text-foreground">บทเรียน Interactive</span>
        </div>
        {currentPhase > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md uppercase tracking-wider">
            Phase {currentPhase}
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col p-4 items-center justify-center relative">
        
        {/* Phase 0 — Waiting Room */}
        {currentPhase === 0 && (
          <div className="phase-enter text-center flex flex-col items-center justify-center absolute inset-0 bg-gradient-to-br from-background via-muted to-background overflow-hidden p-6 z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent animate-pulse" style={{ animationDuration: '4s' }} />
            
            <div className="relative z-10 flex flex-col items-center max-w-sm w-full bg-card/80 backdrop-blur-xl p-8 rounded-3xl border border-border shadow-2xl">
              <div className="w-24 h-24 rounded-full border-4 border-primary/20 p-1 mb-4 shadow-sm bg-background overflow-hidden">
                <img src={profile?.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} alt={name} className="w-full h-full rounded-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-foreground">{name}</h2>
              <p className="text-sm text-primary font-bold mt-1 mb-6 bg-primary/10 px-3 py-1 rounded-full">นักเรียน</p>
              
              <div className="text-6xl mb-4 float-emoji drop-shadow-lg">🎮</div>
              <p className="text-base text-muted-foreground font-medium flex items-center gap-2">
                รอคุณครูเริ่มบทเรียน
                <span className="loading-dots flex"><span className="bg-muted-foreground"/><span className="bg-muted-foreground"/><span className="bg-muted-foreground"/></span>
              </p>

              <button
                onClick={() => router.push('/dashboard')}
                className="mt-8 bg-card hover:bg-muted text-foreground font-bold py-3 px-6 rounded-xl w-full transition-all active:scale-95 flex items-center justify-center gap-2 text-sm border border-border shadow-sm"
              >
                🏠 กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        )}

        {/* Look at Screen Phases */}
        {isLookAtScreenPhase && (
          <div className="phase-enter absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted overflow-hidden z-0">
            {/* Subtle particle background effect */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at center, currentColor 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
            
            <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
              <div className="text-8xl mb-8 float-emoji drop-shadow-2xl">👀</div>
              <h2 className="text-3xl font-black text-foreground tracking-tight mb-3">โปรดดูที่หน้าจอ</h2>
              <p className="text-muted-foreground font-medium text-lg mb-8">Please look at the screen</p>
              
              <div className="bg-card border border-border shadow-lg p-5 rounded-3xl w-full flex flex-col items-center">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">สถานะปัจจุบัน</p>
                <div className="flex items-center gap-3 w-full bg-primary/10 p-3 rounded-2xl border border-primary/20">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl shrink-0">📖</div>
                  <div className="text-left">
                    <p className="text-xs text-primary font-bold">คุณครูกำลังสอน</p>
                    <p className="text-sm font-black text-foreground">{phaseNames[currentPhase] || `Phase ${currentPhase}`}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 14 — Personal Leaderboard */}
        {currentPhase === 14 && (
          <div className="phase-enter w-full max-w-md bg-card rounded-3xl p-6 shadow-xl border border-border flex flex-col items-center min-h-[450px] text-center relative overflow-hidden">
            <div className="absolute top-[-40px] right-[-40px] w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-[-40px] left-[-40px] w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
            
            {(() => {
              const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
              const studentIndex = sorted.findIndex(p => p.studentId === studentId);
              const rank = studentIndex !== -1 ? studentIndex + 1 : 1;
              const score = sorted[studentIndex]?.score || 0;

              let title = "ทำได้ดีมาก! (Great Job!)";
              let emoji = "🎖️";

              if (rank === 1) { title = "ชนะเลิศอันดับ 1!"; emoji = "🏆"; }
              else if (rank === 2) { title = "รองชนะเลิศอันดับ 1"; emoji = "🥈"; }
              else if (rank === 3) { title = "รองชนะเลิศอันดับ 2"; emoji = "🥉"; }

              return (
                <div className="flex flex-col items-center gap-4 w-full relative z-10">
                  <div className="text-7xl mb-2 animate-bounce">{emoji}</div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight leading-snug px-2">{title}</h2>
                  
                  <div className="text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-muted text-muted-foreground flex items-center gap-1.5">
                    🏅 อันดับที่ {rank} จากนักเรียนทั้งหมด {participants.length} คน
                  </div>

                  <div className="bg-muted border-2 border-border rounded-2xl p-5 w-full mt-4 flex flex-col items-center gap-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">คะแนนรวมของคุณ</p>
                    <p className="text-5xl font-black text-primary tracking-tight mt-1">
                      {score} <span className="text-xl font-medium text-muted-foreground">pts</span>
                    </p>
                  </div>

                  <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 w-full flex items-start gap-3 text-left">
                    <span className="text-xl">🌟</span>
                    <div>
                      <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">บทเรียนเสร็จสิ้นแล้ว!</h4>
                      <p className="text-emerald-600 dark:text-emerald-500 text-xs mt-0.5 leading-relaxed">
                        คุณได้มีส่วนร่วมและตอบคำถามครบทุก Phase อย่างยอดเยี่ยม
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* MCQ Phases (7, 10, 11, 12) */}
        {[7, 10, 11, 12].includes(currentPhase) && (
          <div className="phase-enter w-full max-w-md flex-1 flex flex-col">
            {hasAnswered ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                {selectedChoice && (
                  <div className="bg-card px-6 py-3 rounded-xl border-2 border-border shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">คำตอบของคุณ</p>
                    <p className="text-4xl font-black text-foreground">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <>
                    <div className="text-6xl">✅</div>
                    <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">ตอบครบทุกคนแล้ว!</h2>
                    <p className="text-muted-foreground">โปรดดูเฉลยที่หน้าจอคุณครู</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl animate-bounce">⏳</div>
                    <h2 className="text-2xl font-bold text-foreground">ส่งคำตอบแล้ว!</h2>
                    <p className="text-muted-foreground">รอเพื่อนตอบให้ครบ...</p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col w-full gap-4">
                {/* Question */}
                <div className="bg-card p-4 rounded-xl shadow-sm border border-border text-center font-bold text-foreground text-sm leading-relaxed">
                  {(() => {
                    if (currentPhase === 7) {
                      const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
                      return articleData?.multipleChoiceQuestions?.[idx]?.question || "เลือกคำตอบที่ถูกต้อง";
                    } else if (currentPhase === 10) {
                      const idx = sessionData?.phaseSelectedIndices?.[10] || 0;
                      const w = articleData?.words?.[idx];
                      return `ความหมายของคำว่า "${w?.vocabulary || w?.word || w?.text}" คืออะไร?`;
                    } else if (currentPhase === 11) {
                      const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
                      const s = articleData?.sentences?.[idx];
                      const targetStr = typeof s === 'object' ? s.sentences : s;
                      const words = String(targetStr).split(' ');
                      return `เติมคำในช่องว่าง: ${words.slice(0, words.length - 1).join(' ')} _____`;
                    } else if (currentPhase === 12) {
                      const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
                      return `เรียงประโยคให้ถูกต้องสำหรับประโยคที่ ${idx + 1}`;
                    }
                    return "เลือกคำตอบที่ถูกต้อง";
                  })()}
                </div>
                {/* MCQ 2×2 Grid — Full Screen */}
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {mcqButtons.map((btn) => (
                    <button 
                      key={btn.label}
                      onClick={() => handleMcqClick(btn.label)} 
                      className={`btn-3d ${btn.bg} ${btn.activeBg} rounded-2xl ${btn.shadow} ${btn.activeShadow} active:translate-y-1 flex items-center justify-center text-white text-4xl font-black min-h-[100px]`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Short Answer Phases (8, 13) */}
        {(currentPhase === 8 || currentPhase === 13) && (
          <div className="phase-enter w-full max-w-md flex-1 flex flex-col justify-center">
            {aiFeedback ? (
              <div className="bg-card rounded-3xl p-8 shadow-2xl border border-border text-center">
                <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full inline-block font-bold text-xs mb-6 uppercase tracking-wider">
                  ผลประเมินจาก AI
                </div>
                {/* Score Ring */}
                <div className="relative w-32 h-32 mx-auto mb-6">
                  <svg className="w-full h-full -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-muted" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-primary" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray="283" strokeDashoffset={283 - (283 * (aiFeedback.score || 0) / 5)}
                      style={{ animation: 'score-ring-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-4xl font-black text-foreground">{aiFeedback.score}</span>
                    <span className="text-xs font-bold text-muted-foreground mt-0.5">เต็ม 5</span>
                  </div>
                </div>
                <div className="bg-muted p-5 rounded-2xl text-left border border-border relative">
                  <div className="absolute -top-3 left-6 text-2xl">💬</div>
                  <p className="text-sm text-foreground font-medium leading-relaxed mt-2">
                    {aiFeedback.feedback}
                  </p>
                </div>
                <p className="text-xs font-bold text-muted-foreground mt-8 animate-pulse flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  รอคุณครูไปยังหน้าถัดไป...
                </p>
              </div>
            ) : hasAnswered ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                {selectedChoice && (
                  <div className="bg-card px-6 py-4 rounded-xl border-2 border-border shadow-sm max-w-sm w-full">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">คำตอบของคุณ</p>
                    <p className="text-base font-semibold text-foreground break-words">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <>
                    <div className="text-6xl">✅</div>
                    <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">ตอบครบทุกคนแล้ว!</h2>
                    <p className="text-muted-foreground">รอคุณครูไปยังหน้าถัดไป...</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl animate-bounce">🤖</div>
                    <h2 className="text-xl font-bold text-foreground">ส่งคำตอบแล้ว!</h2>
                    <p className="text-muted-foreground">กำลังให้ AI ตรวจคำตอบ...</p>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                <h2 className="text-lg font-bold text-foreground mb-4">
                  {(() => {
                    const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
                    return articleData?.shortAnswerQuestions?.[idx]?.question || "พิมพ์คำตอบของคุณ";
                  })()}
                </h2>
                <textarea
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  className="w-full border-2 border-border bg-background text-foreground rounded-xl p-4 min-h-[150px] text-base focus:border-primary focus:outline-none mb-2 resize-none"
                  placeholder="พิมพ์คำตอบสั้นๆ ที่นี่..."
                />
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs text-muted-foreground">{typedAnswer.length} ตัวอักษร</span>
                </div>
                <button
                  onClick={handleTextSubmit}
                  disabled={!typedAnswer.trim()}
                  className="w-full bg-primary text-primary-foreground font-bold text-lg p-4 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                >
                  ส่งคำตอบ (Submit)
                </button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
