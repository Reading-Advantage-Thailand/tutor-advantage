const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('SELECT * FROM "article" LIMIT 1');
    if (res.rows.length > 0) {
      console.log("Type of lesson_phase_1:", typeof res.rows[0].lesson_phase_1);
      if (typeof res.rows[0].lesson_phase_1 === 'string') {
        const parsed = JSON.parse(res.rows[0].lesson_phase_1);
        console.log("Parsed image_url:", parsed.image_url);
      } else if (res.rows[0].lesson_phase_1) {
        console.log("Object image_url:", res.rows[0].lesson_phase_1.image_url);
      }
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
