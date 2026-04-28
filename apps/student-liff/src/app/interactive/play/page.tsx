"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';

export default function PlayLessonPage() {
  const searchParams = useSearchParams();
  const pin = searchParams.get('pin');
  
  // In a real app, student ID and name come from LIFF profile
  const studentId = "std-123";
  const name = "Poom";

  const {
    sessionData,
    error,
    hasAnswered,
    aiFeedback,
    submitAnswer
  } = useLessonSocket(pin || '', studentId, name);

  const [typedAnswer, setTypedAnswer] = useState('');

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold text-xl">{error}</div>;
  }

  if (!sessionData) {
    return <div className="min-h-screen flex items-center justify-center bg-blue-600 text-white font-bold text-xl">Connecting...</div>;
  }

  const handleMcqClick = (answer: string) => {
    submitAnswer(answer);
  };

  const handleTextSubmit = () => {
    if (typedAnswer.trim()) {
      submitAnswer(typedAnswer, "What are the main causes of climate change?", "Deforestation, fossil fuels, industrial emissions.");
      setTypedAnswer('');
    }
  };

  const currentPhase = sessionData.currentPhase;

  // Render "Look at screen" for Phase 1-6, 9-12
  const isLookAtScreenPhase = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14].includes(currentPhase);
  
  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col">
      <header className="bg-white p-4 shadow-sm text-center font-bold text-lg text-slate-700">
        PIN: {pin}
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
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-5xl mb-6">⏳</div>
                <h2 className="text-2xl font-bold">รอเพื่อนตอบให้ครบ...</h2>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 flex-1">
                <button onClick={() => handleMcqClick('A')} className="bg-red-500 active:bg-red-600 rounded-2xl shadow-[0_8px_0_rgb(185,28,28)] active:shadow-[0_0px_0_rgb(185,28,28)] active:translate-y-2 transition-all"></button>
                <button onClick={() => handleMcqClick('B')} className="bg-blue-500 active:bg-blue-600 rounded-2xl shadow-[0_8px_0_rgb(29,78,216)] active:shadow-[0_0px_0_rgb(29,78,216)] active:translate-y-2 transition-all"></button>
                <button onClick={() => handleMcqClick('C')} className="bg-yellow-500 active:bg-yellow-600 rounded-2xl shadow-[0_8px_0_rgb(161,98,7)] active:shadow-[0_0px_0_rgb(161,98,7)] active:translate-y-2 transition-all"></button>
                <button onClick={() => handleMcqClick('D')} className="bg-green-500 active:bg-green-600 rounded-2xl shadow-[0_8px_0_rgb(21,128,61)] active:shadow-[0_0px_0_rgb(21,128,61)] active:translate-y-2 transition-all"></button>
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
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-5xl mb-6">🤖</div>
                <h2 className="text-2xl font-bold">กำลังให้ AI ตรวจคำตอบ...</h2>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold mb-4">พิมพ์คำตอบของคุณ</h2>
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
