import { query, execute, USE_PG } from "./connection";
/** Configurações do sistema (chave → valor). Usada pela integração com o ClickUp (token criptografado, lista, webhook). */
export async function addSettingsTable(): Promise<void> {
  if (USE_PG) {
    await query(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP NOT NULL DEFAULT NOW());`);
  } else {
    await execute(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`, []).catch(() => {});
  }
  // responsável vindo do ClickUp que ainda não tem usuário no QA Manager (só o nome, para aparecer na tela)
  if (USE_PG) await query(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS clickup_assignee TEXT;`).catch(() => {});
  else await execute(`ALTER TABLE bugs ADD COLUMN clickup_assignee TEXT`, []).catch(() => {});
  console.log("[DB] app_settings OK");
}
