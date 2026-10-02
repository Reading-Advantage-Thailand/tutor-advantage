import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ReedyMood = "happy" | "oops" | "calm" | "sleepy" | "cheer";
export type ReedyMiniSize = "sm" | "md" | "lg";

export interface ReedyMiniProps {
  /** happy (default, waving) · oops (worried, errors) · calm / sleepy (empty states) · cheer (celebrating). */
  mood?: ReedyMood;
  /** sm 56px · md 88px (default) · lg 120px */
  size?: ReedyMiniSize;
  /** Gentle float (disabled for prefers-reduced-motion). */
  float?: boolean;
  /** Decorative (aria-hidden) when the surrounding text already says it all. */
  decorative?: boolean;
  /** Small round badge in the bottom-right corner, e.g. a lucide icon that keeps the screen's meaning. */
  badge?: ReactNode;
  /** Colour classes for the badge circle (e.g. iconTileToneClass[tone]). */
  badgeClassName?: string;
  className?: string;
}

const sizePx: Record<ReedyMiniSize, number> = { sm: 56, md: 88, lg: 120 };

const moodLabel: Record<ReedyMood, string> = {
  happy: "รีดี้ยิ้มและโบกมือทักทาย",
  oops: "รีดี้ทำหน้ากังวลนิดหน่อย",
  calm: "รีดี้ยิ้มอย่างสบายใจ",
  sleepy: "รีดี้กำลังงีบหลับ",
  cheer: "รีดี้ดีใจชูมือ",
};

const BROWS: Record<ReedyMood, string> = {
  happy: "M104 118q17-13 33-1M196 125q18-10 34 6",
  cheer: "M104 112q17-13 33-1M196 119q18-10 34 6",
  oops: "M103 124q18-4 33-16M197 113q16 6 34 18",
  calm: "M105 121q16-9 31-1M197 127q17-7 32 4",
  sleepy: "M106 124q15-5 29 0M198 129q15-4 30 3",
};

/**
 * Small static Reedy (head + upper body) for empty / error / status screens.
 * Same look as the voice-practice mascot, simplified; no CSS module. Server-compatible.
 */
