"use client";

import { useState } from "react";
import { BookOpen, Check, Clock, Hourglass, MessageCircleQuestion, PartyPopper, PenLine, Presentation, X } from "lucide-react";
import { ANSWER_LETTERS, AnswerTile, type AnswerLetter } from "@/components/lesson/AnswerTiles";
import { MobileLeaderboard } from "@/components/lesson/MobileLeaderboard";
import {
  AiFeedbackText,
  AiPendingCard,
  AiScore,
  AnswerEcho,
  LookAtScreenRow,
  PhaseCard,
  PhaseHeader,
  PhaseIntroCard,
  RankStrip,
  ScorePill,
  StatusCard,
  WaitingNextLine,
} from "@/components/lesson/PhaseBlocks";
import { RankBadge } from "@/components/lesson/RankBadge";
import { ResultBanner } from "@/components/lesson/ResultBanner";
import { Chip, IconButton } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { LESSON_PHASE } from "@/lib/lessonPhases";
import { Frame, Section } from "./GalleryParts";
import { LEADERBOARD, REAL_CLASS, STRESS } from "./fixtures";

/** Live-lesson components (components.md §6) with the reveal-mock data. */
export function LessonSamples() {
  const [chosen, setChosen] = useState<AnswerLetter | null>(null);
  const [score, setScore] = useState(120);
  const [bump, setBump] = useState(0);

  return (
    <>
      <Section title="Live lesson: top bar & phase" note="Score pill = the screen's one sunshine reward (reading face, tabular). Journey: done / current (jade) / upcoming.">
        <Frame label="Lesson top bar (60px, rim) + PhaseHeader">
          <div className="flex h-[60px] items-center gap-2 border-b-[1.5px] border-clay-rim bg-surface px-3">
            <IconButton icon={X} label="ออกจากห้องเรียน" />
            <div className="min-w-0 flex-1 text-center">
              <p className="font-heading text-[17px] leading-[1.35] font-semibold text-fg">ห้องเรียนสด</p>
              <p lang="en" className="truncate text-[13px] leading-[1.4] text-fg-muted">{REAL_CLASS.lessonTitle}</p>
            </div>
            <ScorePill key={bump} score={score} bump={bump > 0} />
          </div>
          <div className="space-y-3 p-4">
            <PhaseHeader phase={LESSON_PHASE.COMPREHENSION} />
            <section className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-[18px] pt-3.5 pb-4 shadow-[var(--shadow-card)]">
              <Chip tone="brand" size="md" icon={MessageCircleQuestion}>คำถาม 2/3</Chip>
              <h4 lang="en" className="mt-2.5 mb-1.5 font-heading text-[23px] leading-[1.4] font-bold text-balance text-fg">{STRESS.question}</h4>
              <p className="flex items-start gap-2 text-sm leading-[1.6] text-fg-muted">
                <Presentation aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                ดูตัวเลือกบนจอคุณครู แล้วแตะคำตอบที่ถูกต้อง
              </p>
            </section>
            <Button
              variant="brandSoft"
              size="touch"
              className="w-full"
              onClick={() => {
                setScore((value) => value + 120);
                setBump((value) => value + 1);
              }}
            >
              จำลอง +120 คะแนน (pill เด้ง)
            </Button>
          </div>
        </Frame>
      </Section>

      <Section title="Answer tiles A–D" note="Berry · ocean · sunshine · deep violet, each with a shape and its letter. Colour never says right or wrong. Tap one to see the submitted state.">
        <div role="group" aria-label="เลือกคำตอบ" className="grid grid-cols-2 gap-x-3 gap-y-4 pb-1.5">
          {ANSWER_LETTERS.map((letter) => (
            <AnswerTile
              key={letter}
              letter={letter}
              state={chosen === null ? "idle" : chosen === letter ? "chosen" : "dimmed"}
              onClick={() => setChosen(letter)}
            />
          ))}
        </div>
        {chosen ? (
          <Button variant="outline" size="touch" className="w-full" onClick={() => setChosen(null)}>
            รีเซ็ตคำตอบ
          </Button>
        ) : null}
        <RankStrip rank={2} score={120} />
      </Section>

      <Section title="Reveal: result banner, echo, leaderboard" note="Correct = success card + one sun chip + Reedy cheer. Wrong = neutral card (never red) + the correct letter.">
        <ResultBanner
          outcome="correct"
          title={
            <>
              <span className="whitespace-nowrap">ถูกต้อง!</span> <span className="whitespace-nowrap">ทำได้ดีมาก</span>
            </>
          }
          points={120}
          detail="ตอบเร็วเป็นอันดับ 2 ของห้อง"
        />
        <AnswerEcho big status={<Chip tone="success" size="md" icon={Check}>ถูกต้อง</Chip>}>B</AnswerEcho>
        <ResultBanner
          outcome="wrong"
          title={
            <>
              <span className="whitespace-nowrap">ยังไม่ถูก</span> <span className="whitespace-nowrap">ไม่เป็นไรนะ</span>
            </>
          }
          correctLetter="C"
          detail="คำตอบที่ถูกต้อง"
        />
        <MobileLeaderboard participants={[...LEADERBOARD]} studentId="me" show="focus" />
        <WaitingNextLine>รอคุณครูไปขั้นถัดไป</WaitingNextLine>
        <div className="flex flex-wrap items-center gap-3">
          <RankBadge rank={1} />
          <RankBadge rank={2} />
          <RankBadge rank={3} />
          <RankBadge rank={4} />
          <RankBadge rank={12} variant="plain" />
          <RankBadge rank={null} />
          <span className="text-[13px] text-fg-muted">RankBadge</span>
        </div>
      </Section>

      <Section title="Phase blocks">
        <PhaseIntroCard phase={LESSON_PHASE.READ_ARTICLE} icon={BookOpen} title="อ่านบทความ · ออกเสียง" tip="แตะประโยคที่อยากให้คุณครูช่วยออกเสียง" />
        <LookAtScreenRow label="ฟังคุณครูอธิบายความหมาย" tone="blue" />
        <StatusCard tone="warning" eyebrow="จบคำถามแล้ว" icon={Clock} title="แย่จัง กดตอบไม่ทัน" description="คุณครูจบคำถามนี้แล้ว รอคำถามหรือกิจกรรมถัดไปนะ" />
        <StatusCard tone="info" icon={Hourglass} title="กำลังเชื่อมต่อใหม่…" description="รอสักครู่นะ ไม่ต้องปิดหน้านี้" />
        <StatusCard tone="success" icon={PartyPopper} title="ตอบครบทุกคนแล้ว!" description="โปรดดูเฉลยที่หน้าจอคุณครู" />
        <AiPendingCard />
        <PhaseCard icon={PenLine} tone="purple" title="ผลประเมินจาก AI">
          <AiScore score={4} ring />
          <AiFeedbackText score={4}>Great job! Your answer explains how dolphins use clicks and whistles. Try adding one more detail from the story.</AiFeedbackText>
        </PhaseCard>
        <AnswerEcho>Dolphins talk with clicks and whistles.</AnswerEcho>
      </Section>
    </>
  );
}
