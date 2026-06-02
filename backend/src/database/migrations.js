const { pool, USE_PG, execute } = require("./connection");

async function runMigrations() {
  if (USE_PG) {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
          logo_url TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer',
          active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS modules (
          id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
          description TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(project_id,name));
        CREATE TABLE IF NOT EXISTS test_cases (
          id SERIAL PRIMARY KEY, module_id INTEGER NOT NULL, title TEXT NOT NULL,
          description TEXT, preconditions TEXT, steps TEXT, expected_result TEXT,
          priority TEXT NOT NULL DEFAULT 'medium', assigned_to_id INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS test_cycles (
          id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
          description TEXT, version TEXT, test_types TEXT, start_date TEXT, end_date TEXT,
          status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS bugs (
          id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL DEFAULT 1, title TEXT NOT NULL,
          description TEXT, comment TEXT, tracker_url TEXT,
          severity TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'open',
          module_id INTEGER, test_case_id INTEGER, created_by_id INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS test_executions (
          id SERIAL PRIMARY KEY, cycle_id INTEGER NOT NULL, test_case_id INTEGER NOT NULL,
          executed_by_id INTEGER, assigned_to_id INTEGER,
          status TEXT NOT NULL DEFAULT 'not_executed', evidence_url TEXT,
          evidence_files TEXT, comment TEXT, bug_id INTEGER, notes TEXT,
          executed_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(cycle_id,test_case_id));
        CREATE TABLE IF NOT EXISTS evidence_files (
          id SERIAL PRIMARY KEY, ref_type TEXT NOT NULL DEFAULT 'execution',
          ref_id INTEGER NOT NULL, filename TEXT NOT NULL, originalname TEXT NOT NULL,
          mimetype TEXT NOT NULL, size INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW());
      `);

      // Corrige constraint de role para incluir 'manager'
      await client.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('admin','manager','editor','viewer'));
      `);

    } finally { client.release(); }
  } else {
    // SQLite
    const tables = [
      `CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, logo_url TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS modules (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(project_id,name))`,
      `CREATE TABLE IF NOT EXISTS test_cases (id INTEGER PRIMARY KEY AUTOINCREMENT, module_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, preconditions TEXT, steps TEXT, expected_result TEXT, priority TEXT NOT NULL DEFAULT 'medium', assigned_to_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS test_cycles (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, description TEXT, version TEXT, test_types TEXT, start_date TEXT, end_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS bugs (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL DEFAULT 1, title TEXT NOT NULL, description TEXT, comment TEXT, tracker_url TEXT, severity TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'open', module_id INTEGER, test_case_id INTEGER, created_by_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS test_executions (id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_id INTEGER NOT NULL, test_case_id INTEGER NOT NULL, executed_by_id INTEGER, assigned_to_id INTEGER, status TEXT NOT NULL DEFAULT 'not_executed', evidence_url TEXT, evidence_files TEXT, comment TEXT, bug_id INTEGER, notes TEXT, executed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(cycle_id,test_case_id))`,
      `CREATE TABLE IF NOT EXISTS evidence_files (id INTEGER PRIMARY KEY AUTOINCREMENT, ref_type TEXT NOT NULL DEFAULT 'execution', ref_id INTEGER NOT NULL, filename TEXT NOT NULL, originalname TEXT NOT NULL, mimetype TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    ];
    for (const sql of tables) await execute(sql, []);
  }
  console.log("[DB] Migrations OK.");
}

module.exports = { runMigrations };