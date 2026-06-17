import React from 'react';
import Image from 'next/image';

interface Participant {
  studentId: string;
  name: string;
  pictureUrl?: string;
  score?: number;
}

export function MobileLeaderboard({ participants, studentId }: {
  participants: Participant[];
  studentId: string;
}) {
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  const myRank = sorted.findIndex(p => p.studentId === studentId) + 1;
  if (sorted.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Live Leaderboard</span>
        </div>
        {myRank > 0 && (
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            คุณ #{myRank}
          </span>
        )}
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {sorted.map((p, i) => {
          const rank = i + 1;
          const isMe = p.studentId === studentId;
          const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
          return (
            <div key={p.studentId || i} className={[
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 border-2 transition-all duration-300',
              isMe
                ? 'border-indigo-400/60 bg-indigo-500/10'
                : rank === 1
                  ? 'border-amber-400/40 bg-amber-500/10'
                  : 'border-border bg-card',
            ].join(' ')}>
              <div className="w-6 text-center shrink-0">
                {rankEmoji
                  ? <span className="text-base leading-none">{rankEmoji}</span>
                  : <span className="text-[10px] font-black text-muted-foreground">#{rank}</span>
                }
              </div>
              <div className="size-8 rounded-full overflow-hidden border-2 border-border shadow-sm shrink-0 bg-muted flex items-center justify-center">
                {p.pictureUrl
                  ? <Image src={p.pictureUrl} alt={p.name} width={32} height={32} className="size-full object-cover" unoptimized />
                  : <span className="text-[9px] font-black text-muted-foreground">{(p.name || '?').slice(0, 2)}</span>
                }
              </div>
              <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                {isMe ? 'คุณ' : p.name}
              </span>
              {isMe && <span className="text-[9px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full shrink-0">ME</span>}
              <div className="text-right shrink-0">
                <p className={`text-sm font-black tabular-nums ${isMe ? 'text-indigo-600 dark:text-indigo-400' : rank <= 3 ? 'text-amber-500' : 'text-foreground'}`}>
                  {p.score || 0}
                </p>
                <p className="text-[9px] text-muted-foreground leading-none">pts</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
