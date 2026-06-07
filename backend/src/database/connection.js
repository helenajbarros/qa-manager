const path = require("path");
const fs   = require("fs");

const USE_PG = !!process.env.DATABASE_URL;
let pool = null;
let _db  = null;

// ── PostgreSQL ────────────────────────────────────────────────
async function initPg() {
  const { Pool } = require("pg");
  // Suporta DATABASE_URL ou variáveis separadas (para Supabase com username com ponto)
  let poolConfig;
  if (process.env.DB_HOST) {
    poolConfig = {
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "postgres",
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    };
  } else {
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    };
  }
  pool = new Pool(poolConfig);
  const client = await pool.connect();
  try { await client.query("SELECT 1"); console.log("[DB] Conectado ao PostgreSQL!"); }
  finally { client.release(); }
}

// ── SQLite ────────────────────────────────────────────────────
async function initSqlite() {
  const SQL    = await require("sql.js")();
  const dir    = path.resolve(__dirname, "../../data");
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "qa_system.db");
  _db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  _db.run("PRAGMA foreign_keys = ON;");
  console.log(`[DB] SQLite em: ${dbPath}`);
}

async function initDatabase() {
  if (USE_PG) await initPg();
  else        await initSqlite();
}

function persist() {
  if (!_db) return;
  const dir = path.resolve(__dirname, "../../data");
  fs.writeFileSync(path.join(dir, "qa_system.db"), Buffer.from(_db.export()));
}

// ── Converte $1,$2... → ? para SQLite ────────────────────────
function toSqlite(sql) {
  return sql.replace(/\$\d+/g, "?");
}

// ── Interface unificada ───────────────────────────────────────
async function query(sql, params = []) {
  if (USE_PG) {
    const res = await pool.query(sql, params);
    return res.rows;
  }
  // SQLite
  const stmt = _db.prepare(toSqlite(sql));
  const rows = [];
  if (params.length) stmt.bind(params);
  while (stmt.step()) rows.push(sanitize(stmt.getAsObject()));
  stmt.free();
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0];
}

async function execute(sql, params = []) {
  if (USE_PG) {
    const res = await pool.query(sql, params);
    return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id ?? null };
  }
  _db.run(toSqlite(sql), params);
  const s = _db.prepare("SELECT changes() AS c, last_insert_rowid() AS id");
  let r = {c:0,id:0}; if (s.step()) r = s.getAsObject(); s.free();
  persist();
  return { changes: r.c, lastInsertRowid: r.id };
}

function sanitize(obj) {
  if (!obj) return obj;
  const out = {};
  for (const [k,v] of Object.entries(obj)) out[k] = typeof v==="bigint"?Number(v):v;
  return out;
}

function exportDb() {
  if (USE_PG) throw new Error("Use pg_dump para exportar PostgreSQL");
  return Buffer.from(_db.export());
}

// pool compatível — usado pelos services via pool.query()
const dbPool = {
  query: async (sql, params=[]) => {
    if (USE_PG) return pool.query(sql, params);
    const rows = await query(sql, params);
    return { rows, rowCount: rows.length };
  },
  connect: async () => {
    if (USE_PG) return pool.connect();
    // SQLite fake client
    return {
      query: async (sql, params=[]) => { const rows=await query(sql,params); return {rows,rowCount:rows.length}; },
      release: ()=>{},
    };
  },
};

module.exports = { pool: dbPool, initDatabase, query, queryOne, execute, exportDb, USE_PG };
