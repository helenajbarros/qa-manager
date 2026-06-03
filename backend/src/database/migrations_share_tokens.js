const { query, execute, USE_PG } = require("./connection");

async function addShareTokensTable() {
  if (USE_PG) {
    await query(`
      CREATE TABLE IF NOT EXISTS share_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
        created_by_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      );
    `);
  } else {
    await execute(`CREATE TABLE IF NOT EXISTS share_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      bug_id INTEGER NOT NULL,
      created_by_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    )`, []).catch(()=>{});
  }
  console.log("[DB] share_tokens OK");
}

module.exports = { addShareTokensTable };
