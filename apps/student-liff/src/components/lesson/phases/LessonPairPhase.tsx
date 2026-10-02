import React from 'react';
import { t } from '@/lib/i18n';
import { LessonSessionData } from '@/hooks/useLessonSocket';
import { LESSON_PHASE } from '@/lib/lessonPhases';
import { Chip, UserAvatar } from '@/components/mobile';
import { PhaseColumn, PhaseIntroCard, StatusCard } from '../PhaseBlocks';

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
      <PhaseIntroCard phase={LESSON_PHASE.PAIR_CONVERSATION} tip={t("interactivePlay.pairDescription")} />

      {myPair ? (
        <section className="rounded-[var(--radius-card)] border border-hairline bg-surface p-5 text-center shadow-[var(--shadow-card)]">
          <Chip tone="brand" size="md">
            {t("interactivePlay.pairNumberPrefix")} {myPair.pairNumber}
          </Chip>
          {partners.length > 0 ? (
            <>
              <p className="mt-4 text-[13px] leading-[1.5] font-semibold text-fg-muted">
                {partners.length > 1 ? t("interactivePlay.pairPartnerGroup") : t("interactivePlay.pairPartner")}
              </p>
              <ul className="mt-3 flex flex-wrap items-start justify-center gap-5">
                {partners.map((partner) => (
                  <li key={partner.studentId} className="flex w-24 flex-col items-center gap-2">
                    <UserAvatar src={partner.pictureUrl} name={partner.name} size="xl" ring="surface" decorative />
                    <span className="w-full text-[15px] leading-[1.4] font-bold break-words text-fg">{partner.name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.pairInstruction")}</p>
            </>
          ) : (
            <p className="mt-3 text-[15px] leading-[1.6] text-fg-muted">{t("interactivePlay.pairWaiting")}</p>
          )}
        </section>
      ) : (
        <StatusCard emoji="👀" title={t("interactivePlay.pairSeeTeacherScreen")} />
      )}

      <section className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-2.5 text-[15px] leading-[1.5] font-bold text-fg">{t("interactivePlay.pairStartersTitle")}</h3>
        <ul className="flex flex-col gap-2">
          {starters.map((starter) => (
            <li key={starter} lang="en" className="rounded-xl bg-fill-muted px-3 py-2.5 text-[15px] leading-[1.5] text-fg">
              <span aria-hidden="true">💬 </span>{starter}
            </li>
          ))}
        </ul>
      </section>
    </PhaseColumn>
  );
}
