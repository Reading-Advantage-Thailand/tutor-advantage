import React from 'react';
import { MessageCircle, MonitorUp } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LessonSessionData } from '@/hooks/useLessonSocket';
import { Chip, UserAvatar } from '@/components/mobile';
import { lessonCardClass, PhaseColumn, StatusCard } from '../PhaseBlocks';

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
  // English conversation starters (lesson content, not UI copy).
  const starters = [
    'What was this story about?',
    'Which new word do you like? Why?',
    'What is the most interesting part?',
    'What did you learn today?',
  ];

  return (
    <PhaseColumn>
      {myPair ? (
        <section className={cn(lessonCardClass, "px-[18px] pt-4 pb-[18px]")}>
          {/* The phase row above already shows the pink Users tile. */}
          <div>
            <Chip tone="brand" size="md">
              {t("interactivePlay.pairNumberPrefix")} {myPair.pairNumber}
            </Chip>
            <p className="mt-1.5 text-[15px] leading-[1.6] text-fg-muted">{t("interactivePlay.pairDescription")}</p>
          </div>
          {partners.length > 0 ? (
            <div className="mt-4 rounded-lg bg-surface-muted px-4 pt-3.5 pb-4 text-center">
              <h3 className="font-heading text-base leading-[1.45] font-semibold text-fg">
                {partners.length > 1 ? t("interactivePlay.pairPartnerGroup") : t("interactivePlay.pairPartner")}
              </h3>
              <ul className="mt-3 flex flex-wrap items-start justify-center gap-5">
                {partners.map((partner) => (
                  <li key={partner.studentId} className="flex w-24 flex-col items-center gap-2">
                    <UserAvatar src={partner.pictureUrl} name={partner.name} size="xl" ring="surface" decorative />
                    <span className="w-full text-[15px] leading-[1.45] font-semibold break-words text-fg">{partner.name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.pairInstruction")}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-surface-muted px-4 py-3 text-[15px] leading-[1.6] text-fg-muted">{t("interactivePlay.pairWaiting")}</p>
          )}
        </section>
      ) : (
        <StatusCard icon={MonitorUp} title={t("interactivePlay.pairSeeTeacherScreen")} description={t("interactivePlay.pairDescription")} mascot="calm" />
      )}

      <section className={cn(lessonCardClass, "px-[18px] pt-4 pb-[18px]")}>
        <h3 className="mb-3 font-heading text-base leading-[1.45] font-semibold text-fg">{t("interactivePlay.pairStartersTitle")}</h3>
        <ul className="flex flex-col gap-2">
          {starters.map((starter) => (
            <li key={starter} lang="en" className="flex items-start gap-2.5 rounded-lg bg-surface-muted px-3.5 py-3 text-base leading-[1.6] text-fg">
              <MessageCircle aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-fg" strokeWidth={2.4} />
              <span>{starter}</span>
            </li>
          ))}
        </ul>
      </section>
    </PhaseColumn>
  );
}
