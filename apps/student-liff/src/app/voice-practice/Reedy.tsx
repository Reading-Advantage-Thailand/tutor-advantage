"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { REEDY_POSES, REEDY_PREVIEW_EVENT } from "@/lib/reedy-preview";
import styles from "./reedy.module.css";

export type ReedyState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "muted" | "celebrating" | "reassuring";

export default function Reedy({ state: liveState, level }: { state: ReedyState; level: number }) {
  const [preview, setPreview] = useState<ReedyState | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const handlePreview = (event: Event) => {
      const value: unknown = (event as CustomEvent).detail;
      if (value === null || REEDY_POSES.some(([pose]) => pose === value)) {
        setPreview(value as ReedyState | null);
        setPreviewRevision((revision) => revision + 1);
      }
    };
    window.addEventListener(REEDY_PREVIEW_EVENT, handlePreview);
    return () => window.removeEventListener(REEDY_PREVIEW_EVENT, handlePreview);
  }, []);
  const state = preview || liveState;
  const id = useId().replace(/:/g, "");
  const happy = state === "celebrating";
  const thoughtful = state === "thinking";
  const listening = state === "listening";
  const reassuring = state === "reassuring";
  const resting = state === "muted";
  return <div className={styles.scene} data-state={state} style={{ "--level": Math.min(1, Math.max(0, level)) } as CSSProperties} role="img" aria-label={`รีดี้ ${ { idle: "ยิ้มและโบกมือทักทาย", connecting: "กำลังรอเชื่อมต่อ", listening: "ตั้งใจฟัง", thinking: "กำลังคิด", speaking: "กำลังพูด", muted: "พักฟัง", celebrating: "ดีใจกับการฝึกของคุณ", reassuring: "ให้กำลังใจ" }[state]}`}>
    <div className={styles.halo}/><span className={styles.star}>✦</span><span className={styles.starTwo}>✦</span>
    <span className={styles.encouragement}>{happy ? "เก่งมากเลย! ♥" : thoughtful ? "ขอคิดนิดนึง…" : listening ? "ฟังอยู่ เล่าต่อได้เลย ♡" : reassuring ? "ทำได้แน่นอน! ♥" : resting ? "พักได้เลย ♡" : state === "connecting" ? "กำลังมาหานะ…" : state === "speaking" ? "มาลองด้วยกันนะ!" : "Hello! สวัสดี ♡"}</span>
    <svg key={`${previewRevision}-${state}`} className={styles.character} viewBox="0 0 320 330" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}fur`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffd078"/><stop offset=".55" stopColor="#ff9c43"/><stop offset="1" stopColor="#ee702d"/></linearGradient>
        <linearGradient id={`${id}hood`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#21d597"/><stop offset=".6" stopColor="#04ac78"/><stop offset="1" stopColor="#007e60"/></linearGradient>
      </defs>
      <ellipse cx="160" cy="319" rx="83" ry="9" fill="#003d2c" opacity=".15"/>
      <g className={styles.body}>
        {state === "idle" && <g className={styles.waveArm}>
          <path d="M108 236Q80 264 54 248Q28 234 22 202L46 195Q54 222 89 219Z" fill={`url(#${id}hood)`}/>
          <path d="M22 207Q9 193 12 177Q14 165 25 163Q37 160 43 174L47 195Q45 207 34 210Z" fill="#704731" stroke="#b97741" strokeWidth="2"/>
          <path d="m22 203 23-7" stroke="#78dfb0" strokeWidth="5" strokeLinecap="round"/>
        </g>}
        {happy && <g className={styles.victoryArms} fill={`url(#${id}hood)`} strokeLinecap="round">
          <path d="M107 246Q52 246 27 124" fill="none" stroke={`url(#${id}hood)`} strokeWidth="29"/>
          <path d="M220 246Q270 228 297 126" fill="none" stroke={`url(#${id}hood)`} strokeWidth="29"/>
          <ellipse cx="26" cy="115" rx="16" ry="21" fill="#71452f"/><ellipse cx="299" cy="117" rx="16" ry="21" fill="#71452f"/>
        </g>}
        {listening && <path d="M103 245Q36 260 28 188" fill="none" stroke={`url(#${id}hood)`} strokeWidth="29" strokeLinecap="round"/>}
        <path d="M111 219Q84 236 86 308Q155 334 233 307L224 247Q210 220 191 216Z" fill={`url(#${id}hood)`}/>
        <path d="M107 231Q159 259 209 229L198 215H121Z" fill="#008a64" stroke="#06976a" strokeWidth="3"/>
        <path d="M118 238l-6 40m80-40 5 36" stroke="#8ae6bd" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="112" cy="280" r="4" fill="#a8efce"/><circle cx="197" cy="276" r="4" fill="#a8efce"/>
        <path d="M119 292q40 13 76 0l-4 19q-36 10-67-1Z" fill="#059469" opacity=".6"/>
        <text x="156" y="289" fill="#c6f6dd" fontSize="36" fontWeight="900" fontFamily="Arial,sans-serif" transform="rotate(6 156 289)">R</text>
        {!happy && !reassuring && state !== "speaking" && <g className={styles.rightArm}><path d="M220 239q33 4 35 42q-3 21-24 8l-20-31" fill={`url(#${id}hood)`}/><ellipse cx="249" cy="278" rx="16" ry="20" fill="#71452f"/></g>}
        {(resting || state === "connecting") && <g fill="#71452f"><path d="M105 243Q79 267 113 289" fill="none" stroke={`url(#${id}hood)`} strokeWidth="26" strokeLinecap="round"/><ellipse cx="119" cy="285" rx="19" ry="12"/></g>}
      </g>
      {/* Keep the entire gesturing arm behind the head so the shoulder cannot cover the cheek. */}
      {reassuring && <g className={styles.supportArm}><path d="M217 260Q258 292 287 247" fill="none" stroke={`url(#${id}hood)`} strokeWidth="25" strokeLinecap="round"/><path d="M279 252v-24l9-23q4-10 10-3 4 7-2 23h15q10 2 7 12l-5 19h-27Z" fill="#71452f" stroke="#b97741" strokeWidth="2"/></g>}
      {state === "speaking" && <g className={styles.explainArm}><path d="M218 261Q255 297 294 271" fill="none" stroke={`url(#${id}hood)`} strokeWidth="25" strokeLinecap="round"/><path d="M282 272q-14-17-7-20l14 9 19-8q16-4 15 7-7 19-29 21Z" fill="#71452f"/></g>}
      <g className={styles.head}>
        <path d="M66 101 64 24Q65 17 72 24l55 49M228 84l54-22q10-4 6 7l-26 65" fill={`url(#${id}fur)`} stroke="#cb632a" strokeWidth="4" strokeLinejoin="round"/>
        <path d="m75 40 4 55 34-18Z M274 77l-37 15 22 26Z" fill="#ffdfb1"/><path d="m83 56 3 24 15-5m161 13-13 6 7 12" fill="#fff1d4"/>
        <path d="M49 135C48 69 108 51 171 56s107 39 109 98c3 68-47 97-111 95S48 207 49 135" fill={`url(#${id}fur)`} stroke="#e47e33" strokeWidth="3"/>
        <path d="M52 167l26-14 23 13q17-42 60-38t65 42l23-9 29 21q-16 66-107 61-89-2-119-76" fill="#fff1d9"/>
        <ellipse cx="77" cy="160" rx="16" ry="11" fill="#ffb196" opacity=".65"/><ellipse cx="248" cy="171" rx="16" ry="11" fill="#ffb196" opacity=".7"/>
        <g className={styles.brows} stroke="#a55530" strokeWidth="6" strokeLinecap="round" fill="none"><path d={thoughtful ? "M104 120l28-9" : listening ? "M103 109q17-10 33 0" : "M104 118q17-13 33-1"}/><path d={thoughtful ? "M198 116q18-15 33 0" : listening ? "M196 116q18-10 34 1" : "M196 125q18-10 34 6"}/></g>
        <g className={styles.eyes}>
          {happy || resting ? <g stroke="#30231c" strokeWidth="6" fill="none" strokeLinecap="round"><path d={resting ? "M112 144q10 10 21 0m65 8q10 10 21 0" : "M113 149q10-15 19 0m66 6q10-15 19 1"}/></g> : <><ellipse cx={thoughtful ? 130 : 123} cy={thoughtful ? 137 : 145} rx="10" ry={listening ? 18 : 14} fill="#20251f"/>{reassuring ? <path d="M199 154q9-12 19 0" fill="none" stroke="#30231c" strokeWidth="5" strokeLinecap="round"/> : <ellipse cx={thoughtful ? 215 : 208} cy={thoughtful ? 145 : 153} rx="10" ry={listening ? 18 : 14} fill="#20251f"/>}<circle cx={thoughtful ? 127 : 120} cy={thoughtful ? 132 : 140} r="4" fill="white"/>{!reassuring && <circle cx={thoughtful ? 212 : 205} cy={thoughtful ? 140 : 148} r="4" fill="white"/>}</>}
        </g>
        <path d="m163 168-13 11 15 9 13-7Z" fill="#643b2c"/>
        {thoughtful || resting || listening || state === "connecting" ? <path d={listening ? "M150 202q13 13 26 0" : "M150 205q13 5 23-1"} fill="none" stroke="#713a2b" strokeWidth="4" strokeLinecap="round"/> : <g className={styles.mouth}><path d="M138 196q27 15 51 5-6 31-28 28-18-3-23-33" fill="#612c24"/><path d="M145 198q21 10 38 5l-4 6q-19 2-31-5Z" fill="#fffdf1"/><path d="M151 219q14-9 26 1-13 13-26-1" fill="#ef7273"/></g>}
        <g stroke="#865134" strokeWidth="2.5" strokeLinecap="round" opacity=".8"><path d="m80 179-35-4m34 13-31 7m194-6 31 10m-32 0 27 15"/></g>
        <path d="M39 157C31 27 293 18 292 174" fill="none" stroke="#0c5847" strokeWidth="15" strokeLinecap="round"/><path d="M39 143C44 35 275 30 290 157" fill="none" stroke="#168269" strokeWidth="3"/>
        <g transform="rotate(10 40 162)"><rect x="25" y="130" width="29" height="66" rx="13" fill="#12604e"/><rect x="28" y="135" width="18" height="52" rx="9" fill="#73ebbf"/></g>
        <g transform="rotate(13 280 185)"><rect x="268" y="154" width="29" height="65" rx="13" fill="#12604e"/><rect x="274" y="159" width="18" height="52" rx="9" fill="#73ebbf"/></g>
      </g>
      {listening && <g className={styles.cuppedHand}><path d="M20 201Q7 180 19 161Q25 153 29 160L27 173Q32 151 38 157L36 180Q47 171 49 179L40 201Z" fill="#71452f" stroke="#b97741" strokeWidth="2"/><path d="M4 144q-14 30 0 56m-10-65q-20 40 0 75" fill="none" stroke="#63e8b1" strokeWidth="3" strokeLinecap="round" className={styles.listenLines}/></g>}
      {thoughtful && <g className={styles.chinHand}><path d="M102 250Q103 287 143 263L160 235" fill="none" stroke={`url(#${id}hood)`} strokeWidth="25" strokeLinecap="round"/><path d="M147 245q-8-13 0-23l17-10q9-4 11 3l-13 12 18-2q11 2 5 11l-20 12Z" fill="#71452f"/><text x="244" y="50" fill="#e8cd89" fontSize="35" fontWeight="bold" className={styles.thoughtMark}>?</text></g>}
      {reassuring && <path className={styles.heart} d="M311 155c-24-25-45 6 0 32 45-26 24-57 0-32" fill="#ff809e"/>}
      {state === "speaking" && <g fill="#79e7c2" className={styles.speechDots}><circle cx="271" cy="92" r="5"/><circle cx="289" cy="92" r="5"/><circle cx="307" cy="92" r="5"/></g>}
      {state === "connecting" && <g className={styles.connectionDots} fill="#8ce9cf"><circle cx="125" cy="267" r="5"/><circle cx="146" cy="267" r="5"/><circle cx="167" cy="267" r="5"/></g>}
      {happy && <g className={styles.confetti} strokeWidth="5" strokeLinecap="round"><path d="m16 60 6 10m274-44-6 9" stroke="#ffe08b"/><path d="m8 95-6 4m298-40 7 7" stroke="#ff8cab"/><path d="m40 40 4-8m262 19 7 2" stroke="#83eccc"/></g>}
    </svg>
    {preview && <span className={styles.previewLabel}>DEV · {REEDY_POSES.find(([pose]) => pose === preview)?.[1]}</span>}
  </div>;
}
