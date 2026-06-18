import React from 'react';
import Image from 'next/image';
import { t } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { LessonParticipant } from '@/hooks/useLessonSocket';

interface LessonWrapUpPhaseProps {
  participants: LessonParticipant[];
  studentId: string;
}

export function LessonWrapUpPhase({ participants, studentId }: LessonWrapUpPhaseProps) {
  const router = useRouter();
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  const studentIndex = sorted.findIndex(p => p.studentId === studentId);
  const rank = studentIndex !== -1 ? studentIndex + 1 : 0;
  const score = rank > 0 ? sorted[studentIndex]?.score || 0 : 0;
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎖️';
  const rankGrad = rank === 1
    ? 'from-amber-400 to-yellow-500'
    : rank === 2
    ? 'from-slate-400 to-slate-500'
    : rank === 3
    ? 'from-orange-400 to-amber-500'
    : 'from-indigo-500 to-violet-600';
  
  let rankTitle = t("interactivePlay.greatJob");
  if (rank === 1) rankTitle = t("interactivePlay.rankFirst");
  else if (rank === 2) rankTitle = t("interactivePlay.rankSecond");
  else if (rank === 3) rankTitle = t("interactivePlay.rankThird");

  return (
    <div className="phase-enter w-full max-w-sm flex flex-col gap-4 overflow-y-auto max-h-[calc(100dvh-80px)] pb-4">
      {/* Rank hero */}
      <div className={`bg-gradient-to-br ${rankGrad} rounded-3xl p-7 text-center shadow-2xl text-white relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }} />
        <div className="relative z-10">
          <div className="text-7xl mb-3 animate-bounce" style={{ animationDuration: '1.5s' }}>{rankEmoji}</div>
          <h2 className="text-2xl font-black mb-1">{rankTitle}</h2>
          <p className="text-white/80 text-sm font-medium">อันดับ {rank > 0 ? rank : '-'} จาก {participants.length} คน</p>
        </div>
      </div>

      {/* Score */}
      <div className="bg-card rounded-3xl border border-border shadow-lg p-6 text-center">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t("interactivePlay.totalScore")}</p>
        <p className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{score}</p>
        <p className="text-muted-foreground font-medium text-sm">คะแนน</p>
      </div>

      {/* Final mini leaderboard */}
      {sorted.length > 0 && (
        <div className="bg-card rounded-3xl border border-border shadow-lg p-5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">ผลการแข่งขัน</p>
          <div className="space-y-2">
            {sorted.map((p, i) => {
              const r = i + 1;
              const isMe = p.studentId === studentId;
              const rEmoji = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;
              return (
                <div key={p.studentId || i} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${isMe ? 'bg-indigo-500/10 border-2 border-indigo-500/30' : 'bg-muted/50 border border-border'}`}>
                  <span className="w-6 text-center text-sm shrink-0">{rEmoji || `#${r}`}</span>
                  <div className="size-7 rounded-full overflow-hidden bg-muted border-2 border-border shadow-sm shrink-0 flex items-center justify-center">
                    {p.pictureUrl
                      ? <Image src={p.pictureUrl} alt={p.name} width={28} height={28} className="size-full object-cover" unoptimized />
                      : <span className="text-[9px] font-bold text-muted-foreground">{(p.name || '?').slice(0, 2)}</span>
                    }
                  </div>
                  <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                    {isMe ? 'คุณ' : p.name}
                  </span>
                  {isMe && <span className="text-[9px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full shrink-0">ME</span>}
                  <span className={`text-sm font-black tabular-nums ${isMe ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>{p.score || 0}</span>
                  <span className="text-[9px] text-muted-foreground">pts</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
        <h4 className="font-black text-emerald-600 dark:text-emerald-400 text-sm mb-1">{t("interactivePlay.lessonCompletedTitle")}</h4>
        <p className="text-emerald-600/80 dark:text-emerald-400/80 text-xs leading-relaxed">{t("interactivePlay.lessonCompletedDescription")}</p>
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all"
      >
        {t("interactivePlay.backHome")}
      </button>
    </div>
  );
}
