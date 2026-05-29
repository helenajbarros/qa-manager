const { query, execute } = require("../database/connection");

// Retorna IDs dos projetos que o usuário pode acessar
// Admin não tem restrição — vê tudo
async function getUserProjectIds(userId, role) {
  if (role === "admin") return null; // null = sem restrição
  const rows = await query(
    "SELECT project_id FROM user_projects WHERE user_id = $1",
    [userId]
  );
  return rows.map(r => parseInt(r.project_id));
}

// Lista projetos atribuídos a um usuário
async function getProjectsForUser(userId) {
  const rows = await query(
    "SELECT project_id FROM user_projects WHERE user_id = $1",
    [userId]
  );
  return rows.map(r => parseInt(r.project_id));
}

// Define projetos de um usuário (substitui todos)
async function setUserProjects(userId, projectIds) {
  // Remove todos os acessos atuais
  await execute("DELETE FROM user_projects WHERE user_id = $1", [userId]);
  // Insere os novos
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
