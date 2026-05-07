/**
 * connection.js — sql.js (WebAssembly puro, sem compilação nativa)
 * Zero dependências nativas — funciona no Windows sem Visual Studio.
 */
const path = require("path");
const fs   = require("fs");

const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_FILE  = path.join(DATA_DIR, "qa_system.db");
fs.mkdirSync(DATA_DIR, { recursive: true });

let _db            = null;
let _inTransaction = false;

// Salva o banco em disco — só fora de transações ativas
function persist() {
  if (!_db || _inTransaction) return;
  fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
}

// Normaliza parâmetros: run(a,b,c) ou run([a,b,c])
function norm(params) {
  if (!params.length) return undefined;
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

// Lê changes() e last_insert_rowid() com a API correta do sql.js
function getMeta() {
  const stmt = _db.prepare("SELECT changes() AS c, last_insert_rowid() AS id");
  let row = { c: 0, id: 0 };
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

// ── Inicialização (assíncrona, chamada uma vez em server.js) ─────────────────

async function initDatabase() {
  if (_db) return;
  const SQL = await require("sql.js")();
  _db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();
  _db.run("PRAGMA foreign_keys = ON;");
}

// ── API compatível com better-sqlite3 ───────────────────────────────────────

function prepare(sql) {
  const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql);

  return {
    all(...params) {
      const stmt = _db.prepare(sql);
      const rows = [];
      const args = norm(params);
      if (args) stmt.bind(args);
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },

    get(...params) {
      const stmt = _db.prepare(sql);
      const args = norm(params);
      if (args) stmt.bind(args);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },

    run(...params) {
      const args = norm(params);
      _db.run(sql, args);
      const meta = getMeta();
      if (isWrite) persist();   // só persiste se não estiver em transação
      return { changes: meta.c, lastInsertRowid: meta.id };
    },
  };
}

const db = {
  prepare,

  exec(sql) {
    _db.run(sql);
    persist();
  },

  pragma() {}, // pragmas já definidos no initDatabase

  /**
   * Emula db.transaction(fn)() do better-sqlite3.
   * Transações aninhadas são ignoradas (reutiliza a transação pai).
   */
  transaction(fn) {
    return function (...args) {
      if (_inTransaction) {
        // Transação aninhada: executa direto sem novo BEGIN
        return fn(...args);
      }

      _inTransaction = true;
      _db.run("BEGIN;");
      try {
        const result = fn(...args);
        _db.run("COMMIT;");
        _inTransaction = false;
        persist(); // persiste uma única vez ao final
        return result;
      } catch (err) {
        try { _db.run("ROLLBACK;"); } catch (_) {}
        _inTransaction = false;
        throw err;
      }
    };
  },
};

module.exports = { db, initDatabase };
