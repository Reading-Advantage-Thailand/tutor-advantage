"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinLessonPage() {
  const [pin, setPin] = useState('');
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      router.push(`/interactive/play?pin=${pin}`);
    }
  };

  return (
    <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-black text-slate-800 mb-8">Join Lesson</h1>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Game PIN"
            className="text-center text-3xl font-bold p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pin.length !== 6}
            className="bg-slate-900 text-white font-bold text-xl p-4 rounded-xl disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
