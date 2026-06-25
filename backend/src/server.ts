import "dotenv/config";
import express       from "express";
import cors          from "cors";
import path          from "path";
import fs            from "fs";
import rateLimit     from "express-rate-limit";

import { initDatabase }           from "./database/connection";
import { runMigrations }          from "./database/migrations";
import { addUserProjectsTable }   from "./database/migrations_user_projects";
import { addBugCommentsTable }    from "./database/migrations_bug_comments";
import { upgradeBugsTable }       from "./database/migrations_bugs_v2";
import { addShareTokensTable }    from "./database/migrations_share_tokens";
import { addDefaultProjectColumn }from "./database/migrations_default_project";
import { addProjectsCreatorColumn }from "./database/migrations_projects_creator";
import { addActivityTables }      from "./database/migrations_activity";
import { addBugTestType }         from "./database/migrations_bug_test_type";
import { addNotificationsTable }  from "./database/migrations_notifications";
import { addBugsV150Fields }       from "./database/migrations_bugs_v150";
import { runSeed }                from "./database/seed";
import requestLogger              from "./middlewares/requestLogger";
import errorHandler               from "./middlewares/errorHandler";
import { authenticate }           from "./middlewares/auth";

import bugsRouter         from "./routes/bugs";
import modulesRouter      from "./routes/modules";
import testCasesRouter    from "./routes/testCases";
import cyclesRouter       from "./routes/cycles";
import projectsRouter     from "./routes/projects";
import usersRouter        from "./routes/users";
import dashboardRouter    from "./routes/dashboard";
import bugCommentsRouter  from "./routes/bugComments";
import notificationsRouter from "./routes/notifications";
import userProjectsRouter from "./routes/userProjects";
import exportRouter       from "./routes/export";
import shareRouter        from "./routes/shareRoutes";
import backupRouter       from "./routes/backup";

const UPLOAD_DIR = process.env.QA_UPLOAD_DIR || path.resolve(__dirname, "../uploads");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch(_) {}
process.env.QA_UPLOAD_DIR = UPLOAD_DIR;

const app  = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true, legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  message: { success: false, error: "Muitas requisições. Tente novamente em instantes." },
  standardHeaders: true, legacyHeaders: false,
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());
app.use(requestLogger);
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/api", apiLimiter);

// Rotas que ainda são JS puro (não migradas para TS)
app.use("/api/users",                userProjectsRouter);
app.use("/api/users/login",          loginLimiter);
app.use("/api/users",                usersRouter);
app.use("/api/projects",             projectsRouter);
app.use("/api/modules",              authenticate, modulesRouter);
app.use("/api/test-cases",           authenticate, testCasesRouter);
app.use("/api/cycles",               authenticate, cyclesRouter);
app.use("/api/bugs/:bugId/comments", bugCommentsRouter);
app.use("/api",                      shareRouter);
app.use("/api/bugs",                 bugsRouter);
app.use("/api/dashboard",            authenticate, dashboardRouter);
app.use("/api/export",               authenticate, exportRouter);
app.use("/api/backup",               backupRouter);
app.use("/api/notifications",        notificationsRouter);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime(), env: process.env.NODE_ENV })
);
app.use(errorHandler);

async function start(): Promise<void> {
  await initDatabase();
  await runMigrations();
  await addUserProjectsTable();
  await addBugCommentsTable();
  await upgradeBugsTable();
  await addShareTokensTable();
  await addDefaultProjectColumn();
  await addProjectsCreatorColumn();
  await addActivityTables();
  await addBugTestType();
  await addNotificationsTable();
  await addBugsV150Fields();
  await runSeed();
  app.listen(PORT, () => {
    console.log(`\n🚀 QA System rodando na porta ${PORT}`);
    console.log(`   DB: ${process.env.DATABASE_URL ? "PostgreSQL" : "SQLite"}\n`);
  });
}

start().catch(err => { console.error("Erro:", err); process.exit(1); });