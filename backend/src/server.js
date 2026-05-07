const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

const { initDatabase }  = require("./database/connection");
const { runMigrations } = require("./database/migrations");
const { runSeed }       = require("./database/seed");
const requestLogger     = require("./middlewares/requestLogger");
const errorHandler      = require("./middlewares/errorHandler");
const { authenticate }  = require("./middlewares/auth");

// Railway fornece /data como volume persistente
// Localmente usa ./data e ./uploads
const IS_PROD    = process.env.NODE_ENV === "production";
const DATA_DIR   = IS_PROD ? "/data"         : path.resolve(__dirname, "../data");
const UPLOAD_DIR = IS_PROD ? "/data/uploads" : path.resolve(__dirname, "../uploads");

fs.mkdirSync(DATA_DIR,   { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Injeta os caminhos para os módulos que precisam
process.env.QA_DATA_DIR   = DATA_DIR;
process.env.QA_UPLOAD_DIR = UPLOAD_DIR;

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger);
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/users",      require("./routes/users"));
app.use("/api/projects",   require("./routes/projects"));
app.use("/api/modules",    require("./routes/modules"));
app.use("/api/test-cases", require("./routes/testCases"));
app.use("/api/cycles",     require("./routes/cycles"));
app.use("/api/bugs",       require("./routes/bugs"));
app.use("/api/dashboard",  authenticate, require("./routes/dashboard"));
app.use("/api/export",     authenticate, require("./routes/export"));
app.use("/api/backup",     require("./routes/backup"));

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime(), env: process.env.NODE_ENV })
);

app.use(errorHandler);

async function start() {
  await initDatabase();
  runMigrations();
  runSeed();
  app.listen(PORT, () => {
    console.log(`\n🚀 QA System rodando na porta ${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
    console.log(`   Dados em: ${DATA_DIR}\n`);
  });
}

start().catch(err => {
  console.error("Erro ao iniciar:", err);
  process.exit(1);
});
