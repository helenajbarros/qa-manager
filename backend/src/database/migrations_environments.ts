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
    try { await execute(BACKFILL_SQL); } catch(_) {}
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
    await execute(BACKFILL_SQL, []).catch(()=>{});
  }
  console.log("[DB] environments OK");
}

// Vincula bugs antigos (que só têm o texto livre em bugs.environment) ao
// ambiente customizado correspondente em project_environments, comparando o
// nome (ignorando maiúsculas/acentos comuns e os tokens legados em inglês).
// Só toca em bugs com environment_id ainda nulo — roda em todo boot sem
// duplicar nem sobrescrever vínculos já existentes.
const BACKFILL_SQL = `
  UPDATE bugs SET environment_id = (
    SELECT pe.id FROM project_environments pe
    WHERE pe.project_id = bugs.project_id
      AND (
        LOWER(TRIM(pe.name)) = LOWER(TRIM(bugs.environment))
        OR (LOWER(TRIM(bugs.environment)) IN ('production','prod') AND LOWER(TRIM(pe.name)) IN ('produção','producao'))
        OR (LOWER(TRIM(bugs.environment)) IN ('staging','stage') AND LOWER(TRIM(pe.name)) = 'staging')
        OR (LOWER(TRIM(bugs.environment)) IN ('homologation','homolog') AND LOWER(TRIM(pe.name)) IN ('homologação','homologacao'))
        OR (LOWER(TRIM(bugs.environment)) IN ('development','dev') AND LOWER(TRIM(pe.name)) = 'desenvolvimento')
      )
    LIMIT 1
  )
  WHERE environment_id IS NULL AND environment IS NOT NULL AND TRIM(environment) != ''
`;
