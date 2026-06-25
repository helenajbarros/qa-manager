import { execute } from "./connection";

export async function addBugsV150Fields(): Promise<void> {
  const cols = [
    ["os",           "TEXT"],
    ["browser",      "TEXT"],
    ["impact",       "TEXT"],
    ["evidence_url", "TEXT"],
  ];
  for (const [col, type] of cols) {
    try { await execute(`ALTER TABLE bugs ADD COLUMN IF NOT EXISTS ${col} ${type}`); }
    catch(_) {}
  }
  console.log("[DB] bugs v1.5.0 fields OK");
}