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

const app  = express();
const PORT = process.env.PORT || 3001;
const UPLOADS = path.resolve(__dirname, "../uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use("/uploads", express.static(UPLOADS));

app.use("/api/users",      require("./routes/users"));
app.use("/api/projects",   require("./routes/projects"));
app.use("/api/modules",    require("./routes/modules"));
app.use("/api/test-cases", require("./routes/testCases"));
app.use("/api/cycles",     require("./routes/cycles"));
app.use("/api/bugs",       require("./routes/bugs"));
app.use("/api/dashboard",  authenticate, require("./routes/dashboard"));
app.use("/api/export",     authenticate, require("./routes/export"));

app.get("/api/health", (_req, res) => res.json({ status:"ok", uptime: process.uptime() }));
app.use(errorHandler);

async function start() {
  await initDatabase();
  runMigrations();
  runSeed();
  app.listen(PORT, () => {
    console.log(`\n🚀 QA System rodando em http://localhost:${PORT}`);
    console.log(`   Login: admin@qa.com / admin123\n`);
  });
}
start().catch(err => { console.error("Erro:", err); process.exit(1); });
