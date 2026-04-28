import { Pool } from 'pg';

// Expecting DATABASE_URL_READING_ADVANTAGE in .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_READING_ADVANTAGE || "postgresql://postgres:password@localhost:5432/reading-advantage?schema=public",
});

export const getArticleDetails = async (articleId: string) => {
  try {
    const res = await pool.query(
      `SELECT id, title, summary, passage, sentences, words, cefr_level, ra_level 
       FROM article 
       WHERE id = $1`,
      [articleId]
    );

    if (res.rows.length === 0) return null;

    const article = res.rows[0];

    // Fetch Multiple Choice Questions for this article
    const mcqRes = await pool.query(
      `SELECT id, question, options, answer 
       FROM "MultipleChoiceQuestion" 
       WHERE article_id = $1`,
      [articleId]
    );

    // Fetch Short Answer Questions for this article
    const saqRes = await pool.query(
      `SELECT id, question, answer 
       FROM "ShortAnswerQuestion" 
       WHERE article_id = $1`,
      [articleId]
    );

    return {
      ...article,
      multipleChoiceQuestions: mcqRes.rows,
      shortAnswerQuestions: saqRes.rows
    };
  } catch (error) {
    console.error("Error fetching article from Reading Advantage DB:", error);
    throw error;
  }
};
