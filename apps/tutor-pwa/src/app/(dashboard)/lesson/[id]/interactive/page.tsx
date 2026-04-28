"use client";

import React, from 'react';
import { useParams } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { PhaseManager } from './PhaseManager';

export default function InteractiveLessonPage() {
  const params = useParams();
  const lessonId = params.id as string;
  // In a real app, tutorId would come from auth context
  const tutorId = "tutor-123"; 

  const {
    sessionData,
    participants,
    totalAnswered,
    allAnsweredData,
    changePhase
  } = useLessonSocket(tutorId, lessonId);

  if (!sessionData) {
    return <div className="flex h-screen items-center justify-center">Loading Session...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 min-h-[80vh] flex flex-col">
        <header className="flex justify-between items-center border-b pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Interactive Lesson</h1>
            <p className="text-gray-500">Phase: {sessionData.currentPhase}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Join with PIN:</p>
            <p className="text-4xl font-black text-blue-600 tracking-wider">{sessionData.pin}</p>
          </div>
        </header>

        <main className="flex-1 flex flex-col">
          <PhaseManager
            currentPhase={sessionData.currentPhase}
            participants={participants}
            totalAnswered={totalAnswered}
            allAnsweredData={allAnsweredData}
            changePhase={changePhase}
          />
        </main>
      </div>
    </div>
  );
}
