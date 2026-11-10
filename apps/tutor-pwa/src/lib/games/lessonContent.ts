/**
 * Turns a lesson's article into the word and sentence lists the games play.
 * Used by the student runtime and the tutor's demos, so both see the same content.
 *
 * Nothing here invents content. A word with no meaning of its own is dropped
 * (showing "alpha" as the answer to "alpha" is a free point), and a lesson with
 * too little to play stays too little: see hasUsableVocabulary.
 */

import { countDistinctMeanings, normalizeMeaning } from "@/lib/games/pickDecoys";
import { countSentenceWords } from "@/lib/games/sentenceRound";
import type { VocabularyItem } from "@/store/useGameStore";

type ArticleWord = {
  id?: string;
  vocabulary?: string;
  word?: string;
  text?: string;
  translation?: string;
  meaning?: string;
  definition?: { th?: string; en?: string };
  audioUrl?: string;
  audio_url?: string;
};

type ArticleSentence =
  | string
  | {
      id?: string;
      sentences?: string;
      sentence?: string;
      text?: string;
      translation?: string;
      meaning?: string;
      audioUrl?: string;
      audio_url?: string;
    };

export type LessonArticle = {
  words?: ArticleWord[] | null;
  sentences?: ArticleSentence[] | null;
  /** Thai by sentence: `th[i]` is sentence i. Stored on about 1 lesson article in 9. */
  translated_passage?: { th?: unknown } | null;
};

const THAI_LETTER = /[฀-๿]/;

export const hasThaiText = (text: string | null | undefined) => THAI_LETTER.test(text ?? "");

const clean = (text: unknown) => (typeof text === "string" ? text.trim() : "");

export function buildLessonVocabulary(article?: LessonArticle | null): VocabularyItem[] {
  // A word listed twice could never be answered twice, so a perfect round could not reach full marks.
  const seenTerms = new Set<string>();
  const vocabulary: VocabularyItem[] = [];
  (article?.words ?? []).forEach((word, index) => {
    if (!word || typeof word !== "object") return;
    const term = clean(word.vocabulary) || clean(word.word) || clean(word.text);
    const key = term.toLowerCase();
    if (!term || seenTerms.has(key)) return;
    const termMeaning = normalizeMeaning(term);
    const translation = [word.definition?.th, word.translation, word.meaning, word.definition?.en]
      .map(clean)
      .find((meaning) => meaning && normalizeMeaning(meaning) !== termMeaning);
    if (!translation) return;
    seenTerms.add(key);
    const audioUrl = clean(word.audioUrl) || clean(word.audio_url);
    vocabulary.push({ id: word.id ?? `word-${index}`, term, translation, ...(audioUrl ? { audioUrl } : {}) });
  });
  return vocabulary;
}

/** Some stored Thai sentences start with their number ("1. นักแสดงตลก..."). */
const stripSentenceNumber = (text: string) => text.replace(/^[0-9๐-๙]+[.)]\s*/, "");

/** Stored Thai lines up with the sentences by position only, so a different length means it cannot be trusted. */
function storedThaiBySentence(article: LessonArticle | null | undefined, sentenceCount: number): unknown[] {
  const stored = article?.translated_passage?.th;
  return Array.isArray(stored) && stored.length === sentenceCount ? stored : [];
}

/**
 * Sentence items. `thaiTranslation` is set only when the lesson really stores
 * Thai for that sentence (no machine or made-up translation), and sentence
 * games must show the prompt through useSentencePrompt, not `translation`.
 * `translation` stays filled (Thai, or else the English sentence) for the older
 * games that have not moved to the prompt yet.
 */
export function buildLessonSentences(article?: LessonArticle | null): VocabularyItem[] {
  const raw = article?.sentences ?? [];
  const storedThai = storedThaiBySentence(article, raw.length);
  const items: VocabularyItem[] = [];
  raw.forEach((sentence, index) => {
    const own = typeof sentence === "string" ? {} : (sentence ?? {});
    const term = typeof sentence === "string" ? clean(sentence) : clean(own.sentences) || clean(own.sentence) || clean(own.text);
    // One word has no order to work out.
    if (countSentenceWords(term) < 2) return;
    const thai = [own.translation, own.meaning, storedThai[index]]
      .map((text) => stripSentenceNumber(clean(text)))
      .find(hasThaiText);
    const audioUrl = clean(own.audioUrl) || clean(own.audio_url);
    items.push({
      id: own.id ?? `sentence-${index}`,
      term,
      translation: thai || term,
      ...(thai ? { thaiTranslation: thai } : {}),
      ...(audioUrl ? { audioUrl } : {}),
    });
  });
  return items;
}

/** A word game needs a right answer and at least one wrong answer that reads differently. */
export const hasUsableVocabulary = (vocabulary: readonly VocabularyItem[]) => countDistinctMeanings(vocabulary) >= 2;

export const hasUsableSentences = (sentences: readonly VocabularyItem[]) => sentences.length >= 1;

/** Enough for the word budgets in sentenceRound (24 words in Castle Defense, 20 in Potion Rush). */
const THIN_LESSON_WORDS = 24;

/**
 * A lesson with only a sentence or two would finish its round in seconds, with
 * full marks. Repeat the lesson's own sentences so the round runs as normal.
 * Words from outside the lesson are never added.
 */
export function repeatThinSentences(sentences: VocabularyItem[]): VocabularyItem[] {
  const wordsPerPass = sentences.reduce((sum, sentence) => sum + countSentenceWords(sentence.term), 0);
  if (wordsPerPass === 0 || wordsPerPass >= THIN_LESSON_WORDS) return sentences;
  const passes = Math.ceil(THIN_LESSON_WORDS / wordsPerPass);
  const repeated: VocabularyItem[] = [];
  for (let pass = 0; pass < passes; pass++) {
    sentences.forEach((sentence, index) => {
      repeated.push(pass === 0 ? sentence : { ...sentence, id: `${sentence.id ?? index}-again-${pass}` });
    });
  }
  return repeated;
}
