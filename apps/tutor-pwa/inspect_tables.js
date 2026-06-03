const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log("Tables:", res.rows.map(r => r.table_name));
  } catch (e) {
      console.error(e);
  } finally {
    await pool.end();
  }
}

run();
