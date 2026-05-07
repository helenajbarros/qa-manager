const { db } = require("./connection");

function runMigrations() {
  db.exec(`
    -- ── Módulos ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS modules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Casos de Teste ───────────────────────────────────────
    CREATE TABLE IF NOT EXISTS test_cases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id       INTEGER NOT NULL,
      title           TEXT    NOT NULL,
      description     TEXT,
      preconditions   TEXT,
      steps           TEXT,
      expected_result TEXT,
      priority        TEXT    NOT NULL DEFAULT 'medium'
                        CHECK(priority IN ('low','medium','high','critical')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    -- ── Ciclos de Teste ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS test_cycles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active','completed','archived')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Execuções ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS test_executions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id     INTEGER NOT NULL,
      test_case_id INTEGER NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'not_executed'
                     CHECK(status IN ('passed','failed','blocked','not_executed')),
      evidence     TEXT,
      bug_id       INTEGER,
      notes        TEXT,
      executed_at  TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (cycle_id, test_case_id),
      FOREIGN KEY (cycle_id)     REFERENCES test_cycles(id) ON DELETE CASCADE,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
      FOREIGN KEY (bug_id)       REFERENCES bugs(id)        ON DELETE SET NULL
    );

    -- ── Bugs ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS bugs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      severity    TEXT NOT NULL DEFAULT 'medium'
                    CHECK(severity IN ('low','medium','high','critical')),
      status      TEXT NOT NULL DEFAULT 'open'
                    CHECK(status IN ('open','in_progress','fixed','closed')),
      module_id   INTEGER,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL
    );
  `);

  console.log("[DB] Migrations executadas com sucesso.");
}

module.exports = { runMigrations };
