/**
 * Pure builders for the A–D question phases (7 comprehension, 9 vocabulary,
 * 11 fill-in-the-blank, 12 sentence order).
 *
 * IMPORTANT: option order comes from `seededShuffle` with the session id and
 * the exact seed strings below. The learning-service and the student app use
 * the same seeds, so the letter a student taps ("B") maps to the same option
 * the tutor sees. Do not change seeds, option sources or fallbacks.
 */
import type { ArticleData } from "@/lib/lesson-types";
import { LESSON_PHASE } from "@/lib/lessonPhases";
import { t } from "@/lib/i18n";

/** Deterministic shuffle shared with the backend / student app. */
export function seededShuffle<T>(array: T[], seedInput: string): T[] {
  const result = [...array];
  if (!seedInput) return result;

  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed += seedInput.charCodeAt(i);
  }

  for (let i = result.length - 1; i > 0; i--) {
    // Use a stable sine-based pseudo-random generator
    const x = Math.sin(seed + i) * 10000;
    const rand = x - Math.floor(x);
    const j = Math.floor(rand * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Map a list of option texts to { A: …, B: …, C: …, D: … }. */
export function toLabelledOptions(options: string[]): Record<string, string> {
  const mapped: Record<string, string> = {};
  options.forEach((value, i) => {
    mapped[String.fromCharCode(65 + i)] = value;
  });
  return mapped;
}

export interface TranslationItem {
  label: string;
  text: string;
}

export interface ChoiceAudio {
  questionAudioUrl?: string;
  questionAudioText?: string;
  optionAudioUrls?: Record<string, string>;
  speakQuestion?: boolean;
  speakOptions?: boolean;
}

export interface ChoiceQuestionModel {
  kind: "choice";
  question: string;
  /** Option text by label A–D, in the order students see them. */
  options: Record<string, string>;
  /** Correct label ("A"–"D"), or the raw answer if it could not be matched. */
  correct: string;
  translationItems: TranslationItem[];
  /** Index passed through to the audio fallback (legacy). */
  questionIndex?: number;
  /** Source MCQ object (for per-option audio URLs keyed by option1… / 0…). */
  sourceQuestion?: any;
  audio: ChoiceAudio;
}

export interface EmptyQuestionModel {
  kind: "empty";
  message: string;
}

export type QuestionModel = ChoiceQuestionModel | EmptyQuestionModel;

/** Audio lookups the builders need (supplied by useLessonAudio). */
export interface QuestionAudioLookup {
  getManifestQuestion: (type: "mcq" | "saq", index: number) => any;
  getManifestQuestionByText: (text: string, type?: "mcq" | "saq") => any;
  getSentenceAudioUrl: (sentence: any, index: number) => string | undefined;
  getWordAudioUrl: (text: string) => string | undefined;
  normaliseOptionAudioUrls: (urls?: Record<string, string>) => Record<string, string> | undefined;
}

interface BuildContext {
  articleData?: ArticleData;
  sessionId?: string;
  phaseSelectedIndices?: Record<number, number>;
  audio: QuestionAudioLookup;
}

const sessionSeed = (sessionId?: string) => sessionId || "fallback";

/** Phase 7: comprehension multiple choice from the article's MCQ bank. */
export function buildComprehensionQuestion({ articleData, sessionId, phaseSelectedIndices, audio }: BuildContext): ChoiceQuestionModel {
  const idx = phaseSelectedIndices?.[LESSON_PHASE.COMPREHENSION] || 0;
  const mcqQuestion = articleData?.multipleChoiceQuestions?.[idx];
  const manifestMcqQuestion =
    audio.getManifestQuestionByText(mcqQuestion?.question, "mcq") || audio.getManifestQuestion("mcq", idx);
  const rawAnswer = mcqQuestion?.answer || "";
  const optionsData = mcqQuestion?.options || {};
  const optionKeys = Object.keys(optionsData).sort();

  // 1. Try to match raw answer string against full option text
  let answerIdx = -1;
  optionKeys.forEach((key, i) => {
    if (optionsData[key] === rawAnswer) answerIdx = i;
  });

  // 2. Fallback: Check if it is an index or key like "1"
  if (answerIdx === -1) {
    const i = optionKeys.indexOf(rawAnswer);
    if (i !== -1) {
      answerIdx = i;
    } else {
      // Fallback 3: Is it "A", "B", "C", "D"?
      const labelIdx = String(rawAnswer).charCodeAt(0) - 65;
      if (labelIdx >= 0 && labelIdx < optionKeys.length) answerIdx = labelIdx;
    }
  }

  const rawOptions = optionKeys.map((key) => optionsData[key]);
  const correctOptionText = answerIdx !== -1 ? rawOptions[answerIdx] : rawAnswer;

  // Deterministic shuffle tied to session ID so frontend matches backend perfectly
  const shuffledOptions = seededShuffle(rawOptions, sessionSeed(sessionId) + "_phase7_" + mcqQuestion?.question);
  const newCorrectIdx = shuffledOptions.indexOf(correctOptionText);
  const correct = newCorrectIdx !== -1 ? String.fromCharCode(65 + newCorrectIdx) : rawAnswer;

  return {
    kind: "choice",
    question: mcqQuestion?.question || t("lesson.interactive.genericQuestion"),
    options: toLabelledOptions(shuffledOptions),
    correct,
    translationItems: [],
    questionIndex: idx,
    sourceQuestion: mcqQuestion,
    audio: {
      // Match the published audio by the question text first. The source
      // question list can be re-ordered independently from the manifest.
      questionAudioUrl: manifestMcqQuestion?.questionAudioUrl || mcqQuestion?.questionAudioUrl || mcqQuestion?.audioUrl,
      optionAudioUrls: audio.normaliseOptionAudioUrls(manifestMcqQuestion?.optionAudioUrls || mcqQuestion?.optionAudioUrls),
    },
  };
}

/** Phase 9: "what does <word> mean?" with Thai meanings as options. */
export function buildVocabularyQuestion({ articleData, sessionId, phaseSelectedIndices }: BuildContext): QuestionModel {
  const words = articleData?.words || [];
  if (words.length < 4) return { kind: "empty", message: t("lesson.interactive.notEnoughVocab") };

  const idx = phaseSelectedIndices?.[LESSON_PHASE.VOCABULARY_PRACTICE] || 0;
  const targetWord = words[idx] || words[0];
  const question = `${t("lesson.interactive.vocabQuestionPrefix")} "${targetWord.vocabulary || targetWord.word || targetWord.text}" ${t("lesson.interactive.vocabQuestionSuffix")}`;

  const correctTranslation =
    targetWord.definition?.th || targetWord.translation || t("lesson.interactive.correctMeaningFallback");
  const distractorWords = words.filter((_w: any, i: number) => i !== idx);

  const usedTranslations = new Set<string>([correctTranslation]);
  const optionsArray: string[] = [correctTranslation];
  distractorWords.forEach((w: any) => {
    const trans = w?.definition?.th || w?.translation;
    if (trans && !usedTranslations.has(trans) && optionsArray.length < 4) {
      usedTranslations.add(trans);
      optionsArray.push(trans);
    }
  });

  let fillCounter = 1;
  while (optionsArray.length < 4) {
    const fb = `${t("lesson.interactive.otherMeaningPrefix")} ${String.fromCharCode(65 + fillCounter)}`;
    if (!usedTranslations.has(fb)) {
      usedTranslations.add(fb);
      optionsArray.push(fb);
    }
    fillCounter++;
  }

  const shuffledOptions = seededShuffle(optionsArray, sessionSeed(sessionId) + "_phase9_" + targetWord?.vocabulary);
  const newCorrectIdx = shuffledOptions.indexOf(correctTranslation);

  return {
    kind: "choice",
    question,
    options: toLabelledOptions(shuffledOptions),
    correct: String.fromCharCode(65 + newCorrectIdx),
    translationItems: [
      { label: t("lesson.live.translationWord"), text: String(targetWord.vocabulary || targetWord.word || targetWord.text) },
      { label: t("lesson.live.translationMeaning"), text: correctTranslation },
    ],
    // The prompt and options are Thai in this phase; do not expose an
    // English TTS button or trigger browser fallback for them.
    audio: { speakQuestion: false, speakOptions: false },
  };
}

const sentenceText = (sentence: any) => (typeof sentence === "object" ? sentence.sentences : sentence);

/** Phase 11: fill the last word of a key sentence. */
export function buildFillBlankQuestion({ articleData, sessionId, phaseSelectedIndices, audio }: BuildContext): QuestionModel {
  const sentences = articleData?.sentences || [];
  if (sentences.length < 1) return { kind: "empty", message: t("lesson.interactive.notEnoughSentences") };

  const idx = phaseSelectedIndices?.[LESSON_PHASE.SENTENCE_PRACTICE] || 0;
  const targetSentence = sentenceText(sentences[idx]);
  const words = String(targetSentence).split(" ");
  if (words.length < 3) return { kind: "empty", message: t("lesson.interactive.sentenceTooShort") };

  const correctWord = words[words.length - 1].replace(/[.,!?]/g, "");
  const displaySentence = words.slice(0, words.length - 1).join(" ") + " _____";
  const question = `${t("lesson.interactive.fillBlankPrefix")} ${displaySentence}`;

  const vocabWords = articleData?.words?.map((w: any) => w.vocabulary || w.word || w.text) || ["Apple", "Banana", "Cat"];
  const distractors = vocabWords.filter((w: string) => w.toLowerCase() !== correctWord.toLowerCase());
  const optionsArray = [correctWord, distractors[0] || "Word A", distractors[1] || "Word B", distractors[2] || "Word C"];

  const shuffledOptions = seededShuffle(optionsArray, sessionSeed(sessionId) + "_phase11_" + targetSentence);
  const newCorrectIdx = shuffledOptions.indexOf(correctWord);

  const optionAudioUrls: Record<string, string> = {};
  shuffledOptions.forEach((value, optionIndex) => {
    const url = audio.getWordAudioUrl(value);
    if (url) optionAudioUrls[String.fromCharCode(65 + optionIndex)] = url;
  });

  return {
    kind: "choice",
    question,
    options: toLabelledOptions(shuffledOptions),
    correct: String.fromCharCode(65 + newCorrectIdx),
    translationItems: [
      { label: t("lesson.live.translationFullSentence"), text: String(targetSentence) },
      { label: t("lesson.live.translationAnswerWord"), text: correctWord },
    ],
    questionIndex: idx,
    audio: {
      questionAudioUrl: audio.getSentenceAudioUrl(sentences[idx], idx),
      questionAudioText: String(targetSentence),
      optionAudioUrls,
    },
  };
}

/** Phase 12: pick the correctly ordered sentence from scrambled variants. */
export function buildSentenceOrderQuestion({ articleData, sessionId, phaseSelectedIndices, audio }: BuildContext): QuestionModel {
  const sentences = articleData?.sentences || [];
  if (sentences.length < 1) return { kind: "empty", message: t("lesson.interactive.notEnoughSentences") };

  const idx = phaseSelectedIndices?.[LESSON_PHASE.SENTENCE_ORDER] || 0;
  const targetSentence = sentenceText(sentences[idx]);
  const words = String(targetSentence)
    .split(" ")
    .filter((w: any) => String(w).trim().length > 0);
  // Shuffle the sentence words deterministically based on session
  const scrambledWords = seededShuffle(words, sessionSeed(sessionId) + "_phase12_words_" + targetSentence);
  if (scrambledWords.join(" ") === words.join(" ")) scrambledWords.reverse(); // Ensure it is actually different from the original
  const scrambled = scrambledWords.join(" / ");
  const question = `${t("lesson.interactive.orderSentencePrefix")} ${scrambled}`;

  const optA = [...words];
  optA.push(optA.shift()!);
  const optB = [...words];
  optB.unshift(optB.pop()!);
  const optC = [...words].reverse();
  const optionsArray = [targetSentence, optA.join(" "), optB.join(" "), optC.join(" ")];

  const shuffledOptions = seededShuffle(optionsArray, sessionSeed(sessionId) + "_phase12b_" + targetSentence);
  const newCorrectIdx = shuffledOptions.indexOf(targetSentence);

  const finalQuestion =
    scrambled === targetSentence
      ? `${t("lesson.interactive.orderSentencePrefix")} ${[...words].reverse().join(" / ")}`
      : question;

  return {
    kind: "choice",
    question: finalQuestion,
    options: toLabelledOptions(shuffledOptions),
    correct: String.fromCharCode(65 + newCorrectIdx),
    translationItems: [{ label: t("lesson.live.translationSentence"), text: String(targetSentence) }],
    questionIndex: idx,
    audio: {
      questionAudioUrl: audio.getSentenceAudioUrl(sentences[idx], idx),
      questionAudioText: String(targetSentence),
      speakOptions: false,
    },
  };
}

/** Counts per option + accuracy for the results view. */
export function summariseChoiceAnswers(labels: Array<string | null>, correct: string) {
  const counts = ["A", "B", "C", "D"].map((key) => ({ key, count: labels.filter((label) => label === key).length }));
  const correctCount = labels.filter((label) => label === correct).length;
  const total = labels.length;
  return {
    counts,
    correctCount,
    wrongCount: total - correctCount,
    accuracy: total > 0 ? Math.round((correctCount / total) * 100) : 0,
  };
}

/** Score buckets for AI-scored short answers (0–5). */
export function summariseAiScores(scores: number[]) {
  const excellent = scores.filter((s) => s >= 4).length;
  const good = scores.filter((s) => s >= 2 && s < 4).length;
  const improve = scores.filter((s) => s < 2).length;
  const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return { excellent, good, improve, average };
}
