"use client";

import { useEffect, useRef } from "react";
import { BookOpen, Mic } from "lucide-react";
import styles from "./guided-reading.module.css";

export type ReadingCue = { action: "offer" | "open" | "focus" | "word" | "close"; quote?: string };
export type ReadingWord = { text: string; meaning: string };

export function passageSegments(passage: string) {
  // Preserve every character, including paragraph breaks, when adding highlights.
  return passage.match(/[^.!?。！？]+[.!?。！？]*\s*|[.!?。！？]+\s*/g) || [passage];
}

export default function GuidedReading({ title, passage, quote, words, speaking, connected }: {
  title: string; passage: string; quote: string; words: ReadingWord[];
  speaking: boolean; connected: boolean;
}) {
  const activeRef = useRef<HTMLParagraphElement | null>(null);
  const segments = passageSegments(passage);
  const activeIndex = segments.findIndex((text) => quote && text.toLowerCase().includes(quote.toLowerCase()));
  const word = words.find((item) => item.text.toLowerCase() === quote.toLowerCase());
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }, [quote]);
  return <section className={styles.reader} aria-label="อ่านไปกับรีดี้">
    <header className={styles.header}><div><small><BookOpen size={14} /> READ TOGETHER</small><h2>{title}</h2><p>{connected ? "ฟังรีดี้ แล้วลองอ่านตามทีละนิด" : "รีดี้จะพาอ่านทีละส่วนเมื่อเริ่มสนทนา"}</p></div></header>
    <div className={styles.passage} aria-label="บทความเต็ม">
      {segments.map((text, index) => <p key={index} ref={index === activeIndex ? activeRef : undefined} className={`${styles.sentence} ${index === activeIndex ? styles.highlight : ""}`} aria-current={index === activeIndex ? "step" : undefined}>
        {index === activeIndex && <span className={styles.pointer} aria-hidden="true"><svg viewBox="0 0 64 52"><path d="M2 25h17v23H2z" fill="#09ad7a"/><path d="M15 26h7v21h-7z" fill="#7ae2b5"/><path d="M22 28c5-4 10-8 13-8h19c8 0 8 10 0 10H43l4 4c4 5 0 13-6 13H25c-5 0-7-5-7-10v-6z" fill="#885638" stroke="#c38a55" strokeWidth="2"/><path d="M31 34h10m-11 6h10" stroke="#623c29" strokeWidth="2" strokeLinecap="round"/></svg></span>}
        <span className={styles.sentenceNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className={styles.sentenceText}>{text}</span>
      </p>)}
    </div>
    {word && <div key={word.text} className={styles.wordCard} aria-live="polite"><small>{!connected ? "คำศัพท์ที่เลือก • เริ่มคุยเพื่อฝึกออกเสียง" : speaking ? "ฟังเสียงคำนี้" : "ตาคุณแล้ว ลองอ่านออกเสียงนะ"}</small><strong>{word.text}</strong><span>{word.meaning}</span><span className={styles.voiceHint}><Mic size={14} /> พูดว่า “อ่านอีกครั้ง” ได้เลย</span></div>}
    <footer><span>{activeIndex >= 0 ? `กำลังอ่านส่วนที่ ${activeIndex + 1} / ${segments.length}` : "รีดี้กำลังเลือกส่วนที่จะฝึก"}</span><span>ฟัง · ตอบ · อ่านตาม</span></footer>
  </section>;
}
