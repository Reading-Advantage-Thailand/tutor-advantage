import { logger } from "@tutor-advantage/shared-config";
import { prisma } from "@tutor-advantage/database";
import { Pool } from "pg";
import { getPrimaryArticleDetails } from "./PrimaryAdvantageDB";
import { buildTtsManifest, getTtsAudioUrl, loadTtsManifest } from "./ttsManifest";

const connectionString =
  process.env.DATABASE_URL_READING_ADVANTAGE || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}
const pool = new Pool({
  connectionString,
});

const mockArticles: Record<string, any> = {
  "art-001": {
    id: "art-001",
    title: "The Amazing Octopus",
    summary: "Learn about octopus behavior and intelligence",
    passage:
      "Octopuses are intelligent creatures that can solve problems and hide from predators. They have three hearts and blue blood. They can change their color and texture to blend in with their surroundings.",
    cefr_level: "A1",
    ra_level: "Level 1",
    words: [
      {
        vocabulary: "intelligent",
        definition: { th: "ฉลาด, มีไหวพริบ" },
        translation: "intelligent",
        audioUrl: "/audio/articles/art-001/words/word_0.mp3",
      },
      {
        vocabulary: "predator",
        definition: { th: "ผู้ล่า, สัตว์ล่าเนื้อ" },
        translation: "predator",
        audioUrl: "/audio/articles/art-001/words/word_1.mp3",
      },
      {
        vocabulary: "blend",
        definition: { th: "ผสมผสาน, กลมกลืน" },
        translation: "blend",
        audioUrl: "/audio/articles/art-001/words/word_2.mp3",
      },
    ],
    sentences: [
      {
        sentences: "Octopuses are intelligent creatures that can solve problems.",
        audioUrl: "/audio/articles/art-001/sentences/sentence_0.mp3",
      },
      {
        sentences: "They have three hearts and blue blood.",
        audioUrl: "/audio/articles/art-001/sentences/sentence_1.mp3",
      },
      {
        sentences: "They can change their color and texture to blend in.",
        audioUrl: "/audio/articles/art-001/sentences/sentence_2.mp3",
      },
    ],
    multipleChoiceQuestions: [
      {
        id: "mcq-1",
        question: "How many hearts does an octopus have?",
        option1: "One",
        option2: "Two",
        option3: "Three",
        option4: "Four",
        answer: "Three",
      },
      {
        id: "mcq-2",
        question: "What color is an octopus's blood?",
        option1: "Red",
        option2: "Blue",
        option3: "Green",
        option4: "Yellow",
        answer: "Blue",
      },
    ],
    shortAnswerQuestions: [
      {
        id: "saq-1",
        question: "Why are octopuses considered intelligent?",
        answer: "Because they can solve problems.",
      },
      {
        id: "saq-2",
        question: "How do octopuses hide from predators?",
        answer: "They change their color and texture to blend in.",
      },
    ],
  },
  "art-002": {
    id: "art-002",
    title: "Recycling: Save the Planet",
    summary: "Understanding the importance of recycling",
    passage:
      "Recycling helps reduce waste and protects our environment for future generations. By recycling paper, plastic, and glass, we can conserve natural resources and reduce pollution.",
    cefr_level: "A2",
    ra_level: "Level 2",
    words: [
      {
        vocabulary: "conserve",
        definition: { th: "อนุรักษ์, ประหยัด" },
        translation: "conserve",
        audioUrl: "/audio/articles/art-002/words/word_0.mp3",
      },
      {
        vocabulary: "pollution",
        definition: { th: "มลพิษ" },
        translation: "pollution",
        audioUrl: "/audio/articles/art-002/words/word_1.mp3",
      },
      {
        vocabulary: "environment",
        definition: { th: "สิ่งแวดล้อม" },
        translation: "environment",
        audioUrl: "/audio/articles/art-002/words/word_2.mp3",
      },
    ],
    sentences: [
      {
        sentences: "Recycling helps reduce waste and protects our environment.",
        audioUrl: "/audio/articles/art-002/sentences/sentence_0.mp3",
      },
      {
        sentences: "We can conserve natural resources by recycling.",
        audioUrl: "/audio/articles/art-002/sentences/sentence_1.mp3",
      },
      {
        sentences: "Reducing pollution is important for future generations.",
        audioUrl: "/audio/articles/art-002/sentences/sentence_2.mp3",
      },
    ],
    multipleChoiceQuestions: [
      {
        id: "mcq-1",
        question: "What materials can be recycled according to the text?",
        option1: "Only paper",
        option2: "Paper, plastic, and glass",
        option3: "Only glass",
        option4: "Metal and wood",
        answer: "Paper, plastic, and glass",
      },
    ],
    shortAnswerQuestions: [
      {
        id: "saq-1",
        question: "How does recycling protect the environment?",
        answer: "It reduces waste and pollution.",
      },
    ],
  },
  "art-003": {
    id: "art-003",
    title: "The History of Coffee",
    summary: "Fascinating facts about coffee history",
    passage:
      "Coffee originated in Ethiopia and has become the most popular beverage worldwide. Millions of people drink coffee every morning to feel energized.",
    cefr_level: "B1",
    ra_level: "Level 3",
    words: [
      {
        vocabulary: "originated",
        definition: { th: "มีต้นกำเนิด, เริ่มมาจาก" },
        translation: "originated",
        audioUrl: "/audio/articles/art-003/words/word_0.mp3",
      },
      {
        vocabulary: "beverage",
        definition: { th: "เครื่องดื่ม" },
        translation: "beverage",
        audioUrl: "/audio/articles/art-003/words/word_1.mp3",
      },
      {
        vocabulary: "energized",
        definition: { th: "กระปรี้กระเปร่า, มีพลัง" },
        translation: "energized",
        audioUrl: "/audio/articles/art-003/words/word_2.mp3",
      },
    ],
    sentences: [
      {
        sentences: "Coffee originated in Ethiopia many years ago.",
        audioUrl: "/audio/articles/art-003/sentences/sentence_0.mp3",
      },
      {
        sentences: "It is the most popular beverage worldwide.",
        audioUrl: "/audio/articles/art-003/sentences/sentence_1.mp3",
      },
      {
        sentences: "Millions of people drink it to feel energized.",
        audioUrl: "/audio/articles/art-003/sentences/sentence_2.mp3",
      },
    ],
    multipleChoiceQuestions: [
      {
        id: "mcq-1",
        question: "Where did coffee originate?",
        option1: "Brazil",
        option2: "Ethiopia",
        option3: "Colombia",
        option4: "Vietnam",
        answer: "Ethiopia",
      },
    ],
    shortAnswerQuestions: [
      {
        id: "saq-1",
        question: "Why do people drink coffee in the morning?",
        answer: "To feel energized.",
      },
    ],
  },
  "art-primary-001": {
    id: "art-primary-001",
    title: "The Friendly Dolphin",
    summary: "Discover dolphins in the ocean",
    passage:
      "Dolphins live in the ocean and love to swim in groups. They use sound waves to find fish and communicate. Many dolphins can jump high out of the water.",
    cefr_level: "A1",
    ra_level: "Level 1",
    content_provider: "PRIMARY_ADVANTAGE",
    words: [
      {
        vocabulary: "ocean",
        definition: { th: "มหาสมุทร" },
        translation: "ocean",
        audioUrl: "/audio/articles/art-primary-001/words/word_0.mp3",
      },
      {
        vocabulary: "communicate",
        definition: { th: "สื่อสาร" },
        translation: "communicate",
        audioUrl: "/audio/articles/art-primary-001/words/word_1.mp3",
      },
      {
        vocabulary: "group",
        definition: { th: "กลุ่ม" },
        translation: "group",
        audioUrl: "/audio/articles/art-primary-001/words/word_2.mp3",
      },
    ],
    sentences: [
      {
        sentences: "Dolphins live in the ocean and love to swim in groups.",
        audioUrl: "/audio/articles/art-primary-001/sentences/sentence_0.mp3",
      },
      {
        sentences: "They use sound waves to find fish and communicate.",
        audioUrl: "/audio/articles/art-primary-001/sentences/sentence_1.mp3",
      },
      {
        sentences: "Many dolphins can jump high out of the water.",
        audioUrl: "/audio/articles/art-primary-001/sentences/sentence_2.mp3",
      },
    ],
    multipleChoiceQuestions: [
      {
        id: "mcq-1",
        question: "Where do dolphins live?",
        option1: "In lakes",
        option2: "In rivers",
        option3: "In the ocean",
        option4: "On land",
        answer: "In the ocean",
      },
    ],
    shortAnswerQuestions: [
      {
        id: "saq-1",
        question: "What do dolphins use to find fish?",
        answer: "Sound waves.",
      },
    ],
  },
};

