const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('SELECT * FROM "article" LIMIT 1');
    if (res.rows.length > 0) {
      console.log("Keys:", Object.keys(res.rows[0]));
      if (res.rows[0].image_url) console.log("image_url:", res.rows[0].image_url);
    } else {
      console.log("No articles found");
    }
  } catch (e) {
      console.error(e);
  } finally {
    await pool.end();
  }
}

run();
