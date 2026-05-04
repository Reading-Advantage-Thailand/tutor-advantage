import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL_READING_ADVANTAGE || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}
const pool = new Pool({
  connectionString,
});

export const getArticleDetails = async (articleId: string) => {
  try {
    let res;
    try {
      res = await pool.query(
        `SELECT id, title, summary, passage, sentences, words, cefr_level, ra_level 
         FROM "article" 
         WHERE id = $1`,
        [articleId],
      );
    } catch (e: any) {
      if (e.code === '42P01') { // relation does not exist
        res = await pool.query(
          `SELECT id, title, summary, passage, sentences, words, cefr_level, ra_level 
           FROM "Article" 
           WHERE id = $1`,
          [articleId],
        );
      } else {
        throw e;
      }
    }

    if (res.rows.length === 0) return null;

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
      if (e.code === '42P01') {
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
      if (e.code === '42P01') {
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
    console.error("Error fetching article from Reading Advantage DB:", error);
    throw error;
  }
};
