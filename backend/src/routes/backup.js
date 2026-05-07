const { Router } = require("express");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { db, exportDb } = require("../database/connection");
const path = require("path");
const fs   = require("fs");

const router = Router();

// GET /api/backup/download
router.get("/download", authenticate, requireAdmin, (req, res, next) => {
  try {
    const buffer   = exportDb();
    const filename = `qa_backup_${new Date().toISOString().slice(0,19).replace(/[:.]/g,"-")}.db`;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch(e) { next(e); }
});

// GET /api/backup/info
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

    let sizeKB = 0;
    try {
      const buf = exportDb();
      sizeKB = Math.round(buf.length / 1024);
    } catch(_) {}

    res.json({
      success: true,
      data: {
        size_kb:      sizeKB,
        counts,
        generated_at: new Date().toISOString(),
      }
    });
  } catch(e) { next(e); }
});

module.exports = router;
