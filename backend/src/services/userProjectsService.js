const { query, execute } = require("../database/connection");

async function getUserProjectIds(userId, role) {
  if (role === "admin") return null;
  const rows = await query(
    "SELECT project_id FROM user_projects WHERE user_id = $1",
    [userId]
  );
  return rows.map(r => parseInt(r.project_id));
}

async function getProjectsForUser(userId) {
  const rows = await query(
    "SELECT project_id FROM user_projects WHERE user_id = $1",
    [userId]
  );
  return rows.map(r => parseInt(r.project_id));
}

async function setUserProjects(userId, projectIds) {
  await execute("DELETE FROM user_projects WHERE user_id = $1", [userId]);
  for (const pid of projectIds) {
    try {
      await query(
        "INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)",
        [userId, pid]
      );
    } catch(_) {}
  }
  return getProjectsForUser(userId);
}

module.exports = { getUserProjectIds, getProjectsForUser, setUserProjects };
