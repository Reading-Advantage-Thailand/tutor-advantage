import { logger } from "@tutor-advantage/shared-config";
import { existsSync, readFileSync } from "fs";
import { Pool } from "pg";
import { buildTtsManifest, getTtsAudioUrl, loadTtsManifest } from "./ttsManifest";

function primaryConnectionString() {
  if (process.env.DATABASE_URL_PRIMARY_ADVANTAGE) return process.env.DATABASE_URL_PRIMARY_ADVANTAGE;
  const envPath = process.env.PRIMARY_ADVANTAGE_ENV_FILE || "C:/Repository/primary-advantage/.env";
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "") || null;
}

let pool: Pool | null = null;
let poolInitialized = false;

function getPrimaryPool(): Pool | null {
  if (poolInitialized) return pool;
  poolInitialized = true;
  const connectionString = primaryConnectionString();
  if (connectionString) {
    pool = new Pool({ connectionString });
  }
  return pool;
}

function toOptions(options: unknown): Record<string, string> {
  if (Array.isArray(options)) {
    return Object.fromEntries(options.map((option, index) => [`option${index + 1}`, String(option)]));
  }
  return options && typeof options === "object" ? options as Record<string, string> : {};
}

function normaliseWords(words: unknown, articleId?: string) {
  if (!Array.isArray(words)) return [];
  const bucketName = process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket";
  return words.map((word: any, index: number) => {
    const vocab = word?.vocabulary ?? word?.word ?? word?.text ?? "";
    const defaultUrl = articleId ? `https://storage.googleapis.com/${bucketName}/articles/${articleId}/words/word_${index}.mp3` : undefined;
    return {
      ...word,
      vocabulary: vocab,
      definition: word?.definition ?? { th: word?.thai_definition ?? "" },
      translation: word?.translation ?? word?.thai_definition ?? "",
      audioUrl: word?.audioUrl ?? word?.audio_url ?? defaultUrl,
    };
  });
}

function normaliseSentences(sentences: unknown, articleId?: string) {
  if (!Array.isArray(sentences)) return [];
  const bucketName = process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket";
  return sentences.map((sentence: any, index: number) => {
    const text = typeof sentence === "object"
      ? (sentence.sentences ?? sentence.sentence ?? sentence.text ?? "")
      : String(sentence ?? "");
    const defaultUrl = articleId ? `https://storage.googleapis.com/${bucketName}/articles/${articleId}/sentences/sentence_${index}.mp3` : undefined;
    return {
      ...(typeof sentence === "object" ? sentence : {}),
      sentences: text,
      audioUrl: sentence?.audioUrl ?? sentence?.audio_url ?? defaultUrl,
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
  const activePool = getPrimaryPool();
  if (!activePool) {
    logger.warn(`[PrimaryAdvantageDB] Cannot fetch article ${articleId}: DATABASE_URL_PRIMARY_ADVANTAGE is not configured`);
    return null;
  }

  try {
    const articleResult = await activePool.query(
      `SELECT id, title, summary, passage, cefr_level, ra_level, words, sentences,
              translated_passage, translated_summary, audio_url, audio_word_url, genre, type
         FROM article
        WHERE id = $1 AND is_published = true`,
      [articleId],
    );
    const article = articleResult.rows[0];
    if (!article) return null;

    const [mcqResult, saqResult, flashcardResult] = await Promise.all([
      activePool.query(
        `SELECT id, question, options, answer
           FROM multiple_choice_questions
          WHERE article_id = $1`,
        [articleId],
      ),
      activePool.query(
        `SELECT id, question, answer
           FROM short_answer_questions
          WHERE article_id = $1`,
        [articleId],
      ),
      activePool.query(
        `SELECT sentence, audio_sentences_url, words, words_url
           FROM sentencs_and_words_for_flashcard
          WHERE article_id = $1
          LIMIT 1`,
        [articleId],
      ),
    ]);
    const flashcard = flashcardResult.rows[0];

    const audioManifest = buildTtsManifest({
      articleId: article.id,
      source: "PRIMARY_ADVANTAGE",
      sentences: (article.sentences ?? []).map((item: any) => item?.sentences ?? item?.sentence ?? item?.text ?? item),
      words: (article.words ?? flashcard?.words ?? []).map((item: any) => item?.vocabulary ?? item?.word ?? item?.text ?? item),
      bucket: process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket",
      questions: [
        ...mcqResult.rows.map((item: any) => ({ type: "mcq", question: item.question, options: item.options })),
        ...saqResult.rows.map((item: any) => ({ type: "saq", question: item.question })),
      ],
    });
    const publishedManifest = await loadTtsManifest(
      article.id,
      process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket",
    );
    const activeAudioManifest = publishedManifest || audioManifest;

    return {
      ...article,
      content_provider: "PRIMARY_ADVANTAGE",
      // The Primary reader uses article.audio_url with article.sentences'
      // startTime/endTime values. Flashcard audio is a separate, shorter set
      // of selected sentences and is only used for vocabulary playback.
      primary_audio: {
        sentencesUrl: primaryStorageUrl(article.audio_url),
        wordsUrl: primaryStorageUrl(flashcard?.words_url),
        hasSentenceEndTimes: true,
      },
      // Curated vocabulary audio/timestamps are stored separately, while the
      // article sentence timeline remains the full-reading source of truth.
      words: activeAudioManifest.words.map((item, index) => ({
        ...normaliseWords(article.words ?? flashcard?.words, article.id)[index],
        vocabulary: item.text,
        audioId: item.id,
        audioUrl: item.audioUrl,
      })),
      sentences: activeAudioManifest.sentences.map((item, index) => ({
        ...normaliseSentences(article.sentences, article.id)[index],
        sentences: item.text,
        audioId: item.id,
        audioUrl: item.audioUrl,
      })),
      multipleChoiceQuestions: mcqResult.rows.map((question, index) => ({
        ...question,
        options: toOptions(question.options),
        audioUrl: activeAudioManifest.questions[index]?.questionAudioUrl,
        questionAudioUrl: activeAudioManifest.questions[index]?.questionAudioUrl,
        optionAudioUrls: activeAudioManifest.questions[index]?.optionAudioUrls || {},
      })),
      shortAnswerQuestions: saqResult.rows.map((question, index) => {
        const audio = activeAudioManifest.questions[mcqResult.rows.length + index]?.questionAudioUrl;
        return { ...question, audioUrl: audio, questionAudioUrl: audio };
      }),
      audio_manifest: activeAudioManifest,
      audio_manifest_url: getTtsAudioUrl(
        process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket",
        `articles/${article.id}/manifest.json`,
      ),
      translated_summary: normaliseTranslations(article.translated_summary),
      audio_url: primaryStorageUrl(article.audio_url),
      audio_word_url: primaryStorageUrl(flashcard?.words_url ?? article.audio_word_url),
      image_urls: [1, 2, 3].map(
        (index) => `https://storage.googleapis.com/primary-app-storage/images/${article.id}_${index}.png`,
      ),
    };
  } catch (error) {
    logger.error(`[PrimaryAdvantageDB] Could not load article ${articleId}`, error);
    return null;
  }
}
