"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { useLiff } from '@/components/providers/LiffProvider';

export default function PlayLessonPage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const { profile, isReady: liffReady } = useLiff();
  
  const studentId = profile?.userId || "anonymous";
  const name = profile?.displayName || "Student";

  const {
    sessionData,
    articleData,
    error,
    hasAnswered,
    isEveryoneReady,
    aiFeedback,
    submitAnswer
  } = useLessonSocket(null, studentId, name, classId || undefined);

  const [typedAnswer, setTypedAnswer] = useState('');

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
    const mcqQuestion = articleData?.multipleChoiceQuestions?.[0];
    submitAnswer(answer, mcqQuestion?.question, mcqQuestion?.answer);
  };

  const handleTextSubmit = () => {
    if (typedAnswer.trim()) {
      const saqQuestion = articleData?.shortAnswerQuestions?.[0];
      submitAnswer(typedAnswer, saqQuestion?.question, saqQuestion?.answer);
      setTypedAnswer('');
    }
  };

  const currentPhase = sessionData.currentPhase;

  // Render "Look at screen" for Phase 1-6, 9-12
  const isLookAtScreenPhase = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14].includes(currentPhase);
  
  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col">
      <header className="bg-white p-4 shadow-sm text-center font-bold text-lg text-slate-700">
        บทเรียน Interactive
      </header>

      <main className="flex-1 flex flex-col p-4 items-center justify-center relative">
        
        {isLookAtScreenPhase && (
          <div className="text-center animate-in fade-in zoom-in duration-300">
            <div className="text-6xl mb-6">👀</div>
            <h2 className="text-3xl font-black text-slate-800">โปรดดูที่หน้าจอของคุณครู</h2>
            <p className="text-xl text-slate-500 mt-4">(Please look at the screen)</p>
          </div>
        )}

        {currentPhase === 7 && (
          <div className="w-full max-w-md flex-1 flex flex-col">
            {hasAnswered ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in">
                {isEveryoneReady ? (
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
                  {articleData?.multipleChoiceQuestions?.[0]?.question || "เลือกคำตอบที่ถูกต้อง"}
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
                {isEveryoneReady ? (
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
                  {articleData?.shortAnswerQuestions?.[0]?.question || "พิมพ์คำตอบของคุณ"}
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
