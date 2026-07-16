import { logger } from "@tutor-advantage/shared-config";
import { existsSync, readFileSync } from "fs";
import { Pool } from "pg";

function primaryConnectionString() {
  if (process.env.DATABASE_URL_PRIMARY_ADVANTAGE) return process.env.DATABASE_URL_PRIMARY_ADVANTAGE;
  const envPath = process.env.PRIMARY_ADVANTAGE_ENV_FILE || "C:/Repository/primary-advantage/.env";
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "") || null;
}

const connectionString = primaryConnectionString();
const pool = connectionString ? new Pool({ connectionString }) : null;

function toOptions(options: unknown): Record<string, string> {
  if (Array.isArray(options)) {
    return Object.fromEntries(options.map((option, index) => [`option${index + 1}`, String(option)]));
  }
  return options && typeof options === "object" ? options as Record<string, string> : {};
}

function normaliseWords(words: unknown) {
  if (!Array.isArray(words)) return [];
  return words.map((word: any) => ({
    ...word,
    vocabulary: word?.vocabulary ?? word?.word ?? word?.text ?? "",
    definition: word?.definition ?? { th: word?.thai_definition ?? "" },
    translation: word?.translation ?? word?.thai_definition ?? "",
  }));
}

function normaliseSentences(sentences: unknown) {
  if (!Array.isArray(sentences)) return [];
  return sentences.map((sentence: any) => {
    if (!sentence || typeof sentence !== "object") {
      return { sentences: String(sentence ?? "") };
    }
    return {
      ...sentence,
      // Tutor lesson games use `sentences`; Primary stores the text as `sentence`.
      sentences: sentence.sentences ?? sentence.sentence ?? sentence.text ?? "",
    };
  });
}

function normaliseTranslations(translations: unknown) {
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) {
    return translations;
  }

  return Object.fromEntries(
    Object.entries(translations as Record<string, unknown>).map(([language, value]) => [
      language,
      Array.isArray(value) ? value : [value],
    ]),
  );
}

function primaryStorageUrl(path: unknown) {
  if (typeof path !== "string" || !path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://storage.googleapis.com/primary-app-storage/${path.replace(/^\//, "")}`;
}

export async function getPrimaryArticleDetails(articleId: string) {
  if (!pool) return null;

  try {
    const articleResult = await pool.query(
      `SELECT id, title, summary, passage, cefr_level, ra_level, words, sentences,
              translated_passage, translated_summary, audio_url, audio_word_url, genre, type
         FROM article
        WHERE id = $1 AND is_published = true`,
      [articleId],
    );
    const article = articleResult.rows[0];
    if (!article) return null;

    const [mcqResult, saqResult, flashcardResult] = await Promise.all([
      pool.query(
        `SELECT id, question, options, answer
           FROM multiple_choice_questions
          WHERE article_id = $1`,
        [articleId],
      ),
      pool.query(
        `SELECT id, question, answer
           FROM short_answer_questions
          WHERE article_id = $1`,
        [articleId],
      ),
      pool.query(
        `SELECT words, words_url
           FROM sentencs_and_words_for_flashcard
          WHERE article_id = $1
          LIMIT 1`,
        [articleId],
      ),
    ]);
    const flashcard = flashcardResult.rows[0];

    return {
      ...article,
      content_provider: "PRIMARY_ADVANTAGE",
      // Primary stores its curated vocabulary separately from article.words.
      words: normaliseWords(article.words ?? flashcard?.words),
      sentences: normaliseSentences(article.sentences),
      translated_summary: normaliseTranslations(article.translated_summary),
      audio_url: primaryStorageUrl(article.audio_url),
      audio_word_url: primaryStorageUrl(article.audio_word_url ?? flashcard?.words_url),
      image_urls: [1, 2, 3].map(
        (index) => `https://storage.googleapis.com/primary-app-storage/images/${article.id}_${index}.png`,
      ),
      multipleChoiceQuestions: mcqResult.rows.map((question) => ({
        ...question,
        options: toOptions(question.options),
      })),
      shortAnswerQuestions: saqResult.rows,
    };
  } catch (error) {
    logger.error(`[PrimaryAdvantageDB] Could not load article ${articleId}`, error);
    return null;
  }
}
