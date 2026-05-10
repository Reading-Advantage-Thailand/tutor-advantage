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
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
        <div className="animate-spin w-8 h-8 border-3 border-slate-200 border-t-green-600 rounded-full" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#f9fafb]">
        <div className="text-3xl mb-4">❌</div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-slate-500 text-sm mb-6">{error || "ไม่พบข้อมูลที่ต้องการ"}</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl">
          ย้อนกลับ
        </Button>
      </div>
    );
  }

  const { session, answers } = detail;

  return (
    <div className="min-h-screen bg-[#f4f7f6] pb-10 font-sans">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-base font-bold text-slate-800 truncate">สรุปผลการเรียน</h1>
      </div>

      {/* Header Profile Banner */}
      <div className="bg-gradient-to-b from-green-600 to-emerald-700 px-6 py-8 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-6 bottom-0 w-24 h-24 bg-emerald-400/20 rounded-full blur-xl"></div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-3 backdrop-blur-md border border-white/30">
             <Trophy className="w-8 h-8 text-yellow-300" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight mb-1 drop-shadow-sm">
            {session.articleTitle}
          </h2>
          <p className="text-green-100 text-xs font-medium flex items-center gap-2">
            <span>ครู {session.tutorName}</span>
            <span className="w-1 h-1 bg-green-200/50 rounded-full"></span>
            <span>{new Date(session.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>

          <div className="mt-6 inline-flex bg-white text-emerald-800 px-6 py-2 rounded-full font-bold shadow-lg items-baseline gap-1">
             <span className="text-xs font-medium text-emerald-600/80 mr-1">คะแนนทั้งหมด:</span>
             <span className="text-xl leading-none">{session.totalScore}</span>
             <span className="text-[10px] text-emerald-600/70 uppercase font-bold">Pts</span>
          </div>
        </div>
      </div>

      {/* Content List of Answers */}
      <div className="p-4 flex flex-col gap-4 -mt-4 relative z-10">
         <div className="flex items-center justify-between mb-1 px-1">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              ผลการตอบคำถามรายข้อ
            </h3>
            <span className="text-xs font-medium text-slate-500">{answers.length} ข้อ</span>
         </div>

         {answers.length === 0 ? (
           <Card className="p-8 text-center bg-white border-0 shadow-sm rounded-2xl">
              <p className="text-sm text-slate-400 font-medium">ไม่พบรายการบันทึกคำตอบ</p>
           </Card>
         ) : (
           answers.map((a: any, index: number) => (
             <Card key={index} className="overflow-hidden border-0 shadow-sm rounded-2xl bg-white">
               <CardContent className="p-0">
                 {/* Phase Header */}
                 <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phase {a.phase}</span>
                   <div className={`flex items-center gap-1 px-2 py-1 rounded-md font-bold text-xs ${
                     a.score > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                   }`}>
                     {a.score > 0 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                     +{a.score} Pts
                   </div>
                 </div>

                 <div className="p-4">
                   {/* Question */}
                   <p className="text-slate-800 font-bold text-[15px] leading-snug mb-4">
                     {a.question || "คำถามไม่มีข้อความระบุ"}
                   </p>

                   {/* Student's Answer and Correct Answer Breakdown */}
                   <div className="grid gap-3">
                     <div className={`p-3 rounded-xl border ${a.isCorrect ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                       <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">คำตอบของคุณ</span>
                       <span className={`text-sm font-semibold ${a.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                         {a.answer || "ไม่ได้ระบุ"}
                       </span>
                     </div>

                     {!a.isCorrect && a.correctAnswer && (
                       <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">คำตอบที่ถูกต้อง</span>
                         <span className="text-sm font-semibold text-slate-700">
                           {a.correctAnswer}
                         </span>
                       </div>
                     )}

                     {/* AI Feedback Component */}
                     {a.aiFeedback && (
                       <div className="mt-2 bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex gap-3">
                         <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                           <MessageSquare className="w-4 h-4 text-blue-600" />
                         </div>
                         <div>
                           <span className="block text-xs font-bold text-blue-800 mb-0.5">AI Feedback</span>
                           <p className="text-xs leading-relaxed text-blue-900/80 whitespace-pre-line">
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
