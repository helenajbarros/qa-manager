const express = require("express");
const cors    = require("cors");

const { initDatabase }  = require("./database/connection");
const { runMigrations } = require("./database/migrations");
const { runSeed }       = require("./database/seed");
const requestLogger     = require("./middlewares/requestLogger");
const errorHandler      = require("./middlewares/errorHandler");

const modulesRouter    = require("./routes/modules");
const testCasesRouter  = require("./routes/testCases");
const cyclesRouter     = require("./routes/cycles");
const bugsRouter       = require("./routes/bugs");
const dashboardRouter  = require("./routes/dashboard");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use("/api/modules",    modulesRouter);
app.use("/api/test-cases", testCasesRouter);
app.use("/api/cycles",     cyclesRouter);
app.use("/api/bugs",       bugsRouter);
app.use("/api/dashboard",  dashboardRouter);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() })
);

app.use(errorHandler);

// Inicializa o banco de forma assíncrona e só então sobe o servidor
async function start() {
  await initDatabase();   // carrega sql.js WASM
  runMigrations();        // cria tabelas
  runSeed();              // insere dados de exemplo

  app.listen(PORT, () => {
    console.log(`\n🚀  QA System API rodando em http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
