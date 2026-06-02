const { query, execute, USE_PG } = require("./connection");

async function upgradeBugsTable() {
  if (USE_PG) {
    await query(`
      ALTER TABLE bugs ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER;
      ALTER TABLE bugs ADD COLUMN IF NOT EXISTS pr_url TEXT;
      ALTER TABLE bugs ADD COLUMN IF NOT EXISTS steps TEXT;

      CREATE TABLE IF NOT EXISTS bug_relations (
        id SERIAL PRIMARY KEY,
        bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
        related_bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
        UNIQUE(bug_id, related_bug_id)
      );

      CREATE TABLE IF NOT EXISTS bug_activity (
        id SERIAL PRIMARY KEY,
        bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
        user_id INTEGER,
        action TEXT NOT NULL,
        detail TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } else {
    await execute(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER`, []).catch(()=>{});
    await execute(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS pr_url TEXT`, []).catch(()=>{});
    await execute(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS steps TEXT`, []).catch(()=>{});
    await execute(`CREATE TABLE IF NOT EXISTS bug_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bug_id INTEGER NOT NULL,
      related_bug_id INTEGER NOT NULL,
      UNIQUE(bug_id, related_bug_id)
    )`, []).catch(()=>{});
    await execute(`CREATE TABLE IF NOT EXISTS bug_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bug_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, []).catch(()=>{});
  }
  console.log("[DB] bugs v2 OK");
}

module.exports = { upgradeBugsTable };
