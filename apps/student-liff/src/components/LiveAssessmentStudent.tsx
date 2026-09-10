"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Headphones,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import type { LiveAssessmentState } from "@tutor-advantage/shared-config";

const skills = {
  vocabulary: "คำศัพท์",
  reading: "อ่านจับใจความ",
  listening: "ฟังเข้าใจ",
};

const skillIcons = {
  vocabulary: "Aa",
  reading: "⌁",
  listening: "♪",
};

type LiveAssessmentStudentProps = {
  state: LiveAssessmentState;
  busy: boolean;
  error: string;
  onAnswer: (questionId: string, choice: number) => Promise<boolean>;
  lessonName?: string;
  tutorName?: string;
};

function AssessmentNotice({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="assessment-notice" aria-live="polite">
      <div className="assessment-notice-icon">{icon}</div>
      <p className="assessment-notice-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <div className="assessment-notice-copy">{children}</div>
    </section>
  );
}

export default function LiveAssessmentStudent({
  state,
  busy,
  error,
  onAnswer,
  lessonName,
  tutorName,
}: LiveAssessmentStudentProps) {
  const total = state.items.length || 15;
  const [index, setIndex] = useState(() => {
    const firstUnanswered = state.items.findIndex((question) => state.answers[question.id] === undefined);
    return Math.max(0, firstUnanswered);
  });
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [audioError, setAudioError] = useState(false);
  const item = state.items[index];
  const count = Object.keys(state.answers).length;
  const choice = item ? choices[item.id] ?? state.answers[item.id] : undefined;
  const waiting = state.completed || (state.items.length > 0 && count >= total);
  const phaseLabel = state.mode === "PRE" ? "แบบทดสอบก่อนเรียน" : "แบบทดสอบหลังเรียน";
  const phaseHint = state.mode === "PRE" ? "เริ่มต้นเส้นทางการเรียนรู้" : "ทบทวนสิ่งที่ได้เรียนรู้";
  const progress = Math.min(count, total);

  const moveTo = (nextIndex: number) => {
    setIndex(nextIndex);
    setAudioError(false);
  };

  return (
    <section className="live-assessment" aria-label={phaseLabel}>
      <header className="assessment-header">
        <div className="assessment-header-inner">
          <div className="assessment-brand">
            <span className="assessment-brand-icon" aria-hidden="true">
              <BookOpen size={19} strokeWidth={2.5} />
            </span>
            <div>
              <p className="assessment-kicker">{state.articleTitle || "แบบประเมินประจำบท"}</p>
              <p className="assessment-context">{lessonName || "ห้องเรียนออนไลน์"}{tutorName ? ` · ครู ${tutorName}` : ""}</p>
            </div>
          </div>
          <div className={`assessment-phase assessment-phase-${state.mode.toLowerCase()}`}>
            {state.mode === "PRE" ? "PRE-TEST" : "POST-TEST"}
          </div>
        </div>

        <div className="assessment-header-inner assessment-title-row">
          <div>
            <p className="assessment-phase-label">{phaseLabel}</p>
            <h1>{state.status === "LOBBY" ? "เตรียมตัวให้พร้อม" : state.status === "FINISHED" ? "แบบทดสอบสิ้นสุดแล้ว" : waiting ? "บันทึกคำตอบเรียบร้อย" : "ทำแบบทดสอบตามจังหวะของคุณ"}</h1>
            <p>{phaseHint}</p>
          </div>
          <div className="assessment-count" aria-label={`ตอบแล้ว ${progress} จาก ${total} ข้อ`}>
            <strong>{progress}</strong>
            <span>/{total}<br />ข้อ</span>
          </div>
        </div>

        <div className="assessment-progress-wrap" aria-hidden="true">
          <span className="assessment-progress-bar" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
      </header>

      <main className="assessment-main">
        {error && (
          <div className="assessment-alert" role="alert">
            <AlertCircle size={19} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {state.paused && (
          <div className="assessment-paused" role="status">
            <span className="assessment-paused-dot" aria-hidden="true" />
            การเชื่อมต่อห้องเรียนกำลังพักอยู่ คำตอบที่บันทึกแล้วจะยังอยู่
          </div>
        )}

        {state.status === "LOBBY" && (
          <AssessmentNotice
            icon={<Loader2 className="animate-spin" size={31} aria-hidden="true" />}
            eyebrow="กำลังรอคุณครู"
            title="รอครูเริ่มแบบทดสอบ"
          >
            <p>เตรียมเปิดเสียงและอยู่ในหน้านี้ไว้ เมื่อครูเริ่ม คุณจะเห็นข้อสอบทันที</p>
            <div className="assessment-notice-tip"><Headphones size={18} aria-hidden="true" /> ใช้หูฟังเพื่อฟังโจทย์ได้ชัดเจนขึ้น</div>
          </AssessmentNotice>
        )}

        {state.status === "FINISHED" && (
          <AssessmentNotice
            icon={state.completed ? <CheckCircle2 size={34} aria-hidden="true" /> : <LockKeyhole size={31} aria-hidden="true" />}
            eyebrow={state.completed ? "บันทึกเรียบร้อย" : "แบบทดสอบปิดแล้ว"}
            title={state.completed ? "ครูจะสรุปผลให้เร็ว ๆ นี้" : "ยังตอบไม่ครบทุกข้อ"}
          >
            <p>{state.completed ? "ดูคะแนนและคำแนะนำได้ที่หน้าความคืบหน้า หลังจากครูสรุปผล" : `บันทึกไว้ ${count}/${total} ข้อ จึงยังไม่สร้างคะแนน กรุณาติดต่อคุณครู`}</p>
            <p>รอครูเลือกกิจกรรมถัดไปในห้องเดิม</p>
          </AssessmentNotice>
        )}

        {state.status === "RUNNING" && waiting && (
          <AssessmentNotice
            icon={<CheckCircle2 size={34} aria-hidden="true" />}
            eyebrow="ตอบครบแล้ว"
            title={state.completed ? "มีผลการประเมินของคุณแล้ว" : "ส่งคำตอบครบทุกข้อแล้ว"}
          >
            <p>{state.completed ? "แบบประเมินนี้มีผลแล้ว จึงไม่ต้องทำซ้ำ" : "รอครูจบการประเมินเพื่อสรุปผล อย่าเพิ่งออกจากห้องเรียน"}</p>
          </AssessmentNotice>
        )}

        {state.status === "RUNNING" && !waiting && item && (
          <div className={`assessment-question-layout${item.passage || item.audioUrl ? "" : " assessment-question-layout-single"}`}>
            <article className="assessment-question-card">
              <div className="assessment-question-topline">
                <span>ข้อ {index + 1}/{total}</span>
                <span className={`assessment-skill assessment-skill-${item.skill}`}>
                  <b aria-hidden="true">{skillIcons[item.skill]}</b>{skills[item.skill]}
                </span>
              </div>

              <fieldset className="assessment-options" disabled={busy || state.paused}>
                <legend lang="en">{item.prompt}</legend>
                <p className="assessment-answer-instruction">เลือกคำตอบที่ถูกต้องที่สุดเพียง 1 ข้อ</p>
                <div className="assessment-option-list">
                  {item.options.map((option, value) => {
                    const selected = choice === value;
                    return (
                      <label className={`assessment-option${selected ? " is-selected" : ""}`} key={value}>
                        <input
                          type="radio"
                          name={item.id}
                          checked={selected}
                          onChange={() => setChoices((previous) => ({ ...previous, [item.id]: value }))}
                        />
                        <span className="assessment-option-letter" aria-hidden="true">{String.fromCharCode(65 + value)}</span>
                        <span lang="en">{option}</span>
                        <CheckCircle2 className="assessment-option-check" size={20} aria-hidden="true" />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </article>

            {(item.passage || item.audioUrl) && (
              <aside className="assessment-support" aria-label="สื่อประกอบคำถาม">
                {item.passage && (
                <section className="assessment-passage" lang="en">
                  <p className="assessment-support-label">READ THIS FIRST</p>
                  <p>{item.passage}</p>
                </section>
                )}
                {item.audioUrl && (
                <section className="assessment-audio">
                  <div>
                    <p className="assessment-support-label">LISTENING</p>
                    <p>ฟังก่อนตอบ สามารถเปิดฟังซ้ำได้</p>
                  </div>
                  <audio key={item.id} controls preload="none" src={item.audioUrl} onError={() => setAudioError(true)} />
                  {audioError && <p className="assessment-audio-error" role="alert">โหลดเสียงไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่</p>}
                </section>
                )}
              </aside>
            )}

            <nav className="assessment-actions" aria-label="การนำทางข้อสอบ">
              <button className="btn btn-secondary assessment-back-button" disabled={busy || index === 0} onClick={() => moveTo(index - 1)}>
                ย้อนกลับ
              </button>
              <button
                className="btn btn-primary assessment-next-button"
                disabled={busy || state.paused || choice === undefined}
                onClick={async () => {
                  if (choice !== undefined && await onAnswer(item.id, choice)) {
                    if (index < total - 1) moveTo(index + 1);
                    else setAudioError(false);
                  }
                }}
              >
                {busy ? "กำลังบันทึก…" : index === total - 1 ? "ส่งคำตอบข้อสุดท้าย" : "บันทึกและไปข้อถัดไป"}
              </button>
              <p>คำตอบจะถูกบันทึกเมื่อกดปุ่มด้านขวา</p>
            </nav>
          </div>
        )}

        {state.status === "RUNNING" && !waiting && !item && (
          <AssessmentNotice icon={<Loader2 className="animate-spin" size={31} aria-hidden="true" />} eyebrow="กำลังเตรียมข้อสอบ" title="รอสักครู่">
            <p>กำลังโหลดข้อสอบสำหรับแบบประเมินนี้</p>
          </AssessmentNotice>
        )}
      </main>
    </section>
  );
}
