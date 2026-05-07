"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';

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
    submitAnswer
  } = useLessonSocket(null, studentId, name, classId || undefined);

  const [typedAnswer, setTypedAnswer] = useState('');
  const [showEveryoneReady, setShowEveryoneReady] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  useEffect(() => {
    if (isEveryoneReady) {
      const timer = setTimeout(() => {
        setShowEveryoneReady(true);
      }, 2500); // 2.5 seconds delay gives enough time to read
      return () => clearTimeout(timer);
    } else {
      setShowEveryoneReady(false);
    }
  }, [isEveryoneReady]);

  useEffect(() => {
    if (sessionData && sessionData.currentPhase === 0 && classId) {
      router.push(`/lesson/${classId}`);
    }
  }, [sessionData?.currentPhase, classId, router]);

  useEffect(() => {
    if (!hasAnswered) {
      setSelectedChoice(null);
    }
  }, [hasAnswered]);

  if (!liffReady) {
    return <div className="min-h-screen flex items-center justify-center bg-blue-600 text-white font-bold text-xl">Loading LIFF...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold text-xl">{error}</div>;
  }

  if (!sessionData) {
    return <div className="min-h-screen flex items-center justify-center bg-blue-600 text-white font-bold text-xl">Connecting...</div>;
  }

  const handleMcqClick = (answer: string) => {
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
      setSelectedChoice(typedAnswer);
      const currentPhase = sessionData?.currentPhase;
      const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
      const saqQuestion = articleData?.shortAnswerQuestions?.[idx];
      submitAnswer(typedAnswer, saqQuestion?.question, saqQuestion?.answer);
      setTypedAnswer('');
    }
  };

  const currentPhase = sessionData.currentPhase;

  // Render "Look at screen" for Phase 1-6, 9
  const isLookAtScreenPhase = [1, 2, 3, 4, 5, 6, 9].includes(currentPhase);
  
  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col">
      <header className="bg-white p-4 shadow-sm text-center font-bold text-lg text-slate-700">
        บทเรียน Interactive
      </header>

      <main className="flex-1 flex flex-col p-4 items-center justify-center relative">
        
        {currentPhase === 0 && (
          <div className="text-center animate-in fade-in zoom-in duration-300 flex flex-col items-center max-w-sm w-full bg-white p-8 rounded-3xl border border-slate-100 shadow-xl">
            <div className="text-7xl mb-6">🎮</div>
            <h2 className="text-2xl font-black text-slate-800">ยินดีต้อนรับสู่ห้องเรียน!</h2>
            <p className="text-base text-slate-500 mt-2 font-medium">โปรดรอติวเตอร์เริ่มบทเรียน...</p>
            <div className="mt-6 bg-blue-50 border border-blue-100 px-5 py-3 rounded-2xl animate-pulse font-bold text-blue-700 w-full">
              คุณครูกำลังเตรียมความพร้อม
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl w-full transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              🏠 กลับสู่หน้าหลัก (Dashboard)
            </button>
          </div>
        )}

        {isLookAtScreenPhase && (
          <div className="text-center animate-in fade-in zoom-in duration-300">
            <div className="text-6xl mb-6">👀</div>
            <h2 className="text-3xl font-black text-slate-800">โปรดดูที่หน้าจอของคุณครู</h2>
            <p className="text-xl text-slate-500 mt-4">(Please look at the screen)</p>
          </div>
        )}

        {currentPhase === 14 && (
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl border-2 border-slate-100 flex flex-col items-center justify-between min-h-[450px] animate-in slide-in-from-bottom duration-500 text-center select-none relative overflow-hidden">
            <div className="absolute top-[-40px] right-[-40px] w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute bottom-[-40px] left-[-40px] w-32 h-32 bg-amber-100 rounded-full blur-3xl opacity-60"></div>

            <div className="flex flex-col items-center gap-4 w-full">
              {(() => {
                const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
                const studentIndex = sorted.findIndex(p => p.studentId === studentId);
                const rank = studentIndex !== -1 ? studentIndex + 1 : 1;
                const score = sorted[studentIndex]?.score || 0;

                let title = "ทำได้ดีมาก! (Great Job!)";
                let emoji = "🎖️";
                let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";

                if (rank === 1) {
                  title = "ชนะเลิศอันดับ 1! (1st Place!)";
                  emoji = "🏆";
                  badgeStyle = "bg-amber-100 text-amber-800 border-amber-200";
                } else if (rank === 2) {
                  title = "รองชนะเลิศอันดับ 1 (2nd Place!)";
                  emoji = "🥈";
                  badgeStyle = "bg-slate-200 text-slate-800 border-slate-300";
                } else if (rank === 3) {
                  title = "รองชนะเลิศอันดับ 2 (3rd Place!)";
                  emoji = "🥉";
                  badgeStyle = "bg-amber-50 text-amber-900 border-amber-200";
                }

                return (
                  <>
                    <div className="text-7xl mb-2 animate-bounce">{emoji}</div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-snug px-2">
                      {title}
                    </h2>
                    
                    <div className={`mt-2 text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${badgeStyle} animate-in fade-in duration-300`}>
                      <span>🏅</span> อันดับที่ {rank} จากนักเรียนทั้งหมด {participants.length} คน
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 w-full mt-6 flex flex-col items-center gap-1 shadow-inner">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">คะแนนรวมของคุณ (Your Score)</p>
                      <p className="text-5xl font-black text-blue-600 tracking-tight mt-1">
                        {score} <span className="text-xl font-medium text-blue-400">pts</span>
                      </p>
                    </div>

                    <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 w-full flex items-start gap-3 text-left">
                      <span className="text-xl">🌟</span>
                      <div>
                        <h4 className="font-bold text-emerald-800 text-sm">บทเรียนเสร็จสิ้นแล้ว!</h4>
                        <p className="text-emerald-700 text-xs mt-0.5 leading-relaxed">
                          คุณได้มีส่วนร่วมและตอบคำถามครบทุก Phase อย่างยอดเยี่ยม คุณครูจะสรุปผลและมอบรางวัลความตั้งใจให้ในคลาสเรียนครับ
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {[7, 10, 11, 12].includes(currentPhase) && (
          <div className="w-full max-w-md flex-1 flex flex-col">
            {hasAnswered ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in">
                {selectedChoice && (
                  <div className="mb-4 bg-white px-6 py-3 rounded-xl border-2 border-slate-200 shadow-sm animate-in fade-in">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">คำตอบของคุณ</p>
                    <p className="text-4xl font-black text-slate-800">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <>
                    <div className="text-6xl mb-6">✅</div>
                    <h2 className="text-3xl font-bold text-emerald-600">ตอบครบทุกคนแล้ว!</h2>
                    <p className="text-slate-500 mt-2">โปรดดูเฉลยที่หน้าจอคุณครู</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-6 animate-bounce">⏳</div>
                    <h2 className="text-2xl font-bold">ส่งคำตอบแล้ว!</h2>
                    <p className="text-slate-500 mt-2">รอเพื่อนตอบให้ครบ...</p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col w-full gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm mb-4 text-center font-bold">
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
                      const display = words.slice(0, words.length - 1).join(' ') + ' _____';
                      return `เติมคำในช่องว่าง: ${display}`;
                    } else if (currentPhase === 12) {
                      const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
                      const s = articleData?.sentences?.[idx];
                      const targetStr = typeof s === 'object' ? s.sentences : s;
                      return `เรียงประโยคให้ถูกต้องสำหรับประโยคที่ ${idx + 1}`;
                    }
                    return "เลือกคำตอบที่ถูกต้อง";
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <button onClick={() => handleMcqClick('A')} className="bg-red-500 active:bg-red-600 rounded-2xl shadow-[0_8px_0_rgb(185,28,28)] active:shadow-[0_0px_0_rgb(185,28,28)] active:translate-y-2 transition-all flex items-center justify-center text-white text-3xl font-bold">A</button>
                  <button onClick={() => handleMcqClick('B')} className="bg-blue-500 active:bg-blue-600 rounded-2xl shadow-[0_8px_0_rgb(29,78,216)] active:shadow-[0_0px_0_rgb(29,78,216)] active:translate-y-2 transition-all flex items-center justify-center text-white text-3xl font-bold">B</button>
                  <button onClick={() => handleMcqClick('C')} className="bg-yellow-500 active:bg-yellow-600 rounded-2xl shadow-[0_8px_0_rgb(161,98,7)] active:shadow-[0_0px_0_rgb(161,98,7)] active:translate-y-2 transition-all flex items-center justify-center text-white text-3xl font-bold">C</button>
                  <button onClick={() => handleMcqClick('D')} className="bg-green-500 active:bg-green-600 rounded-2xl shadow-[0_8px_0_rgb(21,128,61)] active:shadow-[0_0px_0_rgb(21,128,61)] active:translate-y-2 transition-all flex items-center justify-center text-white text-3xl font-bold">D</button>
                </div>
              </div>
            )}
          </div>
        )}

        {(currentPhase === 8 || currentPhase === 13) && (
          <div className="w-full max-w-md flex-1 flex flex-col justify-center">
            {aiFeedback ? (
              <div className="bg-white rounded-2xl p-6 shadow-lg text-center animate-in slide-in-from-bottom-8">
                <h2 className="text-2xl font-bold mb-4">ผลประเมินจาก AI</h2>
                <div className="text-5xl font-black text-blue-600 mb-6">{aiFeedback.score}/5</div>
                <p className="text-lg text-slate-700 bg-slate-50 p-4 rounded-xl text-left border">
                  {aiFeedback.feedback}
                </p>
                <p className="text-sm text-slate-400 mt-6">รอคุณครูไปยังหน้าถัดไป...</p>
              </div>
            ) : hasAnswered ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in">
                {selectedChoice && (
                  <div className="mb-4 bg-white px-6 py-4 rounded-xl border-2 border-slate-200 shadow-sm max-w-sm w-full animate-in fade-in">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">คำตอบของคุณ</p>
                    <p className="text-lg font-semibold text-slate-800 break-words">{selectedChoice}</p>
                  </div>
                )}
                {showEveryoneReady ? (
                  <>
                    <div className="text-6xl mb-6">✅</div>
                    <h2 className="text-3xl font-bold text-emerald-600">ตอบครบทุกคนแล้ว!</h2>
                    <p className="text-slate-500 mt-2">รอคุณครูไปยังหน้าถัดไป...</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-6 animate-bounce">🤖</div>
                    <h2 className="text-2xl font-bold">ส่งคำตอบแล้ว!</h2>
                    <p className="text-slate-500 mt-2">กำลังให้ AI ตรวจคำตอบ...</p>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold mb-4">
                  {(() => {
                    const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
                    return articleData?.shortAnswerQuestions?.[idx]?.question || "พิมพ์คำตอบของคุณ";
                  })()}
                </h2>
                <textarea
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl p-4 min-h-[150px] text-lg focus:border-blue-500 focus:outline-none mb-4"
                  placeholder="พิมพ์คำตอบสั้นๆ ที่นี่..."
                ></textarea>
                <button
                  onClick={handleTextSubmit}
                  disabled={!typedAnswer.trim()}
                  className="w-full bg-blue-600 text-white font-bold text-xl p-4 rounded-xl disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-blue-700"
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
