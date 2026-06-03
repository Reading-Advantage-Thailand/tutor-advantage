const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('SELECT * FROM "article" LIMIT 1');
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log("No articles found");
    }
  } catch (e) {
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
