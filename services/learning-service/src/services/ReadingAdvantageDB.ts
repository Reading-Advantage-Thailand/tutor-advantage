import { Pool } from "pg";

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
      },
      {
        vocabulary: "predator",
        definition: { th: "ผู้ล่า, สัตว์ล่าเนื้อ" },
        translation: "predator",
      },
      {
        vocabulary: "blend",
        definition: { th: "ผสมผสาน, กลมกลืน" },
        translation: "blend",
      },
    ],
    sentences: [
      "Octopuses are intelligent creatures that can solve problems.",
      "They have three hearts and blue blood.",
      "They can change their color and texture to blend in.",
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
      },
      {
        vocabulary: "pollution",
        definition: { th: "มลพิษ" },
        translation: "pollution",
      },
      {
        vocabulary: "environment",
        definition: { th: "สิ่งแวดล้อม" },
        translation: "environment",
      },
    ],
    sentences: [
      "Recycling helps reduce waste and protects our environment.",
      "We can conserve natural resources by recycling.",
      "Reducing pollution is important for future generations.",
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
      },
      {
        vocabulary: "beverage",
        definition: { th: "เครื่องดื่ม" },
        translation: "beverage",
      },
      {
        vocabulary: "energized",
        definition: { th: "กระปรี้กระเปร่า, มีพลัง" },
        translation: "energized",
      },
    ],
    sentences: [
      "Coffee originated in Ethiopia many years ago.",
      "It is the most popular beverage worldwide.",
      "Millions of people drink it to feel energized.",
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
};

export const getArticleDetails = async (articleId: string) => {
  // 1. Direct mock resolver for local development or empty databases
  if (mockArticles[articleId]) {
    console.log(
      `[ReadingAdvantageDB] Returning mock data for articleId: ${articleId}`,
    );
    return mockArticles[articleId];
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
    } catch (e: any) {
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
      console.warn(
        `[ReadingAdvantageDB] Article ${articleId} not found, falling back to mock art-001`,
      );
      return mockArticles["art-001"];
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
    } catch (e: any) {
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
    } catch (e: any) {
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

    return {
      ...article,
      multipleChoiceQuestions: mcqRes.rows,
      shortAnswerQuestions: saqRes.rows,
    };
  } catch (error) {
    console.error(
      "Error fetching article from Reading Advantage DB, falling back to mock art-001:",
      error,
    );
    return mockArticles["art-001"];
  }
};
