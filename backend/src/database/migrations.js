const { pool } = require("./connection");

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        description TEXT,
        logo_url    TEXT,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL UNIQUE,
        password   TEXT NOT NULL,
        role       TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','editor','viewer')),
        active     INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS modules (
        id          SERIAL PRIMARY KEY,
        project_id  INTEGER NOT NULL DEFAULT 1,
        name        TEXT NOT NULL,
        description TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, name),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS test_cases (
        id              SERIAL PRIMARY KEY,
        module_id       INTEGER NOT NULL,
        title           TEXT NOT NULL,
        description     TEXT,
        preconditions   TEXT,
        steps           TEXT,
        expected_result TEXT,
        priority        TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
        assigned_to_id  INTEGER,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS test_cycles (
        id          SERIAL PRIMARY KEY,
        project_id  INTEGER NOT NULL DEFAULT 1,
        name        TEXT NOT NULL,
        description TEXT,
        version     TEXT,
        test_types  TEXT,
        start_date  TEXT,
        end_date    TEXT,
        status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','archived')),
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS bugs (
        id             SERIAL PRIMARY KEY,
        project_id     INTEGER NOT NULL DEFAULT 1,
        title          TEXT NOT NULL,
        description    TEXT,
        comment        TEXT,
        tracker_url    TEXT,
        severity       TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
        status         TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','fixed','closed')),
        module_id      INTEGER,
        test_case_id   INTEGER,
        created_by_id  INTEGER,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (project_id)    REFERENCES projects(id)    ON DELETE CASCADE,
        FOREIGN KEY (module_id)     REFERENCES modules(id)     ON DELETE SET NULL,
        FOREIGN KEY (test_case_id)  REFERENCES test_cases(id)  ON DELETE SET NULL,
        FOREIGN KEY (created_by_id) REFERENCES users(id)       ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS test_executions (
        id             SERIAL PRIMARY KEY,
        cycle_id       INTEGER NOT NULL,
        test_case_id   INTEGER NOT NULL,
        executed_by_id INTEGER,
        assigned_to_id INTEGER,
        status         TEXT NOT NULL DEFAULT 'not_executed' CHECK(status IN ('passed','failed','blocked','not_executed')),
        evidence_url   TEXT,
        evidence_files TEXT,
        comment        TEXT,
        bug_id         INTEGER,
        notes          TEXT,
        executed_at    TIMESTAMP,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (cycle_id, test_case_id),
        FOREIGN KEY (cycle_id)       REFERENCES test_cycles(id) ON DELETE CASCADE,
        FOREIGN KEY (test_case_id)   REFERENCES test_cases(id)  ON DELETE CASCADE,
        FOREIGN KEY (executed_by_id) REFERENCES users(id)       ON DELETE SET NULL,
        FOREIGN KEY (assigned_to_id) REFERENCES users(id)       ON DELETE SET NULL,
        FOREIGN KEY (bug_id)         REFERENCES bugs(id)        ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS evidence_files (
        id           SERIAL PRIMARY KEY,
        ref_type     TEXT NOT NULL DEFAULT 'execution',
        ref_id       INTEGER NOT NULL,
        filename     TEXT NOT NULL,
        originalname TEXT NOT NULL,
        mimetype     TEXT NOT NULL,
        size         INTEGER NOT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("[DB] Migrations executadas com sucesso.");
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
