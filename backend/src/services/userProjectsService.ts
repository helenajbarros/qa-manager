import { query, execute } from "../database/connection";

export async function getUserProjectIds(userId: number, role: string): Promise<number[] | null> {
  if (role === "admin") return null;
  const rows = await query<{project_id: string}>("SELECT project_id FROM user_projects WHERE user_id = $1", [userId]);
  return rows.map(r => parseInt(r.project_id));
}

export async function getProjectsForUser(userId: number): Promise<number[]> {
  const rows = await query<{project_id: string}>("SELECT project_id FROM user_projects WHERE user_id = $1", [userId]);
  return rows.map(r => parseInt(r.project_id));
}

export async function setUserProjects(userId: number, projectIds: number[]): Promise<number[]> {
  await execute("DELETE FROM user_projects WHERE user_id = $1", [userId]);
  for (const pid of projectIds) {
    try { await query("INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)", [userId, pid]); }
    catch(_) {}
  }
  return getProjectsForUser(userId);
}
