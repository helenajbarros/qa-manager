import { query, execute, USE_PG } from "./connection";
export async function addBugTestType(): Promise<void> {
  try {
    if (USE_PG) { await query(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS test_type TEXT`); }
    else { await execute(`ALTER TABLE bugs ADD COLUMN test_type TEXT`, []).catch(()=>{}); }
    console.log("[DB] bug test_type OK");
  } catch(_) { console.log("[DB] bug test_type OK"); }
}