export function ReedyMini({ mood = "happy", size = "md", float = false, decorative = false, badge, badgeClassName, className }: ReedyMiniProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fur = `url(#${id}f)`;
  const hood = `url(#${id}h)`;
  const px = sizePx[size];
  const openEyes = mood === "happy" || mood === "oops";
  const bigSmile = mood === "happy" || mood === "cheer";
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : moodLabel[mood]}
      aria-hidden={decorative ? true : undefined}
      className={cn("relative inline-block shrink-0", float && "animate-float motion-reduce:animate-none", className)}
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 8 320 322" width={px} height={px} aria-hidden="true" className="block overflow-visible">
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffd078" /><stop offset=".55" stopColor="#ff9c43" /><stop offset="1" stopColor="#ee702d" /></linearGradient>
          <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#21d597" /><stop offset=".6" stopColor="#04ac78" /><stop offset="1" stopColor="#007e60" /></linearGradient>
        </defs>
        <ellipse cx="160" cy="319" rx="83" ry="9" fill="#003d2c" opacity=".15" />
        {/* Arms behind the body */}
        {mood === "happy" && (
          <g>
            <path d="M108 236Q80 264 54 248Q28 234 22 202L46 195Q54 222 89 219Z" fill={hood} />
            <path d="M22 207Q9 193 12 177Q14 165 25 163Q37 160 43 174L47 195Q45 207 34 210Z" fill="#704731" stroke="#b97741" strokeWidth="2" />
          </g>
        )}
        {mood === "cheer" && (
          <g strokeLinecap="round" fill="none" stroke={hood} strokeWidth="29">
            <path d="M107 246Q52 246 27 124" /><path d="M220 246Q270 228 297 126" />
            <ellipse cx="26" cy="115" rx="16" ry="21" fill="#71452f" stroke="none" /><ellipse cx="299" cy="117" rx="16" ry="21" fill="#71452f" stroke="none" />
          </g>
        )}
        {/* Hoodie body */}
        <path d="M111 219Q84 236 86 308Q155 334 233 307L224 247Q210 220 191 216Z" fill={hood} />
        <path d="M107 231Q159 259 209 229L198 215H121Z" fill="#008a64" stroke="#06976a" strokeWidth="3" />
        <path d="M118 238l-6 40m80-40 5 36" stroke="#8ae6bd" strokeWidth="5" strokeLinecap="round" />
        <text x="156" y="289" fill="#c6f6dd" fontSize="36" fontWeight="900" fontFamily="Arial,sans-serif" transform="rotate(6 156 289)">R</text>
        {mood !== "cheer" && <g><path d="M220 239q33 4 35 42q-3 21-24 8l-20-31" fill={hood} /><ellipse cx="249" cy="278" rx="16" ry="20" fill="#71452f" /></g>}
        {(mood === "calm" || mood === "sleepy") && <g><path d="M105 243Q79 267 113 289" fill="none" stroke={hood} strokeWidth="26" strokeLinecap="round" /><ellipse cx="119" cy="285" rx="19" ry="12" fill="#71452f" /></g>}
        {/* Head */}
        <path d="M66 101 64 24Q65 17 72 24l55 49M228 84l54-22q10-4 6 7l-26 65" fill={fur} stroke="#cb632a" strokeWidth="4" strokeLinejoin="round" />
        <path d="m75 40 4 55 34-18Z M274 77l-37 15 22 26Z" fill="#ffdfb1" />
        <path d="M49 135C48 69 108 51 171 56s107 39 109 98c3 68-47 97-111 95S48 207 49 135" fill={fur} stroke="#e47e33" strokeWidth="3" />
        <path d="M52 167l26-14 23 13q17-42 60-38t65 42l23-9 29 21q-16 66-107 61-89-2-119-76" fill="#fff1d9" />
        <ellipse cx="77" cy="160" rx="16" ry="11" fill="#ffb196" opacity=".65" /><ellipse cx="248" cy="171" rx="16" ry="11" fill="#ffb196" opacity=".7" />
        <path d={BROWS[mood]} stroke="#a55530" strokeWidth="6" strokeLinecap="round" fill="none" />
        {openEyes ? (
          <g>
            <ellipse cx="123" cy="145" rx="10" ry={mood === "oops" ? 15 : 14} fill="#20251f" /><ellipse cx="208" cy="153" rx="10" ry={mood === "oops" ? 15 : 14} fill="#20251f" />
            <circle cx="120" cy="140" r="4" fill="#fff" /><circle cx="205" cy="148" r="4" fill="#fff" />
          </g>
        ) : (
          <path
            d={mood === "cheer" ? "M113 149q10-15 19 0m66 6q10-15 19 1" : mood === "calm" ? "M112 144q10 10 21 0m65 8q10 10 21 0" : "M112 147h21m65 6h21"}
            stroke="#30231c" strokeWidth="6" fill="none" strokeLinecap="round"
          />
        )}
        <path d="m163 168-13 11 15 9 13-7Z" fill="#643b2c" />
        {bigSmile ? (
          <g><path d="M138 196q27 15 51 5-6 31-28 28-18-3-23-33" fill="#612c24" /><path d="M145 198q21 10 38 5l-4 6q-19 2-31-5Z" fill="#fffdf1" /><path d="M151 219q14-9 26 1-13 13-26-1" fill="#ef7273" /></g>
        ) : mood === "oops" ? (
          <path d="M146 208q8-8 16 0t16 0" fill="none" stroke="#713a2b" strokeWidth="4" strokeLinecap="round" />
        ) : (
          <path d={mood === "calm" ? "M150 202q13 13 26 0" : "M154 205q9 4 17 0"} fill="none" stroke="#713a2b" strokeWidth="4" strokeLinecap="round" />
        )}
        <g stroke="#865134" strokeWidth="2.5" strokeLinecap="round" opacity=".8"><path d="m80 179-35-4m34 13-31 7m194-6 31 10m-32 0 27 15" /></g>
        {/* Headphones */}
        <path d="M39 157C31 27 293 18 292 174" fill="none" stroke="#0c5847" strokeWidth="15" strokeLinecap="round" />
        <g transform="rotate(10 40 162)"><rect x="25" y="130" width="29" height="66" rx="13" fill="#12604e" /><rect x="28" y="135" width="18" height="52" rx="9" fill="#73ebbf" /></g>
        <g transform="rotate(13 280 185)"><rect x="268" y="154" width="29" height="65" rx="13" fill="#12604e" /><rect x="274" y="159" width="18" height="52" rx="9" fill="#73ebbf" /></g>
        {/* Mood extras */}
        {mood === "oops" && <path d="M270 88q-13 20 0 26 13-6 0-26" fill="#8fd3ff" stroke="#4fa8e0" strokeWidth="2" />}
        {mood === "sleepy" && <g fill="#5fbfa0" fontFamily="Arial,sans-serif" fontWeight="900"><text x="262" y="70" fontSize="34">z</text><text x="290" y="42" fontSize="24">z</text></g>}
        {mood === "cheer" && <g strokeWidth="6" strokeLinecap="round"><path d="m16 60 6 10m274-44-6 9" stroke="#ffc94a" /><path d="m8 95-6 4m298-40 7 7" stroke="#ff8cab" /><path d="m40 40 4-8m262 19 7 2" stroke="#3fd3a4" /></g>}
        {mood === "calm" && <path d="M290 104c-9-10-18 3 0 13 18-10 9-23 0-13" fill="#ff809e" />}
      </svg>
      {badge ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-1 bottom-0 inline-flex size-[38%] items-center justify-center rounded-full bg-surface ring-[3px] ring-surface shadow-[var(--shadow-card)] [&>svg]:size-[55%]",
            badgeClassName,
          )}
        >
          {badge}
        </span>
      ) : null}
    </span>
  );
}
