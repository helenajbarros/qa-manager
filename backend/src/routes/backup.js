const { Router } = require("express");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { db } = require("../database/connection");
const path = require("path");
const fs   = require("fs");

const router = Router();

// GET /api/backup/download — baixa o arquivo .db direto
router.get("/download", authenticate, requireAdmin, (req, res, next) => {
  try {
    const data     = db.export();
    const buffer   = Buffer.from(data);
    const filename = `qa_backup_${new Date().toISOString().slice(0,19).replace(/[:.]/g,"-")}.db`;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch(e) { next(e); }
});

// GET /api/backup/info — info do banco
router.get("/info", authenticate, requireAdmin, (req, res, next) => {
  try {
    const counts = {
      projects:        db.prepare("SELECT COUNT(*) AS c FROM projects").get().c,
      users:           db.prepare("SELECT COUNT(*) AS c FROM users").get().c,
      modules:         db.prepare("SELECT COUNT(*) AS c FROM modules").get().c,
      test_cases:      db.prepare("SELECT COUNT(*) AS c FROM test_cases").get().c,
      test_cycles:     db.prepare("SELECT COUNT(*) AS c FROM test_cycles").get().c,
      test_executions: db.prepare("SELECT COUNT(*) AS c FROM test_executions").get().c,
      bugs:            db.prepare("SELECT COUNT(*) AS c FROM bugs").get().c,
      evidence_files:  db.prepare("SELECT COUNT(*) AS c FROM evidence_files").get().c,
    };

    const dbPath = process.env.QA_DATA_DIR
      ? path.join(process.env.QA_DATA_DIR, "qa_system.db")
      : path.resolve(__dirname, "../../data/qa_system.db");

    let sizeKB = 0;
    try {
      const stat = fs.statSync(dbPath);
      sizeKB = Math.round(stat.size / 1024);
    } catch(_) {
      // Em memória (sql.js) — estima pelo export
      sizeKB = Math.round(db.export().length / 1024);
    }

    res.json({
      success: true,
      data: {
        size_kb:    sizeKB,
        counts,
        generated_at: new Date().toISOString(),
      }
    });
  } catch(e) { next(e); }
});

module.exports = router;
