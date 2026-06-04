const { Router } = require("express");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { pool } = require("../database/connection");
const multer = require("multer");
const router = Router();

// Info do banco
router.get("/info", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const tables = ["projects","users","modules","test_cases","test_cycles","test_executions","bugs","evidence_files"];
    const counts = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      counts[t] = r.rows[0].c;
    }
    res.json({ success: true, data: { size_kb: 0, counts, generated_at: new Date().toISOString() } });
  } catch(e) { next(e); }
});

// Download backup como SQL
router.get("/download", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const tables = ["projects","users","modules","test_cases","test_cycles","bugs","test_executions","evidence_files"];
    let sql = `-- QA Manager Backup\n-- ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
      const res2 = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      if (res2.rows.length === 0) continue;
      sql += `-- ${table}\n`;
      for (const row of res2.rows) {
        const cols = Object.keys(row).join(",");
        const vals = Object.values(row).map(v => {
          if (v === null) return "NULL";
          // Formata datas para ISO 8601 compatível com PostgreSQL
          if (v instanceof Date) return `'${v.toISOString().replace("T", " ").slice(0, 19)}'`;
          const s = String(v);
          // Detecta strings que parecem datas JS (ex: "Thu May 07 2026...")
          if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Za-z]{3}/.test(s)) {
            const d = new Date(s);
            if (!isNaN(d)) return `'${d.toISOString().replace("T", " ").slice(0, 19)}'`;
          }
          return `'${s.replace(/'/g, "''")}'`;
        }
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

// Restore via SQL
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50*1024*1024 } });
router.post("/restore", authenticate, requireAdmin, upload.single("backup"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "Arquivo obrigatório" });
    const sql = req.file.buffer.toString("utf8");
    const statements = sql.split("\n").filter(l => l.startsWith("INSERT INTO"));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const stmt of statements) {
        try { await client.query(stmt); } catch(e) { /* ignora conflitos */ }
      }
      await client.query("COMMIT");
    } catch(e) {
      await client.query("ROLLBACK");
      throw e;
    } finally { client.release(); }
    res.json({ success: true, data: { message: "Banco restaurado!", restored_at: new Date().toISOString() } });
  } catch(e) { next(e); }
});

module.exports = router;
