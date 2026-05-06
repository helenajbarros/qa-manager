const { db } = require("./connection");

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      logo_url    TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','editor','viewer')),
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS modules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL DEFAULT 1,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS test_cases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id       INTEGER NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      preconditions   TEXT,
      steps           TEXT,
      expected_result TEXT,
      priority        TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      assigned_to_id  INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (module_id)      REFERENCES modules(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to_id) REFERENCES users(id)   ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS test_cycles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL DEFAULT 1,
      name        TEXT NOT NULL,
      description TEXT,
      version     TEXT,
      test_types  TEXT,
      start_date  TEXT,
      end_date    TEXT,
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','archived')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS test_executions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
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
      executed_at    TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (cycle_id, test_case_id),
      FOREIGN KEY (cycle_id)       REFERENCES test_cycles(id) ON DELETE CASCADE,
      FOREIGN KEY (test_case_id)   REFERENCES test_cases(id)  ON DELETE CASCADE,
      FOREIGN KEY (executed_by_id) REFERENCES users(id)       ON DELETE SET NULL,
      FOREIGN KEY (assigned_to_id) REFERENCES users(id)       ON DELETE SET NULL,
      FOREIGN KEY (bug_id)         REFERENCES bugs(id)        ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS bugs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id)    REFERENCES projects(id)    ON DELETE CASCADE,
      FOREIGN KEY (module_id)     REFERENCES modules(id)     ON DELETE SET NULL,
      FOREIGN KEY (test_case_id)  REFERENCES test_cases(id)  ON DELETE SET NULL,
      FOREIGN KEY (created_by_id) REFERENCES users(id)       ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS evidence_files (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_type     TEXT NOT NULL DEFAULT 'execution',
      ref_id       INTEGER NOT NULL,
      filename     TEXT NOT NULL,
      originalname TEXT NOT NULL,
      mimetype     TEXT NOT NULL,
      size         INTEGER NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const sa = (t, c, tp) => {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(x => x.name);
    if (!cols.includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${tp}`);
  };
  sa('projects',        'logo_url',       'TEXT');
  sa('modules',         'project_id',     'INTEGER NOT NULL DEFAULT 1');
  sa('test_cases',      'assigned_to_id', 'INTEGER');
  sa('test_cycles',     'project_id',     'INTEGER NOT NULL DEFAULT 1');
  sa('test_cycles',     'version',        'TEXT');
  sa('test_cycles',     'test_types',     'TEXT');
  sa('test_cycles',     'start_date',     'TEXT');
  sa('test_cycles',     'end_date',       'TEXT');
  sa('test_executions', 'comment',        'TEXT');
  sa('test_executions', 'evidence_url',   'TEXT');
  sa('test_executions', 'evidence_files', 'TEXT');
  sa('test_executions', 'executed_by_id', 'INTEGER');
  sa('test_executions', 'assigned_to_id', 'INTEGER');
  sa('bugs',            'comment',        'TEXT');
  sa('bugs',            'tracker_url',    'TEXT');
  sa('bugs',            'test_case_id',   'INTEGER');
  sa('bugs',            'project_id',     'INTEGER NOT NULL DEFAULT 1');
  sa('bugs',            'created_by_id',  'INTEGER');

  console.log("[DB] Migrations OK");
}
module.exports = { runMigrations };
