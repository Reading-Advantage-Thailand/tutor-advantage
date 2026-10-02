/**
 * Pure helpers for <UserAvatar> (no React; unit-tested).
 */

const THAI_LEADING_VOWEL = /[เ-ไ]/; // เ แ โ ใ ไ
const THAI_SYLLABLE_START = /^[เ-ไ]?[ก-ฮ][ัิ-ฺ็-๎]*/;
const THAI_CHAR = /[฀-๿]/;

/**
 * Initials for an avatar fallback.
 * - Thai names: the first written syllable start, keeping a leading vowel with
 *   its consonant ("เอก" → "เอ", "ไอซ์" → "ไอ", "สมชาย ใจดี" → "ส").
 * - Other scripts: first letters of the first and last words, uppercased
 *   ("John Smith" → "JS", "mai" → "M").
 * - Empty/whitespace → "?".
 */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0];

  if (THAI_CHAR.test(first[0] ?? "")) {
    const match = first.match(THAI_SYLLABLE_START);
    if (match) return match[0].replace(/[่-์]/g, ""); // drop tone marks
    const chars = Array.from(first);
    return THAI_LEADING_VOWEL.test(chars[0]) && chars[1] ? chars[0] + chars[1] : chars[0];
  }

  const firstChar = Array.from(first)[0] ?? "?";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (firstChar + (last && !THAI_CHAR.test(last) ? last : "")).toLocaleUpperCase();
}

/** Tones used for the deterministic avatar background (IconTile tones). */
export const AVATAR_TONES = ["brand", "blue", "purple", "pink", "amber", "red"] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

/** Stable tone for a name (same name → same colour on every device). */
export function getAvatarTone(seed: string | null | undefined): AvatarTone {
  const text = (seed ?? "").trim();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}
