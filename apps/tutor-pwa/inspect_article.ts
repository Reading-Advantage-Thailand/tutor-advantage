import { Pool } from "pg";

async function run() {
  const connectionString = process.env.DATABASE_URL_READING_ADVANTAGE || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No connection string");
    return;
  }
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query('SELECT * FROM "article" LIMIT 1');
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log("No articles found");
    }
  } catch (e: any) {
    if (e.code === '42P01') {
      const res = await pool.query('SELECT * FROM "Article" LIMIT 1');
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.error(e);
    }
  } finally {
    await pool.end();
  }
}

run();
