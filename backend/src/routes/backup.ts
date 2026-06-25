import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth";
import { dbPool } from "../database/connection";
import multer from "multer";
import type { AuthRequest } from "../types/index";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const TABLES = ["projects","users","modules","test_cases","test_cycles","bugs","test_executions","evidence_files"];

router.get("/info", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const counts: Record<string, number> = {};
    for (const t of [...TABLES, "user_projects"]) {
      const r2 = await dbPool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      counts[t] = (r2.rows[0] as any).c;
    }
    res.json({ success: true, data: { size_kb: 0, counts, generated_at: new Date().toISOString() } });
  } catch(e) { next(e); }
});

router.get("/download", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    let sql = `-- QA Manager Backup\n-- ${new Date().toISOString()}\n\n`;
    for (const table of TABLES) {
      const r2 = await dbPool.query(`SELECT * FROM ${table} ORDER BY id`);
      if (!r2.rows.length) continue;
      sql += `-- ${table}\n`;
      for (const row of r2.rows as any[]) {
        const cols = Object.keys(row).join(",");
        const vals = Object.values(row).map((v: any) =>
          v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`
        ).join(",");
        sql += `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
      }
      sql += "\n";
    }
    const filename = `qa_backup_${new Date().toISOString().slice(0,19).replace(/[:.]/g,"-")}.sql`;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(sql);
  } catch(e) { next(e); }
});

router.post("/restore", authenticate, requireAdmin, upload.single("backup"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: "Arquivo obrigatório" }); return; }
    const sql = req.file.buffer.toString("utf8");
    const statements = sql.split("\n").filter((l: string) => l.startsWith("INSERT INTO"));
    const client = await (dbPool as any).connect();
    try {
      await client.query("BEGIN");
      const delTables = ["evidence_files","test_executions","bugs","test_cycles","test_cases","modules","user_projects","users","projects"];
      for (const t of delTables) { try { await client.query(`DELETE FROM ${t}`); } catch(_) {} }
      for (const t of TABLES) { try { await client.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), 1, false)`); } catch(_) {} }
      for (const stmt of statements) { try { await client.query(stmt.replace(/ ON CONFLICT DO NOTHING/g, "")); } catch(_) {} }
      await client.query("COMMIT");
    } catch(e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
    res.json({ success: true, data: { message: "Banco restaurado!", restored_at: new Date().toISOString() } });
  } catch(e) { next(e); }
});

export default router;
