/**
 * connection.js — sql.js (WebAssembly puro, sem compilação nativa)
 */
const path = require("path");
const fs   = require("fs");

const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_FILE  = path.join(DATA_DIR, "qa_system.db");
fs.mkdirSync(DATA_DIR, { recursive: true });

let _db            = null;
let _inTransaction = false;

function persist() {
  if (!_db || _inTransaction) return;
  fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
}

function norm(params) {
  if (!params.length) return undefined;
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

// Converte BigInt → Number e garante que objetos sejam plain JS
function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
}

function getMeta() {
  const stmt = _db.prepare("SELECT changes() AS c, last_insert_rowid() AS id");
  let row = { c: 0, id: 0 };
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return sanitize(row);
}

async function initDatabase() {
  if (_db) return;
  const SQL = await require("sql.js")();
  _db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();
  _db.run("PRAGMA foreign_keys = ON;");
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

let _inTx = false;

const db = {
  prepare,

  exec(sql) {
    _db.run(sql);
    persist();
  },

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

module.exports = { db, initDatabase };
