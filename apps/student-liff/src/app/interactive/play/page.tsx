"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';
import { playSound } from '@/lib/sounds';
import { t } from '@/lib/i18n';
import Image from 'next/image';

// ── Mobile Leaderboard (student side) ────────────────────────────────────────
function MobileLeaderboard({ participants, studentId }: { participants: { studentId: string; name: string; pictureUrl?: string; score?: number }[]; studentId: string }) {
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  const myRank = sorted.findIndex(p => p.studentId === studentId) + 1;

  if (sorted.length === 0) return null;

  return (
    <div className="w-full mt-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Leaderboard</span>
        </div>
        {myRank > 0 && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            คุณ #{myRank}
          </span>
        )}
      </div>

      {/* List */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
        {sorted.map((p, i) => {
          const rank = i + 1;
          const isMe = p.studentId === studentId;
          const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

          return (
            <div
              key={p.studentId || i}
              className={[
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 border-2 transition-all duration-300',
                isMe
                  ? 'border-primary/50 bg-primary/10'
                  : rank === 1
                  ? 'border-amber-400/40 bg-amber-400/5'
                  : rank === 2
                  ? 'border-slate-400/30 bg-slate-400/5'
                  : rank === 3
                  ? 'border-orange-400/30 bg-orange-400/5'
                  : 'border-border/50 bg-card/60',
              ].join(' ')}
            >
              {/* Rank badge */}
              <div className="w-6 text-center shrink-0">
                {rankEmoji
                  ? <span className="text-base leading-none">{rankEmoji}</span>
                  : <span className="text-[10px] font-bold text-muted-foreground">#{rank}</span>
                }
              </div>

              {/* Avatar */}
              <div className="size-8 rounded-full overflow-hidden border border-border shrink-0 bg-muted flex items-center justify-center">
                {p.pictureUrl
                  ? <img src={p.pictureUrl} alt={p.name} className="size-full object-cover" />
                  : <span className="text-[10px] font-bold text-muted-foreground">{(p.name || '?').slice(0, 2)}</span>
                }
              </div>

              {/* Name */}
              <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                {isMe ? 'คุณ' : p.name}
              </span>

              {isMe && (
                <span className="text-[9px] bg-primary text-primary-foreground font-bold px-1.5 py-0.5 rounded-full shrink-0">ME</span>
              )}

              {/* Score */}
              <div className="text-right shrink-0">
                <p className={`text-sm font-black tabular-nums ${isMe ? 'text-primary' : rank <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                  {p.score || 0}
                </p>
                <p className="text-[9px] text-muted-foreground leading-none">pts</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  // Play sound on phase change
  useEffect(() => {
    if (sessionData && prevPhase !== null && sessionData.currentPhase !== prevPhase) {
      playSound('phaseChange');
    }
    if (sessionData) setPrevPhase(sessionData.currentPhase);
    setIsSubmitting(false);
  }, [sessionData, prevPhase]);

  useEffect(() => {
    if (hasAnswered) {
      setIsSubmitting(false);
    }
  }, [hasAnswered]);

  useEffect(() => {
    if (sessionData && sessionData.currentPhase === 0 && classId) {
      router.push(`/lesson/${classId}`);
    }
  }, [sessionData, classId, router]);

  useEffect(() => {
    if (!hasAnswered && !isSubmitting) setSelectedChoice(null);
  }, [hasAnswered, isSubmitting]);

  // ─── Loading States ────────────────────────────────────────
  if (!liffReady) {
    return (
      <div className="min-h-[100dvh] bg-background px-6 py-[max(24px,var(--safe-top))] flex items-center justify-center">
        <div className="w-full max-w-[280px] rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="animate-spin h-9 w-9 border-4 border-primary/25 border-t-primary rounded-full mx-auto mb-4" />
          <p className="text-foreground font-bold text-sm">{t("interactivePlay.openingLesson")}</p>
          <p className="text-muted-foreground font-medium text-xs mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  if (kicked) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{kicked}</h2>
        <p className="text-muted-foreground mb-8">{t("interactivePlay.lessonEnded")}</p>
        <button onClick={() => router.push('/dashboard')} className="w-full max-w-xs h-12 bg-primary text-primary-foreground rounded-xl font-bold transition-all active:scale-95 shadow-md">
          {t("interactivePlay.backHome")}
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="text-destructive font-bold text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-[100dvh] bg-background px-6 py-[max(24px,var(--safe-top))] flex items-center justify-center">
        <div className="w-full max-w-[280px] rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="animate-spin h-9 w-9 border-4 border-primary/25 border-t-primary rounded-full mx-auto mb-4" />
          <p className="text-foreground font-bold text-sm">{t("interactivePlay.connectingLesson")}</p>
          <p className="text-muted-foreground font-medium text-xs mt-1">Connecting...</p>
        </div>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────
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
          <span className="font-bold text-sm text-foreground">{t("interactivePlay.title")}</span>
        </div>
        {currentPhase > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md uppercase tracking-wider">
            Phase {currentPhase}
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col p-4 items-center justify-center relative">
        
        {/* Phase 0 - Waiting Room */}
        {currentPhase === 0 && (
          <div className="phase-enter text-center flex flex-col items-center justify-center absolute inset-0 bg-gradient-to-br from-background via-muted to-background overflow-hidden p-6 z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent animate-pulse" style={{ animationDuration: '4s' }} />
            
            <div className="relative z-10 flex flex-col items-center max-w-sm w-full bg-card/80 backdrop-blur-xl p-8 rounded-3xl border border-border shadow-2xl">
              <div className="w-24 h-24 rounded-full border-4 border-primary/20 p-1 mb-4 shadow-sm bg-background overflow-hidden">
                <Image 
                  src={profile?.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
                  alt={name} 
                  className="w-full h-full rounded-full object-cover" 
                  width={96} 
                  height={96} 
                  unoptimized 
                />
              </div>
              <h2 className="text-2xl font-black text-foreground">{name}</h2>
              <p className="text-sm text-primary font-bold mt-1 mb-6 bg-primary/10 px-3 py-1 rounded-full">{t("interactivePlay.studentRole")}</p>
              
              <p className="text-base text-muted-foreground font-medium flex items-center gap-2">
                {t("interactivePlay.waitingTeacher")}
                <span className="loading-dots flex"><span className="bg-muted-foreground"/><span className="bg-muted-foreground"/><span className="bg-muted-foreground"/></span>
              </p>

              <button
                onClick={() => router.push('/dashboard')}
                className="mt-8 bg-card hover:bg-muted text-foreground font-bold py-3 px-6 rounded-xl w-full transition-all active:scale-95 flex items-center justify-center gap-2 text-sm border border-border shadow-sm"
              >
                {t("interactivePlay.backToHome")}
              </button>
            </div>
          </div>
        )}

        {/* Look at Screen Phases */}
        {isLookAtScreenPhase && (
          <div className="phase-enter absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted overflow-hidden z-0">
            {/* Subtle particle background effect */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at center, currentColor 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
            
            <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full shrink-0">
              <h2 className="text-2xl font-black text-foreground tracking-tight mb-1 shrink-0">{t("interactivePlay.lookAtScreen")}</h2>
              <p className="text-sm text-muted-foreground font-medium mb-5 shrink-0">Please look at the screen</p>
              
              <div 
                className="bg-card border border-border shadow-lg rounded-3xl w-full shrink-0"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "40px",
                  alignItems: "center",
                  padding: "0px",
                  paddingBottom: "5px",
                  boxSizing: "border-box"
                }}
              >
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 shrink-0">{t("interactivePlay.currentStatus")}</p>
                <div 
                  className="bg-primary/10 rounded-2xl border border-primary/20 shrink-0"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "16px",
                    boxSizing: "border-box"
                  }}
                >
                  <div className="text-left shrink-0">
                    <p className="text-xs text-primary font-bold">{t("interactivePlay.teacherTeaching")}</p>
                    <p className="text-sm font-black text-foreground">{phaseNames[currentPhase] || `Phase ${currentPhase}`}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 14 - Personal Leaderboard */}
        {currentPhase === 14 && (
          <div className="phase-enter w-full max-w-md bg-card rounded-3xl p-6 shadow-xl border border-border flex flex-col items-center min-h-[450px] text-center relative overflow-hidden">
            <div className="absolute top-[-40px] right-[-40px] w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-[-40px] left-[-40px] w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
            
            {(() => {
              const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
              const studentIndex = sorted.findIndex(p => p.studentId === studentId);
              const rank = studentIndex !== -1 ? studentIndex + 1 : 1;
              const score = sorted[studentIndex]?.score || 0;

              let title = t("interactivePlay.greatJob");

              if (rank === 1) { title = t("interactivePlay.rankFirst"); }
              else if (rank === 2) { title = t("interactivePlay.rankSecond"); }
              else if (rank === 3) { title = t("interactivePlay.rankThird"); }

              return (
                <div className="flex flex-col items-center gap-4 w-full relative z-10">
                  <h2 className="text-2xl font-black text-foreground tracking-tight leading-snug px-2">{title}</h2>
                  
                  <div className="text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-muted text-muted-foreground flex items-center gap-1.5">
                    {t("interactivePlay.rankPrefix")} {rank} {t("interactivePlay.rankFrom")} {participants.length} {t("interactivePlay.personUnit")}
                  </div>

                  <div className="bg-muted border-2 border-border rounded-2xl p-5 w-full mt-4 flex flex-col items-center gap-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("interactivePlay.totalScore")}</p>
                    <p className="text-5xl font-black text-primary tracking-tight mt-1">
                      {score} <span className="text-xl font-medium text-muted-foreground">pts</span>
                    </p>
                  </div>

                  <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 w-full flex items-start gap-3 text-left">
                    <div>
                      <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t("interactivePlay.lessonCompletedTitle")}</h4>
                      <p className="text-emerald-600 dark:text-emerald-500 text-xs mt-0.5 leading-relaxed">
                        {t("interactivePlay.lessonCompletedDescription")}
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
              <div className="flex-1 flex flex-col items-start justify-start text-center gap-3 pt-2 w-full overflow-y-auto">
                {selectedChoice && (
                  <div className="bg-card px-6 py-3 rounded-xl border-2 border-border shadow-sm w-full shrink-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-4xl font-black text-foreground">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center shrink-0">
                    <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{t("interactivePlay.everyoneAnswered")}</h2>
                    <p className="text-sm text-muted-foreground">{t("interactivePlay.watchTeacherAnswer")}</p>
                  </div>
                ) : (
                  <div className="w-full bg-card/80 border border-border rounded-xl p-3 text-center shrink-0">
                    <h2 className="text-lg font-bold text-foreground">{t("interactivePlay.answerSubmitted")}</h2>
                    <p className="text-sm text-muted-foreground">{t("interactivePlay.waitingFriends")}</p>
                  </div>
                )}
                {/* Live Leaderboard */}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col w-full gap-4">
                {/* Question */}
                <div className="bg-card p-4 rounded-xl shadow-sm border border-border text-center font-bold text-foreground text-sm leading-relaxed">
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
                {/* MCQ 2x2 Grid - Full Screen */}
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
          <div className="phase-enter w-full max-w-md flex-1 min-h-0 flex flex-col justify-start py-3 sm:justify-center">
            {aiFeedback ? (
              <div className="bg-card rounded-2xl p-5 shadow-xl border border-border text-center w-full mx-auto flex flex-col items-center">
                <div className="bg-primary/10 text-primary px-3.5 py-1.5 rounded-full font-bold text-xs mb-5 uppercase tracking-wider shrink-0">
                  {t("interactivePlay.aiEvaluation")}
                </div>
                
                {/* Main Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full text-left mb-4 shrink-0">
                  {/* Score Ring */}
                  <div className="relative w-24 h-24 shrink-0 self-center">
                    <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="8" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-primary" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray="283" strokeDashoffset={283 - (283 * (aiFeedback.score || 0) / 5)}
                        style={{ animation: 'score-ring-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-3xl font-black text-foreground">{aiFeedback.score}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{t("interactivePlay.fullScore")}</span>
                    </div>
                  </div>
                  
                  {/* Feedback Box */}
                  <div className="flex-1 bg-muted/50 border border-border/60 p-4 rounded-2xl relative min-h-[88px] flex items-center">
                    <p className="text-sm sm:text-xs font-semibold text-foreground leading-relaxed break-words">
                      {aiFeedback.feedback}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-bold text-muted-foreground mt-2 animate-pulse flex items-center justify-center gap-2 shrink-0 text-center leading-relaxed">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  {t("interactivePlay.waitingNextPage")}
                </p>
              </div>
            ) : (hasAnswered || isSubmitting) ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-start text-center gap-3 pt-2 w-full mx-auto overflow-y-auto">
                {selectedChoice && (
                  <div className="bg-card px-5 py-3.5 rounded-2xl border border-border shadow-md w-full shrink-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t("interactivePlay.yourAnswer")}</p>
                    <p className="text-sm font-semibold text-foreground break-words leading-relaxed">{selectedChoice}</p>
                  </div>
                )}

                {showEveryoneReady ? (
                  <div className="bg-card rounded-2xl p-4 shadow-xl border border-border text-center w-full flex flex-col items-center shrink-0">
                    <h2 className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight mb-1">{t("interactivePlay.submittedDone")}</h2>
                    <p className="text-xs text-muted-foreground font-medium">{t("interactivePlay.waitingAiScore")}</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl p-4 shadow-xl border border-border text-center w-full flex flex-col items-center shrink-0">
                    {/* Glowing Live AI Badge */}
                    <div className="bg-primary/10 text-primary px-3.5 py-1.5 rounded-full font-bold text-xs mb-4 uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 max-w-full">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      {t("interactivePlay.sendingAi")}
                    </div>

                    {/* Skeleton Row */}
                    <div className="flex items-center gap-4 w-full text-left mb-3 shrink-0">
                      <div className="relative w-14 h-14 shrink-0 rounded-full bg-muted border border-border/60 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 skeleton opacity-40" />
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="h-3 w-full rounded-md skeleton opacity-40" />
                        <div className="h-3 w-5/6 rounded-md skeleton opacity-40" />
                        <div className="h-3 w-2/3 rounded-md skeleton opacity-40" />
                      </div>
                    </div>

                    <p className="text-xs font-bold text-muted-foreground animate-pulse leading-relaxed shrink-0">
                      {t("interactivePlay.aiChecking")}
                    </p>
                  </div>
                )}

                {/* Live Leaderboard while waiting */}
                <MobileLeaderboard participants={participants} studentId={studentId} />
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-5 shadow-lg border border-border w-full">
                <h2 className="text-base font-bold text-foreground mb-4 leading-relaxed">
                  {(() => {
                    const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
                    return articleData?.shortAnswerQuestions?.[idx]?.question || t("interactivePlay.textAnswerFallback");
                  })()}
                </h2>
                <textarea
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  className="w-full border-2 border-border bg-background text-foreground rounded-xl p-4 min-h-[132px] max-h-[42dvh] text-base leading-relaxed focus:border-primary focus:outline-none mb-2 resize-y"
                  placeholder={t("interactivePlay.textAnswerPlaceholder")}
                />
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs text-muted-foreground">{typedAnswer.length} {t("interactivePlay.characterUnit")}</span>
                </div>
                <button
                  onClick={handleTextSubmit}
                  disabled={!typedAnswer.trim()}
                  className="w-full bg-primary text-primary-foreground font-bold text-lg p-4 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                >
                  {t("interactivePlay.submitAnswer")}
                </button>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t("interactivePlay.preparingData")}</p>
          </div>
        </div>
      }
    >
      <PlayLessonContent />
    </Suspense>
  );
}
