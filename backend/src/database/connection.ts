import path from "path";
import fs   from "fs";

const USE_PG = !!process.env.DATABASE_URL;
let pool: any = null;
let _db:  any = null;

async function initPg(): Promise<void> {
  const { Pool } = await import("pg");
  const poolConfig = process.env.DB_HOST ? {
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "postgres",
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  } : {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  };
  pool = new Pool(poolConfig);
  const client = await pool.connect();
  try { await client.query("SELECT 1"); console.log("[DB] Conectado ao PostgreSQL!"); }
  finally { client.release(); }
}

async function initSqlite(): Promise<void> {
  const SQL = await (require("sql.js"))();
  const dir = path.resolve(__dirname, "../../data");
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "qa_system.db");
  _db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  _db.run("PRAGMA foreign_keys = ON;");
  console.log(`[DB] SQLite em: ${dbPath}`);
}

export async function initDatabase(): Promise<void> {
  if (USE_PG) await initPg(); else await initSqlite();
}

function persist(): void {
  if (!_db) return;
  const dir = path.resolve(__dirname, "../../data");
  fs.writeFileSync(path.join(dir, "qa_system.db"), Buffer.from(_db.export()));
}

function toSqlite(sql: string): string { return sql.replace(/\$\d+/g, "?"); }

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k,v] of Object.entries(obj)) out[k] = typeof v === "bigint" ? Number(v) : v;
  return out;
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (USE_PG) { const res = await pool.query(sql, params); return res.rows as T[]; }
  const stmt = _db.prepare(toSqlite(sql));
  const rows: T[] = [];
  if (params.length) stmt.bind(params);
  while (stmt.step()) rows.push(sanitize(stmt.getAsObject()) as T);
  stmt.free();
  return rows;
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

interface ExecuteResult { changes: number; lastInsertRowid: number | null; }

export async function execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
  if (USE_PG) {
    const res = await pool.query(sql, params);
    return { changes: res.rowCount, lastInsertRowid: (res.rows[0] as any)?.id ?? null };
  }
  _db.run(toSqlite(sql), params);
  const s = _db.prepare("SELECT changes() AS c, last_insert_rowid() AS id");
  let r = {c:0,id:0}; if (s.step()) r = s.getAsObject(); s.free();
  persist();
  return { changes: r.c, lastInsertRowid: r.id };
}

export function exportDb(): Buffer {
  if (USE_PG) throw new Error("Use pg_dump para exportar PostgreSQL");
  return Buffer.from(_db.export());
}

export const dbPool = {
  query: async (sql: string, params: unknown[] = []) => {
    if (USE_PG) return pool.query(sql, params);
    const rows = await query(sql, params);
    return { rows, rowCount: rows.length };
  },
};

export { USE_PG };