import { query, execute, USE_PG } from "./connection";
export async function addShareTokensTable(): Promise<void> {
  if (USE_PG) {
    await query(`CREATE TABLE IF NOT EXISTS share_tokens (
      id SERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE,
      bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
      created_by_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW(), expires_at TIMESTAMP);`);
  } else {
    await execute(`CREATE TABLE IF NOT EXISTS share_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE,
      bug_id INTEGER NOT NULL, created_by_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT)`, []).catch(()=>{});
  }
  console.log("[DB] share_tokens OK");
}
