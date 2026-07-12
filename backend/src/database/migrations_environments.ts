import { query, execute, USE_PG } from "./connection";

// Cria a tabela de ambientes customizados por projeto (project_environments)
// e a coluna bugs.environment_id que a referencia. Essas duas coisas já eram
// usadas por environmentsService.ts, bugsService.ts e dashboardService.ts,
// mas nenhuma migration chegou a criá-las — por isso /api/dashboard e as
// rotas de ambientes quebravam com "relation project_environments does not exist".
//
// Também aproveita para criar bugs.version, usada por bugsService.ts e
// dashboardService.ts (filtro/relatório por versão) mas que também nunca
// tinha sido criada por nenhuma migration ("column version does not exist").
export async function addEnvironmentsTable(): Promise<void> {
  if (USE_PG) {
    await query(`
      CREATE TABLE IF NOT EXISTS project_environments (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6B7280',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW());
    `);
    try { await execute("ALTER TABLE bugs ADD COLUMN IF NOT EXISTS environment_id INTEGER REFERENCES project_environments(id)"); } catch(_) {}
    try { await execute("ALTER TABLE bugs ADD COLUMN IF NOT EXISTS version TEXT"); } catch(_) {}
  } else {
    await execute(
      `CREATE TABLE IF NOT EXISTS project_environments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6B7280',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))`, []
    ).catch(()=>{});
    await execute(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS environment_id INTEGER`, []).catch(()=>{});
    await execute(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS version TEXT`, []).catch(()=>{});
  }
  console.log("[DB] environments OK");
}
