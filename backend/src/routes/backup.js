const { Router } = require("express");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { db, exportDb, initDatabase } = require("../database/connection");
const { runMigrations } = require("../database/migrations");
const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

const router = Router();

// Multer em memória para receber o .db
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith(".db")) cb(null, true);
    else cb(new Error("Apenas arquivos .db são aceitos"));
  },
});

// ── GET /api/backup/info ─────────────────────────────────────
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
    try { sizeKB = Math.round(exportDb().length / 1024); } catch(_) {}

    res.json({
      success: true,
      data: { size_kb: sizeKB, counts, generated_at: new Date().toISOString() },
    });
  } catch(e) { next(e); }
});

// ── GET /api/backup/download ─────────────────────────────────
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

// ── POST /api/backup/restore ─────────────────────────────────
router.post("/restore", authenticate, requireAdmin, upload.single("backup"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "Arquivo .db obrigatório" });

    const dbPath = path.join(
      process.env.QA_DATA_DIR || path.resolve(__dirname, "../../data"),
      "qa_system.db"
    );

    // Salva backup do banco atual antes de sobrescrever
    const safetyPath = dbPath.replace(".db", `_before_restore_${Date.now()}.db`);
    try {
      const current = exportDb();
      fs.writeFileSync(safetyPath, current);
    } catch(_) {}

    // Salva o novo banco em disco
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, req.file.buffer);

    // Reinicializa a conexão com o novo banco
    await initDatabase(true); // force reload
    runMigrations();

    res.json({
      success: true,
      data: {
        message:  "Banco restaurado com sucesso!",
        size_kb:  Math.round(req.file.buffer.length / 1024),
        restored_at: new Date().toISOString(),
      },
    });
  } catch(e) { next(e); }
});

module.exports = router;
