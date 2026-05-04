"use client";

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLessonSocket } from '@/hooks/useLessonSocket';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Users, Bell, UserMinus, ShieldCheck, 
  BookOpen, ChevronRight, Play, Info, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PhaseManager } from './PhaseManager';

export default function TutorLobbyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.id as string;
  const articleId = searchParams.get('articleId') as string;
  
  // In a real app, tutorId would come from auth context
  const tutorId = "tutor-123"; 

  const {
    sessionData,
    participants,
    articleData,
    totalAnswered,
    allAnsweredData,
    error,
    changePhase,
    nudgeStudent,
    kickStudent
  } = useLessonSocket(tutorId, articleId, classId);

  const readyCount = participants.filter(p => p.isReady).length;
  const totalCount = participants.length;
  const isEveryoneReady = totalCount > 0 && readyCount === totalCount;

  // If lesson has started (phase > 1), show PhaseManager
  if (sessionData && sessionData.currentPhase > 1) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Link href={`/dashboard/classes/${classId}`}>
                    <Button variant="ghost" size="icon">
                       <ArrowLeft />
                    </Button>
                 </Link>
                 <div>
                    <h1 className="text-2xl font-bold">กำลังสอน: {articleData?.title}</h1>
                    <p className="text-sm text-muted-foreground">ขั้นตอนที่ {sessionData.currentPhase}</p>
                 </div>
              </div>
              <Badge className="bg-primary text-white px-4 py-1.5 text-sm">
                 Live Teaching
              </Badge>
           </div>

           <div className="bg-white rounded-2xl shadow-xl p-8 min-h-[70vh]">
              <PhaseManager
                currentPhase={sessionData.currentPhase}
                participants={participants}
                totalAnswered={totalAnswered}
                allAnsweredData={allAnsweredData}
                articleData={articleData}
                changePhase={changePhase}
              />
           </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 flex-col gap-4 p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-red-700">เกิดข้อผิดพลาดในการสร้างเซสชัน</h2>
        <p className="text-red-600 max-w-md">{error}</p>
        <Link href={`/dashboard/classes/${classId}`}>
          <Button variant="outline">กลับไปยังคลาส</Button>
        </Link>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">กำลังเตรียมห้องเรียนสำหรับติวเตอร์...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Top Navigation */}
      <header className="bg-white border-b sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/classes/${classId}`}>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">Lobby ควบคุมการสอน</h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Live Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Class ID: {classId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="text-right mr-2">
                <p className="text-xs text-muted-foreground">Session PIN</p>
                <p className="text-xl font-black text-primary font-mono">{sessionData.pin}</p>
             </div>
             <Button variant="destructive" size="sm" className="rounded-xl">
               ปิดห้องเรียน
             </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Lesson Info */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="overflow-hidden border-none shadow-md">
              <div className="bg-primary p-6 text-white">
                 <div className="flex items-center gap-2 mb-4 opacity-80">
                    <BookOpen size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">กำลังสอน</span>
                 </div>
                 <h2 className="text-xl font-bold leading-tight mb-2">
                   {articleData?.title || 'บทเรียนกำลังโหลด...'}
                 </h2>
                 <p className="text-sm opacity-90 line-clamp-2">
                    {articleData?.description || 'ไม่มีคำอธิบายสำหรับบทเรียนนี้'}
                 </p>
              </div>
              <CardContent className="p-5 bg-white">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-muted-foreground">จำนวน Phases</span>
                       <span className="font-bold">15 ขั้นตอน</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-muted-foreground">ประเภทเนื้อหา</span>
                       <Badge variant="secondary">Reading & Vocabulary</Badge>
                    </div>
                    <div className="pt-4">
                       <Button variant="outline" className="w-full gap-2 text-xs h-9">
                          <Info size={14} /> ดูตัวอย่างเนื้อหาที่สอน
                       </Button>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm bg-blue-50/50">
              <CardContent className="p-5">
                 <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <ShieldCheck size={16} /> Tutor Tips
                 </h4>
                 <ul className="text-xs text-blue-800/80 space-y-2 list-disc pl-4">
                    <li>รอให้นักเรียนกด Ready ครบทุกคนก่อนเริ่มสอน</li>
                    <li>ใช้ปุ่ม Nudge เพื่อเตือนนักเรียนที่ยังไม่พร้อม</li>
                    <li>หากนักเรียนหลุด สามารถให้เข้าใหม่ด้วย Class ID เดิม</li>
                 </ul>
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Participant Management */}
        <div className="lg:col-span-8 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                 <Users className="text-primary" />
                 นักเรียนในห้อง ({totalCount})
              </h3>
              <div className="flex items-center gap-2 text-sm">
                 <span className="text-muted-foreground">ความพร้อม:</span>
                 <span className={`font-bold ${isEveryoneReady ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {readyCount} / {totalCount} คน
                 </span>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.length === 0 ? (
                 <div className="col-span-2 py-20 bg-white rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                       <Users className="text-muted-foreground" size={32} />
                    </div>
                    <h4 className="font-bold text-lg">ยังไม่มีนักเรียนเข้าร่วม</h4>
                    <p className="text-sm text-muted-foreground">ให้นักเรียนเข้าผ่าน Student LIFF และเลือกคลาสนี้</p>
                 </div>
              ) : (
                participants.map((p) => (
                  <Card key={p.studentId} className={`overflow-hidden border-2 transition-all ${p.isReady ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-100 bg-white'}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                       <div className="relative">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border">
                             <img src={p.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} alt={p.name} />
                          </div>
                          {p.isReady && (
                             <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-white">
                                <ShieldCheck size={12} color="white" />
                             </div>
                          )}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{p.name}</p>
                          <p className={`text-[10px] font-bold uppercase ${p.isReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                             {p.isReady ? 'Ready to Learn' : 'Waiting...'}
                          </p>
                       </div>

                       <div className="flex items-center gap-1">
                          {!p.isReady && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 text-orange-500 hover:bg-orange-50"
                               onClick={() => nudgeStudent(p.studentId)}
                               title="เตือนนักเรียน"
                             >
                                <Bell size={16} />
                             </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            onClick={() => kickStudent(p.studentId)}
                            title="เตะออกจากคลาส"
                          >
                             <UserMinus size={16} />
                          </Button>
                       </div>
                    </CardContent>
                  </Card>
                ))
              )}
           </div>

           {/* Call to Action */}
           <div className="pt-8">
              <Button 
                className={`w-full h-16 rounded-2xl text-lg font-bold gap-3 shadow-xl transition-all ${
                  isEveryoneReady 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                disabled={!isEveryoneReady}
                onClick={() => changePhase(2)} // Jump to the first actual phase
              >
                 <Play fill="currentColor" />
                 {isEveryoneReady ? 'เริ่มการสอนเลย!' : `รอนักเรียนพร้อม (${readyCount}/${totalCount})`}
              </Button>
              {!isEveryoneReady && totalCount > 0 && (
                 <p className="text-center text-xs text-muted-foreground mt-4">
                    * คุณครูจะเริ่มสอนได้เมื่อนักเรียนทุกคนกด Ready แล้วเท่านั้น
                 </p>
              )}
           </div>
        </div>
      </main>
    </div>
  );
}
