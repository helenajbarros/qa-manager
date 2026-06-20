const { query, execute } = require("./connection");

async function addNotificationsTable() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        TEXT NOT NULL,
        message     TEXT NOT NULL,
        link        TEXT,
        read        BOOLEAN DEFAULT false,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("[DB] notifications OK");
  } catch(e) { console.error("[DB] notifications error", e.message); }
}

module.exports = { addNotificationsTable };
