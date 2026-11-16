/**
 * Pure helpers for <UserAvatar> (no React; unit-tested).
 */

const THAI_CONSONANT = /[ก-ฮ]/; // ก … ฮ (ฤ ฦ included)
const THAI_CHAR = /[฀-๿]/;
/** Starts with a letter (Thai, Latin or any other script); not a digit, mark, symbol or punctuation. */
const STARTS_WITH_LETTER = /^\p{L}/u;
/** Emoji glued to the front of a word in a display name ("🌸Ploy", "✨มายด์✨"), with skin-tone modifiers, ZWJ and VS16. */
const LEADING_EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]+/u;
/** The first run of letters anywhere in a string (Thai vowel and tone marks included). */
const LETTER_RUN = /\p{L}[\p{L}\p{M}]*/u;

/**
 * Initials for an avatar fallback (components.md §5).
 * - Emoji glued to the front of a word are dropped ("🌸Ploy Smith" → "PS").
 * - Then only words that start with a letter count: punctuation, digits and
 *   symbols are skipped ("English · Primary Origins 2 (A0)" → "EO", not "E(").
 * - If that leaves no word but the name has letters behind punctuation or a
 *   symbol ("(Ploy)", "@john", "\"Mai\""), the first run of letters is used.
 * - Thai names: ONE character, the first consonant of the first word, so a
 *   leading vowel (เ แ โ ใ ไ), vowel marks and tone marks are left out
 *   ("ใบเตย" → "บ", "เอก" → "อ", "ต้นกล้า" → "ต", "สมชาย ใจดี" → "ส");
 *   two Thai initials read badly.
 * - Other scripts: first letters of the first and last words, uppercased
 *   ("John Smith" → "JS", "mai" → "M").
 * - Empty, or no letter at all → "?".
 */
export function getInitials(name: string | null | undefined): string {
  const text = (name ?? "").trim();
  const words = text
    .split(/\s+/)
    .map((word) => word.replace(LEADING_EMOJI, ""))
    .filter((word) => STARTS_WITH_LETTER.test(word));
  if (words.length === 0) {
    const run = text.match(LETTER_RUN)?.[0];
    if (!run) return "?";
    words.push(run);
  }
  const first = words[0];

  if (THAI_CHAR.test(first[0] ?? "")) {
    const chars = Array.from(first);
    return chars.find((char) => THAI_CONSONANT.test(char)) ?? chars[0];
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
