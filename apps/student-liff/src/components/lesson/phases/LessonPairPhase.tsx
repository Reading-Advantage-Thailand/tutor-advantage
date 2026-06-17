import React from 'react';
import Image from 'next/image';

import { LessonSessionData } from '@/hooks/useLessonSocket';

interface LessonPairPhaseProps {
  devPairPreview: 0 | 1 | 2;
  sessionData: LessonSessionData | null;
  studentId: string;
  name: string;
}

export function LessonPairPhase({
  devPairPreview,
  sessionData,
  studentId,
  name
}: LessonPairPhaseProps) {
  const pairs = devPairPreview
    ? [{
        pairNumber: 1,
        members: [
          { studentId, name },
          { studentId: 'mock-partner-1', name: 'เพื่อนทดสอบ เอ' },
          ...(devPairPreview === 2 ? [{ studentId: 'mock-partner-2', name: 'เพื่อนทดสอบ บี' }] : []),
        ],
      }]
    : (sessionData?.pairs || []);
    
  const myPair = pairs.find((p) => p.members.some((m) => m.studentId === studentId));
  const partners = myPair ? myPair.members.filter((m) => m.studentId !== studentId) : [];
  const starters = [
    'What was this story about?',
    'Which new word do you like? Why?',
    'What is the most interesting part?',
    'What did you learn today?',
  ];

  return (
    <div className="phase-enter w-full max-w-sm flex flex-col gap-4 overflow-y-auto max-h-[calc(100dvh-80px)] pb-4">
      <div className="bg-rose-500/10 border-2 border-rose-500/30 rounded-3xl p-6 text-center">
        <div className="text-5xl mb-2">🗣️</div>
        <h2 className="text-xl font-black text-rose-600 dark:text-rose-400">สนทนาจับคู่</h2>
        <p className="text-muted-foreground text-sm mt-1">คุยกับคู่ของคุณเกี่ยวกับบทเรียนวันนี้</p>
      </div>

      {myPair ? (
        <div className="bg-card rounded-3xl border border-border shadow-lg p-5 text-center">
          <span className="inline-block text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-full px-3 py-1 mb-4">
            คู่ที่ {myPair.pairNumber}
          </span>
          {partners.length > 0 ? (
            <>
              <p className="text-xs font-bold text-muted-foreground mb-3">
                {partners.length > 1 ? 'คู่สนทนาของคุณ (กลุ่ม 3 คน)' : 'คู่สนทนาของคุณ'}
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {partners.map((partner) => (
                  <div key={partner.studentId} className="flex flex-col items-center gap-2">
                    <div className="size-16 rounded-full overflow-hidden border-4 border-rose-300/60 shadow-lg bg-muted">
                      <Image
                        src={partner.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.name}`}
                        alt={partner.name}
                        width={64} height={64}
                        className="size-full object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="text-sm font-black text-foreground">{partner.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-xs mt-4 leading-relaxed">
                หันไปหาคู่ของคุณ แล้วผลัดกันพูดคนละ 2-3 นาที 🤝
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">รอคุณครูจัดคู่ให้คุณ</p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border shadow-lg p-6 text-center">
          <div className="text-3xl mb-2">👀</div>
          <p className="text-muted-foreground text-sm font-medium">ดูคู่ของคุณบนจอคุณครู</p>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2.5">ประโยคชวนคุย</p>
        <div className="space-y-2">
          {starters.map((starter) => (
            <div key={starter} className="bg-muted/50 border border-border/60 rounded-xl px-3 py-2 text-sm font-medium text-foreground">
              💬 {starter}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
