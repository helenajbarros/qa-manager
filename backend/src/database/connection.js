const path = require("path");
const fs   = require("fs");

// Usa o diretório injetado pelo server.js ou fallback local
function getDbPath() {
  const dir = process.env.QA_DATA_DIR || path.resolve(__dirname, "../../data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "qa_system.db");
}

let _db = null;
let _inTx = false;

function persist() {
  if (!_db || _inTx) return;
  fs.writeFileSync(getDbPath(), Buffer.from(_db.export()));
}

function norm(params) {
  if (!params.length) return undefined;
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function getMeta() {
  const stmt = _db.prepare("SELECT changes() AS c, last_insert_rowid() AS id");
  let row = { c: 0, id: 0 };
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

async function initDatabase() {
  if (_db) return;
  const SQL    = await require("sql.js")();
  const dbPath = getDbPath();
  _db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  _db.run("PRAGMA foreign_keys = ON;");
  console.log(`[DB] Banco em: ${dbPath}`);
}

function prepare(sql) {
  const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql);
  return {
    all(...params) {
      const args = norm(params);
      const stmt = _db.prepare(sql);
      const rows = [];
      if (args) stmt.bind(args);
      while (stmt.step()) rows.push(sanitize(stmt.getAsObject()));
      stmt.free();
      return rows;
    },
    get(...params) {
      const args = norm(params);
      const stmt = _db.prepare(sql);
      if (args) stmt.bind(args);
      const row = stmt.step() ? sanitize(stmt.getAsObject()) : undefined;
      stmt.free();
      return row;
    },
    run(...params) {
      const args = norm(params);
      _db.run(sql, args);
      const meta = getMeta();
      if (isWrite) persist();
      return { changes: meta.c, lastInsertRowid: meta.id };
    },
  };
}

function sanitize(obj) {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj))
    out[k] = typeof v === "bigint" ? Number(v) : v;
  return out;
}

const db = {
  prepare,
  exec(sql) { _db.run(sql); persist(); },
  pragma() {},
  transaction(fn) {
    return function (...args) {
      if (_inTx) return fn(...args);
      _inTx = true;
      _db.run("BEGIN;");
      try {
        const r = fn(...args);
        _db.run("COMMIT;");
        _inTx = false;
        persist();
        return r;
      } catch (e) {
        _inTx = false;
        try { _db.run("ROLLBACK;"); } catch (_) {}
        throw e;
      }
    };
  },
};

function exportDb() {
  if (!_db) throw new Error('Banco não inicializado');
  return Buffer.from(_db.export());
}

module.exports = { db, initDatabase, exportDb };
