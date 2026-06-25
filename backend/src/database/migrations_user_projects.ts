import { query, execute, USE_PG } from "./connection";
export async function addUserProjectsTable(): Promise<void> {
  if (USE_PG) {
    await query(`CREATE TABLE IF NOT EXISTS user_projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(user_id, project_id));`);
  } else {
    await execute(`CREATE TABLE IF NOT EXISTS user_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL, UNIQUE(user_id, project_id))`, []);
  }
  console.log("[DB] user_projects OK");
}
