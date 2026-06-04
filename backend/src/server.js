const express    = require("express");
const cors       = require("cors");
const path       = require("path");
const fs         = require("fs");
const rateLimit  = require("express-rate-limit");

const { initDatabase }  = require("./database/connection");
const { runMigrations } = require("./database/migrations");
const { addUserProjectsTable }    = require("./database/migrations_user_projects");
const { addBugCommentsTable }     = require("./database/migrations_bug_comments");
const { upgradeBugsTable }        = require("./database/migrations_bugs_v2");
const { addShareTokensTable }     = require("./database/migrations_share_tokens");
const { addDefaultProjectColumn } = require("./database/migrations_default_project");
const { addProjectsCreatorColumn }= require("./database/migrations_projects_creator");
const { runSeed }       = require("./database/seed");
const requestLogger     = require("./middlewares/requestLogger");
const errorHandler      = require("./middlewares/errorHandler");
const { authenticate }  = require("./middlewares/auth");

const UPLOAD_DIR = process.env.QA_UPLOAD_DIR || path.resolve(__dirname, "../uploads");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch(_) {}
process.env.QA_UPLOAD_DIR = UPLOAD_DIR;

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Rate Limiting ─────────────────────────────────────────────
// Login: máx 10 tentativas por 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// API geral: máx 300 requisições por minuto por IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { success: false, error: "Muitas requisições. Tente novamente em instantes." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());
app.use(requestLogger);
app.use("/uploads", express.static(UPLOAD_DIR));

// Aplica rate limit geral na API
app.use("/api", apiLimiter);

app.use("/api/users",                 require("./routes/userProjects"));
app.use("/api/users/login",           loginLimiter); // rate limit extra no login
app.use("/api/users",                 require("./routes/users"));
app.use("/api/projects",              require("./routes/projects"));
app.use("/api/modules",               require("./routes/modules"));
app.use("/api/test-cases",            require("./routes/testCases"));
app.use("/api/cycles",                require("./routes/cycles"));
app.use("/api/bugs/:bugId/comments",  require("./routes/bugComments"));
const shareRouter = require("./routes/shareRoutes");
app.use("/api", shareRouter);
app.use("/api/bugs",                  require("./routes/bugs"));
app.use("/api/dashboard",             authenticate, require("./routes/dashboard"));
app.use("/api/export",                authenticate, require("./routes/export"));
app.use("/api/backup",                require("./routes/backup"));

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime(), env: process.env.NODE_ENV })
);
app.use(errorHandler);

async function start() {
  await initDatabase();
  await runMigrations();
  await addUserProjectsTable();
  await addBugCommentsTable();
  await upgradeBugsTable();
  await addShareTokensTable();
  await addDefaultProjectColumn();
  await addProjectsCreatorColumn();
  await runSeed();
  app.listen(PORT, () => {
    console.log(`\n🚀 QA System rodando na porta ${PORT}`);
    console.log(`   DB: ${process.env.DATABASE_URL ? "PostgreSQL" : "SQLite"}\n`);
  });
}

start().catch(err => { console.error("Erro:", err); process.exit(1); });