export const getArticleDetails = async (articleId: string, bookId?: string) => {
  if (bookId) {
    const book = await prisma.book.findUnique({
      where: { bookId },
      select: { bookCode: true },
    });
    if (book?.bookCode.startsWith("Primary ")) {
      return getPrimaryArticleDetails(articleId);
    }
  }

  const bucketName = process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket";

  // Helper to attach GCS Audio URLs to all article fields
  const attachGcsAudioUrls = async (art: any) => {
    if (!art) return art;
    const copy = JSON.parse(JSON.stringify(art));

    const validUrl = (url: any, defaultUrl: string) => {
      if (typeof url === "string" && url.startsWith("https://storage.googleapis.com/")) {
        return url;
      }
      return defaultUrl;
    };

    if (Array.isArray(copy.sentences)) {
      copy.sentences = copy.sentences.map((sent: any, idx: number) => {
        const text = typeof sent === "object" ? (sent.sentences || sent.text || sent.sentence || "") : String(sent);
        const existingUrl = typeof sent === "object" ? (sent.audioUrl || sent.audio_url) : null;
        const defaultUrl = `https://storage.googleapis.com/${bucketName}/articles/${articleId}/sentences/sentence_${idx}.mp3`;
        return {
          ...(typeof sent === "object" ? sent : {}),
          sentences: text,
          audioUrl: validUrl(existingUrl, defaultUrl),
        };
      });
    }

    if (Array.isArray(copy.words)) {
      copy.words = copy.words.map((word: any, idx: number) => {
        const vocab = typeof word === "object" ? (word.vocabulary || word.word || "") : String(word);
        const existingUrl = typeof word === "object" ? (word.audioUrl || word.audio_url) : null;
        const defaultUrl = `https://storage.googleapis.com/${bucketName}/articles/${articleId}/words/word_${idx}.mp3`;
        return {
          ...(typeof word === "object" ? word : {}),
          vocabulary: vocab,
          audioUrl: validUrl(existingUrl, defaultUrl),
        };
      });
    }

    if (Array.isArray(copy.multipleChoiceQuestions)) {
      copy.multipleChoiceQuestions = copy.multipleChoiceQuestions.map((mcq: any, k: number) => {
        const qText = mcq.question || "";
        const qAudioUrl = mcq.audioUrl || mcq.questionAudioUrl || `https://storage.googleapis.com/${bucketName}/articles/${articleId}/mcq/question_${k}.mp3`;
        const optionUrls: Record<string, string> = {};

        const rawOpts = mcq.options || { option1: mcq.option1, option2: mcq.option2, option3: mcq.option3, option4: mcq.option4 };
        for (const key of Object.keys(rawOpts)) {
          optionUrls[key] = `https://storage.googleapis.com/${bucketName}/articles/${articleId}/mcq/question_${k}_opt_${key}.mp3`;
        }

        return {
          ...mcq,
          question: qText,
          audioUrl: qAudioUrl,
          questionAudioUrl: qAudioUrl,
          optionAudioUrls: optionUrls,
        };
      });
    }

    if (Array.isArray(copy.shortAnswerQuestions)) {
      copy.shortAnswerQuestions = copy.shortAnswerQuestions.map((saq: any, n: number) => {
        const qText = saq.question || "";
        const qAudioUrl = saq.audioUrl || saq.questionAudioUrl || `https://storage.googleapis.com/${bucketName}/articles/${articleId}/saq/question_${n}.mp3`;
        return {
          ...saq,
          question: qText,
          audioUrl: qAudioUrl,
          questionAudioUrl: qAudioUrl,
        };
      });
    }

    const manifest = buildTtsManifest({
      articleId,
      source: "READING_ADVANTAGE",
      sentences: (copy.sentences || []).map((item: any) => item?.sentences ?? item?.sentence ?? item?.text ?? item),
      words: (copy.words || []).map((item: any) => item?.vocabulary ?? item?.word ?? item?.text ?? item),
      bucket: bucketName,
      questions: [
        ...(copy.multipleChoiceQuestions || []).map((item: any) => ({
          type: "mcq",
          question: item.question,
          options: item.options || [item.option1, item.option2, item.option3, item.option4].filter(Boolean),
        })),
        ...(copy.shortAnswerQuestions || []).map((item: any) => ({ type: "saq", question: item.question })),
      ],
    });
    copy.sentences = manifest.sentences.map((item) => ({
      ...(copy.sentences[item.order] || {}),
      sentences: item.text,
      audioUrl: item.audioUrl,
      audioId: item.id,
    }));
    copy.words = manifest.words.map((item) => ({
      ...(copy.words[item.order] || {}),
      vocabulary: item.text,
      audioUrl: item.audioUrl,
      audioId: item.id,
    }));
    const publishedManifest = await loadTtsManifest(articleId, bucketName);
    const activeManifest = publishedManifest || manifest;
    if (activeManifest) {
      const findAudioItem = (items: any[], text: string, index: number) =>
        items.find((audioItem) => audioItem.text === text) || items[index];

      // Keep the source article metadata (definitions, translations, timing,
      // etc.) and only overlay the generated audio fields. The old mapping
      // replaced the whole word object and dropped definition.en/definition.th.
      copy.sentences = (copy.sentences || []).map((sentence: any, index: number) => {
        const text = typeof sentence === "object"
          ? sentence.sentences || sentence.text || sentence.sentence || ""
          : String(sentence);
        const audioItem = findAudioItem(activeManifest.sentences, text, index);
        return {
          ...(typeof sentence === "object" ? sentence : {}),
          sentences: text,
          ...(audioItem ? { audioId: audioItem.id, audioUrl: audioItem.audioUrl } : {}),
        };
      });
      copy.words = (copy.words || []).map((word: any, index: number) => {
        const text = typeof word === "object"
          ? word.vocabulary || word.word || word.text || ""
          : String(word);
        const audioItem = findAudioItem(activeManifest.words, text, index);
        return {
          ...(typeof word === "object" ? word : {}),
          vocabulary: text,
          ...(audioItem ? { audioId: audioItem.id, audioUrl: audioItem.audioUrl } : {}),
        };
      });
      copy.multipleChoiceQuestions = (copy.multipleChoiceQuestions || []).map((item: any, index: number) => {
        const audioQuestion = activeManifest.questions.find(
          (candidate: any) => candidate.type === "mcq" && candidate.text === item.question,
        ) || activeManifest.questions.filter((candidate: any) => candidate.type === "mcq")[index];
        return {
          ...item,
          audioUrl: audioQuestion?.questionAudioUrl,
          questionAudioUrl: audioQuestion?.questionAudioUrl,
          optionAudioUrls: audioQuestion?.optionAudioUrls || {},
        };
      });
      copy.shortAnswerQuestions = (copy.shortAnswerQuestions || []).map((item: any, index: number) => {
        const audioQuestion = activeManifest.questions.find(
          (candidate: any) => candidate.type === "saq" && candidate.text === item.question,
        ) || activeManifest.questions.filter((candidate: any) => candidate.type === "saq")[index];
        const audio = audioQuestion?.questionAudioUrl;
        return { ...item, audioUrl: audio, questionAudioUrl: audio };
      });
      copy.audio_manifest = activeManifest;
    }
    copy.audio_manifest_url = getTtsAudioUrl(bucketName, `articles/${articleId}/manifest.json`);
    return copy;
  };

  // 1. Direct mock resolver for local development or empty databases
  if (mockArticles[articleId]) {
    logger.info(
      `[ReadingAdvantageDB] Returning mock data for articleId: ${articleId}`,
    );
    return await attachGcsAudioUrls(mockArticles[articleId]);
  }

  try {
    let res;
    try {
      res = await pool.query(
        `SELECT *
         FROM "article" 
         WHERE id = $1`,
        [articleId],
      );
    } catch (e_err) {
      const e = e_err as Error & { code?: string; details?: string; };
      if (e.code === "42P01") {
        // relation does not exist
        res = await pool.query(
          `SELECT *
           FROM "Article" 
           WHERE id = $1`,
          [articleId],
        );
      } else {
        throw e;
      }
    }

    if (res.rows.length === 0) {
      const primaryArticle = await getPrimaryArticleDetails(articleId);
      if (primaryArticle) return await attachGcsAudioUrls(primaryArticle);
      logger.warn(`[ReadingAdvantageDB] Article ${articleId} was not found`);
      return null;
    }

    const article = res.rows[0];

    // Fetch Multiple Choice Questions for this article
    let mcqRes;
    try {
      mcqRes = await pool.query(
        `SELECT id, question, options, answer 
         FROM "MultipleChoiceQuestion" 
         WHERE article_id = $1`,
        [articleId],
      );
    } catch (e_err) {
      const e = e_err as Error & { code?: string; details?: string; };
      if (e.code === "42P01") {
        mcqRes = await pool.query(
          `SELECT id, question, options, answer 
           FROM "multiplechoicequestion" 
           WHERE article_id = $1`,
          [articleId],
        );
      } else {
        throw e;
      }
    }

    // Fetch Short Answer Questions for this article
    let saqRes;
    try {
      saqRes = await pool.query(
        `SELECT id, question, answer 
         FROM "ShortAnswerQuestion" 
         WHERE article_id = $1`,
        [articleId],
      );
    } catch (e_err) {
      const e = e_err as Error & { code?: string; details?: string; };
      if (e.code === "42P01") {
        saqRes = await pool.query(
          `SELECT id, question, answer 
           FROM "shortanswerquestion" 
           WHERE article_id = $1`,
          [articleId],
        );
      } else {
        throw e;
      }
    }

    const fullArticle = {
      ...article,
      multipleChoiceQuestions: mcqRes.rows,
      shortAnswerQuestions: saqRes.rows,
    };

    return await attachGcsAudioUrls(fullArticle);
  } catch (error) {
    try {
      const primaryArticle = await getPrimaryArticleDetails(articleId);
      if (primaryArticle) return await attachGcsAudioUrls(primaryArticle);
    } catch {
      // Retain the original database failure below for actionable logs.
    }
    logger.error("Error fetching article from Reading Advantage DB:", error);
    return null;
  }
};
