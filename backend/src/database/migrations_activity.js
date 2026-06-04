// Migration: tabelas de histórico para casos de teste e ciclos
const { query, execute, USE_PG } = require("./connection");

async function addActivityTables() {
  if (USE_PG) {
    await query(`
      CREATE TABLE IF NOT EXISTS test_case_activity (
        id SERIAL PRIMARY KEY,
        test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
        user_id INTEGER,
        action TEXT NOT NULL,
        detail TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cycle_activity (
        id SERIAL PRIMARY KEY,
        cycle_id INTEGER NOT NULL REFERENCES test_cycles(id) ON DELETE CASCADE,
        user_id INTEGER,
        action TEXT NOT NULL,
        detail TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } else {
    await execute(`CREATE TABLE IF NOT EXISTS test_case_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, []).catch(()=>{});

    await execute(`CREATE TABLE IF NOT EXISTS cycle_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, []).catch(()=>{});
  }
  console.log("[DB] activity tables OK");
}

module.exports = { addActivityTables };
