import "dotenv/config";
import { initDatabase }           from "./database/connection";
import { runMigrations }          from "./database/migrations";
import { upgradeBugsTable }       from "./database/migrations_bugs_v2";
import { addUserProjectsTable }   from "./database/migrations_user_projects";
import { addBugCommentsTable }    from "./database/migrations_bug_comments";
import { addShareTokensTable }    from "./database/migrations_share_tokens";
import { addDefaultProjectColumn }from "./database/migrations_default_project";
import { addProjectsCreatorColumn }from "./database/migrations_projects_creator";
import { addActivityTables }      from "./database/migrations_activity";
import { addBugTestType }         from "./database/migrations_bug_test_type";
import { addNotificationsTable }  from "./database/migrations_notifications";
import { addBugsV150Fields }       from "./database/migrations_bugs_v150";
import { addEnvironmentsTable }    from "./database/migrations_environments";
import { runSeed }                from "./database/seed";
import app from "./app";

const PORT = process.env.PORT || 3001;

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
  await addEnvironmentsTable();
  await runSeed();
  app.listen(PORT, () => {
    console.log(`\n🚀 QA System rodando na porta ${PORT}`);
    console.log(`   DB: ${process.env.DATABASE_URL ? "PostgreSQL" : "SQLite"}\n`);
  });
}

start().catch(err => { console.error("Erro:", err); process.exit(1); });