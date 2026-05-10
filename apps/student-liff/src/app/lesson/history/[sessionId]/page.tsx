"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { studentApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CheckCircle2, XCircle, MessageSquare, Award, Trophy } from "lucide-react";

export default function LessonHistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      const fetchDetail = async () => {
        try {
          const data = await studentApi.getLessonSessionDetails(sessionId);
          setDetail(data);
        } catch (err: any) {
          setError(err.message || "ไม่สามารถโหลดข้อมูลประวัติได้");
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="animate-spin w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-emerald-600 dark:border-t-emerald-400 rounded-full" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 max-w-xs">{error || "ไม่พบข้อมูลที่ต้องการ"}</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          ย้อนกลับ
        </Button>
      </div>
    );
  }

  const { session, answers } = detail;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-12 font-sans transition-colors duration-300">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-20 bg-white/75 dark:bg-slate-900/75 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-700/50 px-4 py-3 flex items-center gap-3 shadow-sm transition-colors duration-300">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-95 active:bg-slate-100 dark:active:bg-slate-700 rounded-lg transition-all duration-200">
          <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </button>
        <h1 className="text-base font-bold text-slate-800 dark:text-white truncate">สรุปผลการเรียน</h1>
      </div>

      {/* Header Profile Banner */}
      <div className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 dark:from-emerald-900 dark:via-emerald-800 dark:to-teal-900 text-white transition-colors duration-300">
        {/* Decorative Elements */}
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 dark:bg-white/5 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -left-8 bottom-0 w-32 h-32 bg-emerald-300/20 dark:bg-emerald-400/10 rounded-full blur-2xl opacity-40"></div>
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-teal-300/10 dark:bg-teal-400/5 rounded-full blur-2xl opacity-30"></div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Trophy Icon */}
          <div className="bg-white/20 dark:bg-white/10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/30 dark:border-white/20 shadow-2xl transform transition-transform hover:scale-105 duration-300">
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-300 dark:text-yellow-200" />
          </div>

          {/* Article Title */}
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight mb-2 drop-shadow-md px-2 dark:text-white">
            {session.articleTitle}
          </h2>

          {/* Tutor Info */}
          <p className="text-emerald-50 dark:text-emerald-100 text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-6">
            <span>👨‍🏫 ครู {session.tutorName}</span>
            <span className="hidden sm:inline w-1 h-1 bg-emerald-200/60 dark:bg-emerald-300/40 rounded-full"></span>
            <span>📅 {new Date(session.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>

          {/* Score and Rank Badges */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            {/* Score Badge */}
            <div className="inline-flex bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 px-4 sm:px-5 py-2 sm:py-3 rounded-2xl font-bold shadow-lg items-baseline gap-1 sm:gap-2 relative hover:shadow-xl transition-shadow duration-300 whitespace-nowrap flex-shrink-0">
              <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Score</span>
              <span className="text-2xl sm:text-3xl leading-none">{session.totalScore}</span>
              <span className="text-[8px] sm:text-[9px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-bold">pts</span>
            </div>

            {/* Rank Badge */}
            {session.rank && (
              <div className="inline-flex bg-amber-300 dark:bg-amber-500 text-amber-900 dark:text-slate-900 px-4 sm:px-5 py-2 sm:py-3 rounded-2xl font-bold shadow-lg items-baseline gap-1 sm:gap-2 animate-bounce hover:shadow-xl transition-shadow duration-300 whitespace-nowrap flex-shrink-0">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-slate-900 self-center" />
                <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-800 dark:text-slate-900 uppercase tracking-wider">Rank</span>
                <span className="text-2xl sm:text-3xl leading-none">{session.rank}</span>
                {session.totalParticipants && (
                  <span className="text-[8px] sm:text-[9px] text-amber-800/60 dark:text-slate-900/60 font-bold">/{session.totalParticipants}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content List of Answers */}
      <div className="px-4 sm:px-6 py-6 flex flex-col gap-4 relative z-10 max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ผลการตอบคำถามรายข้อ
          </h3>
          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {answers.length} ข้อ
          </span>
        </div>

        {/* Empty State */}
        {answers.length === 0 ? (
          <Card className="p-8 text-center bg-white dark:bg-slate-800 border-0 shadow-md rounded-2xl transition-colors duration-300">
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">ไม่พบรายการบันทึกคำตอบ</p>
          </Card>
        ) : (
          /* Answers List */
          answers.map((a: any, index: number) => (
            <Card key={index} className="overflow-hidden border-0 shadow-md dark:shadow-lg rounded-2xl bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-emerald-900/30 transition-all duration-300 transform hover:scale-[1.01]">
              <CardContent className="p-0">
                {/* Phase Header */}
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full"></span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Phase {a.phase}</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors duration-300 ${
                    a.score > 0 
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                  }`}>
                    {a.score > 0 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>+{a.score} Pts</span>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {/* Question */}
                  <p className="text-slate-800 dark:text-slate-100 font-bold text-base sm:text-lg leading-relaxed mb-6">
                    ❓ {a.question || "คำถามไม่มีข้อความระบุ"}
                  </p>

                  {/* Student's Answer Section */}
                  <div className="grid gap-4 sm:gap-5">
                    {(() => {
                      const rawAnswer = a.answer || "ไม่ได้ระบุ";
                      const match = rawAnswer.match(/^ตัวเลือก\s+([A-Z]):\s*(.+)$/i) || rawAnswer.match(/^([A-D])\s*:\s*(.+)$/i);
                      
                      const displayLabel = match ? match[1].toUpperCase() : null;
                      const displayText = match ? match[2] : rawAnswer;

                      return (
                        <div className={`relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5 transition-all duration-300 ${
                          a.isCorrect 
                            ? 'bg-gradient-to-br from-emerald-50 to-emerald-50/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800 shadow-sm dark:shadow-emerald-900/20' 
                            : 'bg-gradient-to-br from-rose-50 to-rose-50/50 dark:from-rose-950/30 dark:to-rose-900/20 border-rose-200 dark:border-rose-800 shadow-sm dark:shadow-rose-900/20'
                        }`}>
                          <div className="flex items-start gap-4">
                            {displayLabel ? (
                              <div className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg transition-transform duration-300 ${
                                a.isCorrect 
                                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white' 
                                  : 'bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700 text-white'
                              }`}>
                                {displayLabel}
                              </div>
                            ) : (
                              <div className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl flex items-center justify-center text-2xl sm:text-3xl transition-all duration-300 ${
                                a.isCorrect 
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                              }`}>
                                {a.isCorrect ? "✅" : "❌"}
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <span className={`block text-xs font-extrabold tracking-widest mb-2 uppercase ${
                                a.isCorrect 
                                  ? 'text-emerald-700 dark:text-emerald-400' 
                                  : 'text-rose-700 dark:text-rose-400'
                              }`}>
                                คำตอบของคุณ
                              </span>
                              <p className={`text-base sm:text-lg font-bold leading-snug ${
                                a.isCorrect 
                                  ? 'text-emerald-900 dark:text-emerald-100' 
                                  : 'text-rose-900 dark:text-rose-100'
                              }`}>
                                {displayText}
                              </p>
                            </div>
                          </div>
                          
                          {/* Watermark */}
                          <div className={`absolute -bottom-8 -right-6 opacity-5 pointer-events-none`}>
                            {a.isCorrect 
                              ? <CheckCircle2 className="w-32 h-32 text-emerald-600 dark:text-emerald-400" /> 
                              : <XCircle className="w-32 h-32 text-rose-600 dark:text-rose-400" />
                            }
                          </div>
                        </div>
                      );
                    })()}

                    {/* Correct Answer Breakdown */}
                    {!a.isCorrect && a.correctAnswer && (
                      <div className="bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/30 dark:to-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-4 sm:p-5 shadow-sm dark:shadow-amber-900/10 transform transition-all duration-300">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br from-amber-200 to-amber-100 dark:from-amber-700 dark:to-amber-800 rounded-xl flex items-center justify-center shadow-md">
                            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 dark:text-amber-200" />
                          </div>
                          <div>
                            <span className="block text-xs font-extrabold text-amber-700 dark:text-amber-400 tracking-widest mb-1 uppercase">คำตอบที่ถูกต้อง</span>
                            <p className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-100">
                              {a.correctAnswer}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Feedback */}
                    {a.aiFeedback && (
                      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-950/40 dark:via-blue-950/40 dark:to-cyan-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-4 sm:p-5 flex gap-3 sm:gap-4 shadow-sm dark:shadow-indigo-900/10">
                        <div className="absolute top-0 right-0 p-8 w-28 h-28 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full blur-2xl"></div>
                        
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-slate-800 shadow-md rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-200 dark:border-indigo-700/50 relative z-10">
                          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        
                        <div className="relative z-10 flex-1 min-w-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold uppercase tracking-wider mb-3">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-indigo-400 dark:bg-indigo-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600 dark:bg-indigo-400"></span>
                            </span>
                            AI Evaluation
                          </span>
                          <p className="text-sm leading-relaxed text-indigo-900 dark:text-indigo-100 whitespace-pre-line font-medium">
                            {a.aiFeedback}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
