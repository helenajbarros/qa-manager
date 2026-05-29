const { query, execute } = require("../database/connection");
const { getUserProjectIds } = require("./userprojectsservice");

async function findAll(userId, role) {
  // Admin vê todos; outros só veem os atribuídos
  const allowedIds = await getUserProjectIds(userId, role);

  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM modules     m WHERE m.project_id = p.id) AS module_count,
      (SELECT COUNT(*) FROM test_cycles c WHERE c.project_id = p.id) AS cycle_count,
      (SELECT COUNT(*) FROM bugs        b WHERE b.project_id = p.id) AS bug_count
    FROM projects p
  `;

  if (allowedIds !== null && allowedIds.length > 0) {
    const placeholders = allowedIds.map((_, i) => `$${i + 1}`).join(",");
    sql += ` WHERE p.id IN (${placeholders}) ORDER BY p.name`;
    return query(sql, allowedIds);
  } else if (allowedIds !== null && allowedIds.length === 0) {
    // Usuário sem nenhum projeto atribuído
    return [];
  }

  sql += " ORDER BY p.name";
  return query(sql);
}

async function findById(id) {
  const rows = await query("SELECT * FROM projects WHERE id = $1", [id]);
  return rows[0];
}

async function create({ name, description }) {
  const rows = await query("INSERT INTO projects (name,description) VALUES ($1,$2) RETURNING id", [name.trim(), description||null]);
  return findById(rows[0].id);
}

async function update(id, { name, description, active, logo_url }) {
  const cur = await findById(id);
  if (!cur) return null;
  await execute("UPDATE projects SET name=$1,description=$2,active=$3,logo_url=$4 WHERE id=$5",
    [name?.trim()||cur.name, description||cur.description, active!==undefined?(active?1:0):cur.active, logo_url!==undefined?logo_url:cur.logo_url, id]);
  return findById(id);
}

async function saveLogo(id, fileBuffer, mimetype) {
  const base64 = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
  await execute("UPDATE projects SET logo_url=$1 WHERE id=$2", [base64, id]);
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM projects WHERE id=$1", [id]);
}

module.exports = { findAll, findById, create, update, saveLogo, remove };
